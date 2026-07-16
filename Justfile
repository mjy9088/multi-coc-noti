set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

# 사용 가능한 명령 보기
default:
    @just --list --unsorted

# 개발 도구와 pnpm 의존성 설치
setup:
    mise install
    mise exec -- pnpm install

# Docker DB + 로컬 collector + notifier + 대시보드 실행
ui port="3000":
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ ! -f docker/.env ]]; then
      echo "docker/.env가 없습니다. cp docker/.env.example docker/.env 후 관리자·DB 비밀번호를 입력하세요."
      exit 1
    fi
    mise exec -- node --env-file=docker/.env -e '
      for (const key of ["ADMIN_TOKEN", "POSTGRES_PASSWORD"]) {
        const value = process.env[key] || "";
        if (!value) {
          console.error(`docker/.env의 ${key}가 비어 있습니다.`);
          process.exit(1);
        }
      }
      if ((process.env.ADMIN_TOKEN || "").startsWith("replace-with-")) {
        console.error("docker/.env의 ADMIN_TOKEN에 실제 값을 설정하세요.");
        process.exit(1);
      }
      if ((process.env.POSTGRES_PASSWORD || "").startsWith("replace-with-")) {
        console.warn("경고: PostgreSQL 예시 비밀번호를 사용 중입니다. 외부에 배포하기 전에 변경하세요.");
      }
    '
    port_available() {
      PORT_TO_CHECK="$1" mise exec -- node -e '
        const net = require("node:net");
        const sockets = ["127.0.0.1", "::1"].map((host) => net.connect({
          port: Number(process.env.PORT_TO_CHECK), host,
        }));
        let refused = 0;
        for (const socket of sockets) {
          socket.once("connect", () => {
            for (const candidate of sockets) candidate.destroy();
            process.exit(1);
          });
          socket.once("error", () => {
            if (++refused === sockets.length) process.exit(0);
          });
        }
      '
    }
    if ! port_available "{{port}}"; then
      echo "대시보드 포트 {{port}}가 이미 사용 중입니다. 예: just ui 3001"
      exit 1
    fi
    if ! port_available 8787; then
      echo "수집 API 포트 8787이 이미 사용 중입니다. 기존 collector를 종료한 뒤 다시 실행하세요."
      exit 1
    fi
    docker compose --env-file docker/.env up -d --wait db
    export DATA_DIR="$PWD/data"
    echo "대시보드: http://localhost:{{port}}"
    echo "수집 API: http://localhost:8787"
    echo "처음이면 대시보드의 알림 설정에서 계정과 게임 export JSON을 추가하세요."
    mise exec -- node --env-file=docker/.env packages/collector/src/server.ts &
    collector_pid=$!
    mise exec -- node --env-file=docker/.env packages/notifier/src/notifier.ts &
    notifier_pid=$!
    (
      cd apps/dashboard
      exec mise exec -- ./node_modules/.bin/next dev --port "{{port}}"
    ) &
    dashboard_pid=$!
    cleanup() {
      kill "$collector_pid" "$notifier_pid" "$dashboard_pid" 2>/dev/null || true
      wait "$collector_pid" "$notifier_pid" "$dashboard_pid" 2>/dev/null || true
    }
    trap cleanup EXIT
    trap 'exit 0' INT TERM
    while kill -0 "$collector_pid" 2>/dev/null && kill -0 "$notifier_pid" 2>/dev/null && kill -0 "$dashboard_pid" 2>/dev/null; do
      sleep 1
    done
    exit 1

# Next.js 대시보드만 로컬 개발 서버로 실행 (.env.local 자동 사용)
dashboard port="3000":
    cd apps/dashboard && mise exec -- ./node_modules/.bin/next dev --port "{{port}}"

# Collector만 standalone 설정으로 실행
collector:
    mise exec -- pnpm collector

# 실행 중인 collector에 Docker 설정으로 JSON/JSONL 스냅샷 전송
ingest file="examples/snapshot.json":
    mise exec -- node --env-file=docker/.env scripts/ingest.ts "{{file}}"

# DB JSON 히스토리를 마을별 파일로 백업 (village는 UUID, 태그, 표시 이름)
history-export dir=".local/village-history" village="":
    docker compose --env-file docker/.env up -d --wait db
    mise exec -- node --env-file=docker/.env scripts/village-history.ts export "{{dir}}" "{{village}}"

# 마을별 히스토리 파일/디렉터리를 현재 DB에 중복 없이 병합
history-import path=".local/village-history":
    docker compose --env-file docker/.env up -d --wait db
    mise exec -- node --env-file=docker/.env scripts/village-history.ts import "{{path}}"

# 비어 있는 개발 DB를 준비하고 마을별 히스토리로 seed
history-seed path=".local/village-history":
    docker compose --env-file docker/.env up -d --wait db
    mise exec -- node --env-file=docker/.env scripts/village-history.ts import "{{path}}"

# 개발 DB를 완전히 다시 만든 뒤 마을별 히스토리로 seed (just ui는 먼저 종료)
db-reseed path=".local/village-history":
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ ! -e "{{path}}" ]]; then
      echo "히스토리 백업을 찾을 수 없습니다: {{path}}"
      exit 1
    fi
    docker compose --env-file docker/.env up -d --wait db
    mise exec -- node --env-file=docker/.env scripts/village-history.ts validate "{{path}}"
    docker_collector="$(docker compose --env-file docker/.env ps -q collector)"
    if [[ -z "$docker_collector" ]] && curl --max-time 1 --silent --fail http://127.0.0.1:8787/health >/dev/null 2>&1; then
      echo "로컬 collector가 실행 중입니다. just ui를 종료한 뒤 다시 실행하세요."
      exit 1
    fi
    docker compose --env-file docker/.env stop collector notifier >/dev/null
    docker compose --env-file docker/.env exec -T db dropdb -U coc --force --if-exists multi_coc
    docker compose --env-file docker/.env exec -T db createdb -U coc multi_coc
    mise exec -- node --env-file=docker/.env scripts/village-history.ts import "{{path}}"

# collector 상태 확인
status:
    @curl --max-time 5 --fail-with-body --silent --show-error http://127.0.0.1:8787/health
    @echo

# 계정별 원본 서버 및 공식 API 동기화 상태 확인
sources:
    @curl --max-time 5 --fail-with-body --silent --show-error http://127.0.0.1:8787/api/sources
    @echo

# Bark notifier만 standalone 설정으로 실행
notifier:
    mise exec -- pnpm notifier

# Docker로 전체 서비스 실행
up:
    docker compose --env-file docker/.env up --build -d

# PostgreSQL만 준비
db-up:
    docker compose --env-file docker/.env up -d --wait db

# Docker 서비스 종료
down:
    docker compose --env-file docker/.env down

# Docker 로그 보기
logs service="":
    docker compose --env-file docker/.env logs -f {{service}}

# 단위 테스트, 대시보드 빌드, lint, Compose 설정 검증
check:
    mise exec -- pnpm run test
    mise exec -- pnpm run lint
    docker compose --env-file docker/.env.example config --quiet
