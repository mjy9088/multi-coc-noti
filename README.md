# Multi Village Command Center

여러 Clash of Clans 계정의 마을 스냅샷을 JSONL로 보존하고, 업그레이드 현황을 대시보드에서 확인하며, 완료 이벤트를 iOS Bark로 알리는 Docker 구성입니다.

첫 화면은 전체 계정의 자원 보유율, 대기 빌더, 남은 업그레이드 시간과 파밍 우선순위에 집중합니다. 파밍 우선순위는 현재 골드·엘릭서 부족률 75%와 대기 빌더 비율 25%를 합산한 휴리스틱이며, 향후 업그레이드 목표 비용 데이터가 생기면 이를 반영할 예정입니다.

게임 JSON을 반영하는 관리 화면의 기준 흐름과 식별자 원칙은 [마을 데이터 업데이트 흐름](docs/village-data-flow.md)에 정리되어 있습니다.

## 패키지 구성

- `apps/dashboard`: 독립 Next 반응형 웹 앱. 기본 설정에서는 실제 수집 데이터만 표시하며, `NEXT_PUBLIC_DEMO_MODE=true`일 때만 데모 fallback을 사용합니다.
- `packages/collector`: 계정별 API 키 인증, JSON/JSONL 수신, 선택적 외부 URL 폴링, 최신 상태 API 제공.
- `packages/notifier`: 이벤트 JSONL 소비와 Bark 전송. 수집기와 별도 프로세스/서버로 배포할 수 있습니다.
- `packages/database`: PostgreSQL 스키마와 계정·수동 업그레이드·게임 export 저장소.
- `packages/shared`: 스냅샷 정규화, JSONL, 완료 이벤트 판정만 공유합니다.

루트는 pnpm workspace 실행과 Docker 조립만 담당합니다. `collector`와 `notifier`는 `/data/events/YYYY-MM-DD.jsonl`을 통해 연결됩니다. 같은 Docker 볼륨, NFS, 또는 파일 동기화 경로를 마운트하면 서로 다른 호스트에서도 동작합니다.

애플리케이션, 서비스, 공유 모듈, CLI와 테스트는 모두 TypeScript입니다. Node 24의 네이티브 TypeScript 실행을 사용하므로 별도 런타임 트랜스파일러는 두지 않으며, `erasableSyntaxOnly`와 strict 타입 검사를 적용합니다. `.mjs`는 ESLint와 PostCSS가 직접 읽는 도구 설정 파일에만 남겨둡니다.

## 시작하기

Docker 통합 실행 설정은 `docker/.env` 한 곳에서 관리합니다.

```bash
cp docker/.env.example docker/.env
mise install
just setup
just ui
```

브라우저에서 `http://localhost:3000`을 열고 `알림 설정`에서 `docker/.env`의 `ADMIN_TOKEN`으로 로그인합니다. 계정을 추가한 뒤 게임 export JSON을 붙여넣으면 됩니다. `just ui`는 PostgreSQL만 Docker로 실행하고 Collector와 Next.js는 로컬 개발 프로세스로 띄웁니다. 3000번 포트를 이미 사용 중이라면 `just ui 3001`처럼 포트를 지정할 수 있습니다.

저장소는 pnpm workspace이며 루트에는 애플리케이션 코드나 Next 설정을 두지 않습니다. Docker로 전체 서비스를 실행하려면 `just up`을 사용합니다.

접속 주소는 대시보드 `http://localhost:3000`, 수집 API `http://localhost:8787`입니다. 실제 키가 들어 있는 모든 env 파일은 Git과 Docker 빌드 컨텍스트에서 제외됩니다.

## 환경변수 경계

실행 방식별 env 파일을 섞어 쓰지 않습니다.

- `docker/.env`: `just up`, `just ui`, `just db-up`과 Docker Compose 전용. PostgreSQL 비밀번호와 컨테이너용 Collector·Notifier 설정을 포함합니다.
- `apps/dashboard/.env.local`: `just dashboard`로 Next.js만 단독 실행할 때 사용합니다. `apps/dashboard/.env.example`을 복사하며 `NEXT_PUBLIC_*` 공개 설정만 둡니다.
- `packages/collector/.env`: `just collector` 전용. `packages/collector/.env.example`을 복사하며 standalone PostgreSQL의 `DATABASE_URL`을 지정합니다.
- `packages/notifier/.env`: `just notifier` 전용. `packages/notifier/.env.example`을 복사합니다.

대시보드만 단독 실행하는 예시는 다음과 같습니다.

```bash
cp apps/dashboard/.env.example apps/dashboard/.env.local
just dashboard
```

Docker 없이 Collector나 Notifier를 단독 실행하려면 해당 패키지의 예시 파일을 `.env`로 복사한 뒤 `just collector` 또는 `just notifier`를 사용합니다. 루트 `.env`는 사용하지 않습니다.

## 계정과 게임 데이터

계정은 `.env`가 아니라 PostgreSQL에 저장합니다. 대시보드의 `알림 설정`에 게임 export JSON을 붙여넣으면 플레이어 태그로 기존 마을을 자동 식별합니다. 처음 보는 태그일 때만 표시 이름을 입력해 새 마을을 추가합니다. 같은 플레이어 태그는 중복 등록할 수 없습니다.

업그레이드 동기화는 Clash of Clans에서 `설정 → 기타 설정 → 데이터 내보내기 → 복사` 후 관리 화면에 JSON을 붙여넣는 방식입니다. 서버는 다음 조건을 모두 검사합니다.

- Supercell 플레이어 태그 문자 규칙을 만족하고 DB 계정 태그와 정확히 일치할 것
- export 시각이 미래 10분 이내이며 30일보다 오래되지 않을 것
- 기존에 저장한 export보다 새 데이터일 것
- 활성 타이머가 숫자이며 180일 이내일 것
- 레벨과 data ID가 정상 범위일 것

`timestamp + timer`로 종료 시각을 계산하고 건물·영웅·펫·연구 및 Builder Base 항목을 식별합니다. 이름 매핑은 MIT 라이선스의 `clash-of-clans-data`를 사용합니다. JSON을 다시 복사하기 어려운 경우 관리 화면에서 업그레이드와 남은 시간을 수동으로 추가·보정할 수 있습니다.

공식 Player API 토큰을 계정에 저장하거나 공용 `CLASH_OF_CLANS_API_TOKEN`을 설정하면 이름, 태그, 타운홀과 경험치 레벨을 보강합니다. 보유 자원은 게임 export와 공식 API에 없으므로 선택적인 상태 서버 JSON/JSONL이 계속 담당합니다.

외부 상태 서버는 계정 DB의 `sourceUrl`을 Bearer 수집 키로 주기 조회합니다. push 방식은 `POST /api/ingest`와 계정별 수집 키를 사용합니다. URL에 계정 번호를 넣지 않으며 수집 키로 마을을 식별합니다. 입력 계약은 [examples/snapshot.json](examples/snapshot.json)을 참고합니다.

## 데이터 보존과 요청 제한

스냅샷과 이벤트는 UTC 날짜별 JSONL로 회전됩니다.

- `/data/accounts/<account-uuid>/snapshots/YYYY-MM-DD.jsonl`
- `/data/events/YYYY-MM-DD.jsonl`
- `SNAPSHOT_RETENTION_DAYS=90`: 스냅샷 보존 기간. `0`이면 자동 삭제하지 않습니다.
- `EVENT_RETENTION_DAYS=90`: Bark 이벤트 보존 기간. `0`이면 자동 삭제하지 않습니다.
- `INGEST_RATE_LIMIT_PER_MINUTE=120`: 계정·접속 IP 조합별 분당 수집 제한입니다.

정리는 시작 시 한 번, 이후 6시간마다 실행됩니다. 최신 상태는 별도 `latest.json`에 유지되므로 오래된 JSONL을 정리해도 현재 대시보드는 유지됩니다.

## 알림 서버만 분리하기

수집 서버에서는 `dashboard`와 `collector`만 실행합니다.

```bash
docker compose --env-file docker/.env up --build -d dashboard collector
```

알림 서버에서는 동일 이벤트 경로가 `/data`로 보이도록 마운트하고 notifier 이미지만 실행합니다.

```bash
docker build -f docker/Dockerfile --target services -t multi-coc-services .
docker run -d --name coc-notifier --restart unless-stopped \
  --env-file packages/notifier/.env -e DATA_DIR=/data \
  -v /shared/multi-coc-data:/data \
  multi-coc-services node packages/notifier/src/notifier.ts
```

전송 성공 이벤트 ID는 `/data/notifier/state.json`에 최대 5,000개 보존하므로 재시작해도 같은 Bark 알림이 반복되지 않습니다. 전송 실패 시 ID를 기록하지 않아 다음 주기에 재시도합니다.

## 다국어

대시보드는 우측 상단에서 한국어와 영어를 즉시 전환하며 선택은 브라우저에 저장됩니다. 계정 이름과 업그레이드 이름 같은 원본 데이터는 번역하지 않습니다. Bark 문구는 Docker에서는 `docker/.env`, standalone에서는 `packages/notifier/.env`의 `NOTIFICATION_LOCALE=ko` 또는 `en`으로 알림 서버마다 독립 설정할 수 있습니다.

## API

- `GET /health`: 수집기 상태
- `GET /api/sources`: 계정별 원본 서버와 공식 API 동기화 상태
- `GET /api/dashboard`: 모든 계정의 최신 정규화 상태
- `GET /api/history?account=<uuid>&limit=100`: 지정한 마을의 최근 스냅샷. `limit`은 최대 500
- `POST /api/ingest`: 계정별 Bearer 키로 마을을 자동 식별해 스냅샷 수신
- `POST /api/admin/village-export/preview`: 관리자 인증 후 게임 export JSON 검증·미리보기
- `POST /api/admin/village-export`: 확인한 export를 태그에 맞는 마을에 저장하고, 새 태그라면 label과 함께 마을 생성
- `/api/admin/accounts`, `/api/admin/upgrades`: 관리자 인증 계정·수동 업그레이드 관리

운영에서는 `CORS_ORIGIN`을 대시보드 주소로 제한하고, 8787 포트 앞에 TLS 리버스 프록시를 두는 것을 권장합니다.
