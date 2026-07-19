set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

# PostgreSQL 준비와 마을 데이터 백업·복원
mod data

# 사용 가능한 명령 보기
default:
    @just --list --unsorted

# 개발 도구와 pnpm 의존성 설치
setup:
    mise install
    mise exec -- pnpm install

# 개발: Docker DB + 로컬 gateway, collector, notifier, Next.js 실행
dev port="3000":
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ ! -f docker/.env ]]; then
      echo "docker/.env가 없습니다. cp docker/.env.example docker/.env 후 인증·DB 설정을 입력하세요."
      exit 1
    fi
    mise exec -- node --env-file=docker/.env -e '
      for (const key of ["AUTH_SECRET", "POSTGRES_PASSWORD"]) {
        const value = process.env[key] || "";
        if (!value) {
          console.error(`docker/.env의 ${key}가 비어 있습니다.`);
          process.exit(1);
        }
      }
      if ((process.env.AUTH_SECRET || "").startsWith("replace-with-")) {
        console.error("docker/.env의 AUTH_SECRET에 실제 값을 설정하세요.");
        process.exit(1);
      }
      const testLoginEnabled = process.env.AUTH_TEST_CREDENTIALS_ENABLED === "true";
      const testLogin = testLoginEnabled && process.env.AUTH_TEST_USERNAME && process.env.AUTH_TEST_PASSWORD;
      if (testLoginEnabled && !testLogin) {
        console.error("테스트 로그인을 활성화하면 AUTH_TEST_USERNAME과 AUTH_TEST_PASSWORD가 모두 필요합니다.");
        process.exit(1);
      }
      if (!(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) &&
          !(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) && !testLogin) {
        console.error("GitHub/Google 소셜 로그인 또는 완전한 테스트 로그인 설정이 필요합니다.");
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
      echo "개발 gateway 포트 {{port}}가 이미 사용 중입니다. 예: just dev 3100"
      exit 1
    fi
    internal_port=$(({{port}} + 1))
    while ! port_available "$internal_port"; do
      internal_port=$((internal_port + 1))
      if [[ "$internal_port" -gt $(({{port}} + 100)) ]]; then
        echo "Next.js에 사용할 내부 포트를 찾지 못했습니다."
        exit 1
      fi
    done
    collector_port=$((internal_port + 1))
    while ! port_available "$collector_port"; do
      collector_port=$((collector_port + 1))
      if [[ "$collector_port" -gt $(({{port}} + 200)) ]]; then
        echo "Collector에 사용할 내부 포트를 찾지 못했습니다."
        exit 1
      fi
    done
    docker compose --env-file docker/.env up -d --wait db
    echo "대시보드 gateway: http://localhost:{{port}}"
    echo "처음이면 대시보드의 Settings → Update Data에서 게임 export JSON을 추가하세요."
    HOST=127.0.0.1 PORT="$collector_port" mise exec -- node --env-file=docker/.env packages/collector/src/server.ts &
    collector_pid=$!
    mise exec -- node --env-file=docker/.env packages/notifier/src/notifier.ts &
    notifier_pid=$!
    PORT="{{port}}" DASHBOARD_UPSTREAM="http://127.0.0.1:$internal_port" COLLECTOR_UPSTREAM="http://127.0.0.1:$collector_port" mise exec -- node packages/reverse-proxy/src/server.ts &
    proxy_pid=$!
    (
      cd apps/dashboard
      export NEXT_DASHBOARD_ENV_FILE=../../docker/.env
      exec mise exec -- ./node_modules/.bin/next dev --hostname 127.0.0.1 --port "$internal_port"
    ) &
    dashboard_pid=$!
    cleanup() {
      kill "$collector_pid" "$notifier_pid" "$proxy_pid" "$dashboard_pid" 2>/dev/null || true
      wait "$collector_pid" "$notifier_pid" "$proxy_pid" "$dashboard_pid" 2>/dev/null || true
    }
    trap cleanup EXIT
    trap 'exit 0' INT TERM
    while kill -0 "$collector_pid" 2>/dev/null && kill -0 "$notifier_pid" 2>/dev/null && kill -0 "$proxy_pid" 2>/dev/null && kill -0 "$dashboard_pid" 2>/dev/null; do
      sleep 1
    done
    exit 1

# 개발: Next.js만 실행 (.env.local 자동 사용, gateway 없음)
dev-dashboard port="3000":
    cd apps/dashboard && mise exec -- ./node_modules/.bin/next dev --port "{{port}}"

# 디자인 시스템: Next.js UI Lab 실행
dev-ui port="3100":
    cd apps/ui-lab && mise exec -- ./node_modules/.bin/next dev --port "{{port}}"

# 개발: Collector만 standalone 설정으로 실행
dev-collector:
    mise exec -- pnpm collector

# 개발: Collector 상태 확인
dev-status:
    @curl --max-time 5 --fail-with-body --silent --show-error --output /dev/null http://127.0.0.1:3000/
    @curl --max-time 5 --fail-with-body --silent --show-error --output /dev/null http://127.0.0.1:3000/health
    @echo "development gateway, dashboard, and Collector health endpoint are reachable"

# 개발: 계정별 공식 API 동기화 상태 확인
# 개발: Bark notifier만 standalone 설정으로 실행
dev-notifier:
    mise exec -- pnpm notifier

# 프로덕션: Docker로 전체 서비스 빌드 및 실행
prod-up:
    docker compose --env-file docker/.env up --build -d

# 프로덕션: Docker 서비스 종료
prod-down:
    docker compose --env-file docker/.env down

# 프로덕션: Docker 로그 보기
prod-logs service="":
    docker compose --env-file docker/.env logs -f {{service}}

# 포맷, 단위 테스트, 대시보드 빌드, lint, Compose 설정 검증
check:
    mise exec -- pnpm run format:check
    mise exec -- pnpm run test
    mise exec -- pnpm run lint
    docker compose --env-file docker/.env.example config --quiet
