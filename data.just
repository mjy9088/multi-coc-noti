set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

# 데이터 명령 목록 보기
default:
    @just --unsorted --list data

# PostgreSQL만 준비
up:
    docker compose --env-file docker/.env up -d --wait db

# 로컬 테스트 로그인 계정의 DB 히스토리를 마을별 JSON으로 백업 (village는 UUID, 태그, 표시 이름)
[arg("dir", long)]
[arg("village", long)]
export dir=".local/village-history" village="":
    docker compose --env-file docker/.env up -d --wait db
    mise exec -- node --env-file=docker/.env packages/maintenance/src/village-history.ts export "{{ dir }}" "{{ village }}"

# 마을별 히스토리 파일/디렉터리를 로컬 테스트 로그인 계정에 중복 없이 병합
[arg("path", long)]
import path=".local/village-history":
    docker compose --env-file docker/.env up -d --wait db
    mise exec -- node --env-file=docker/.env packages/maintenance/src/village-history.ts import "{{ path }}"

# 비어 있는 개발 DB를 준비하고 로컬 테스트 로그인 계정에 마을별 히스토리로 seed
[arg("path", long)]
seed path=".local/village-history":
    docker compose --env-file docker/.env up -d --wait db
    mise exec -- node --env-file=docker/.env packages/maintenance/src/village-history.ts import "{{ path }}"

# 히스토리 백업 파일 검증
[arg("path", long)]
validate path=".local/village-history":
    docker compose --env-file docker/.env up -d --wait db
    mise exec -- node --env-file=docker/.env packages/maintenance/src/village-history.ts validate "{{ path }}"

# 개발 DB를 완전히 다시 만든 뒤 로컬 테스트 로그인 계정에 마을별 히스토리로 seed (just dev는 먼저 종료)
[arg("path", long)]
reseed path=".local/village-history":
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ ! -e "{{ path }}" ]]; then
      echo "히스토리 백업을 찾을 수 없습니다: {{ path }}"
      exit 1
    fi
    docker compose --env-file docker/.env up -d --wait db
    mise exec -- node --env-file=docker/.env packages/maintenance/src/village-history.ts validate "{{ path }}"
    docker_collector="$(docker compose --env-file docker/.env ps -q collector)"
    if [[ -z "$docker_collector" ]] && curl --max-time 1 --silent --fail http://127.0.0.1:8787/health >/dev/null 2>&1; then
      echo "로컬 collector가 실행 중입니다. just dev를 종료한 뒤 다시 실행하세요."
      exit 1
    fi
    docker compose --env-file docker/.env stop collector notifier >/dev/null
    docker compose --env-file docker/.env exec -T db dropdb -U coc --force --if-exists multi_coc
    docker compose --env-file docker/.env exec -T db createdb -U coc multi_coc
    mise exec -- node --env-file=docker/.env packages/maintenance/src/village-history.ts import "{{ path }}"
