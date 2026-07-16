# 운영 가이드

## 실행 방식과 환경 파일

실행 방식별 env 파일을 섞어 쓰지 않습니다.

| 파일 | 사용 시점 |
| --- | --- |
| `docker/.env` | `just up`, `just ui`, `just db-up`과 Docker Compose |
| `apps/dashboard/.env.local` | `just dashboard`로 Next.js만 실행 |
| `packages/collector/.env` | `just collector` standalone 실행 |
| `packages/notifier/.env` | `just notifier` standalone 실행 |

루트 `.env`는 사용하지 않습니다. 예시 파일을 복사한 뒤 실제 비밀값으로 변경합니다. `NEXT_PUBLIC_*` 값은 브라우저와 빌드 산출물에 공개됩니다.

### 주요 환경 변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `ADMIN_TOKEN` | 없음 | 관리자 API와 설정 화면 로그인에 필요한 비밀값 |
| `POSTGRES_PASSWORD` | 없음 | PostgreSQL 전용 비밀번호. 관리자 로그인에 사용하지 않음 |
| `DATABASE_URL` | 없음 | standalone 서비스의 PostgreSQL 연결 문자열 |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | 로컬 기본값 | `DATABASE_URL` 대신 사용하는 PostgreSQL 개별 연결 설정 |
| `DATA_DIR` | `/data` | Collector의 JSONL·`latest.json` 저장 경로 |
| `PORT` | `8787` | Collector HTTP 포트 |
| `CORS_ORIGIN` | `*` | 허용할 대시보드 Origin. 운영에서는 반드시 제한 권장 |
| `POLL_INTERVAL_SECONDS` | `300` | Pull 수집과 공식 API 갱신 주기 |
| `INGEST_RATE_LIMIT_PER_MINUTE` | `120` | 계정·접속 IP 조합별 Push 수집 제한 |
| `SNAPSHOT_RETENTION_DAYS` | `90` | JSONL과 DB 스냅샷 보존 기간. `0`은 자동 삭제 안 함 |
| `CLASH_OF_CLANS_API_TOKEN` | 없음 | 공식 개발자 Player API 서버 키 |
| `CLASH_OF_CLANS_API_BASE` | Supercell API | 공식 API 호환 프록시·테스트용 주소 |
| `BARK_DEVICE_KEY` | 없음 | Notifier 실행에 필요한 Bark 기기 키 |
| `BARK_BASE_URL` | `https://api.day.app` | Bark API 주소 |
| `BARK_GROUP` | `Clash Upgrades` | Bark 알림 그룹 |
| `BARK_ICON` | 없음 | 선택적 Bark 아이콘 URL |
| `NOTIFICATION_LOCALE` | `ko` | Bark 문구 언어: `ko` 또는 `en` |
| `NOTIFIER_INTERVAL_SECONDS` | `10` | DB 알림 큐 확인 주기 |
| `NEXT_PUBLIC_API_BASE` | 현재 호스트의 `:8787` | 브라우저에서 호출할 Collector 주소 |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | 메타데이터의 공개 사이트 주소 |
| `NEXT_PUBLIC_DEMO_MODE` | `false` | Collector 연결 실패 시 데모 fallback 사용 여부 |
| `COLLECTOR_API_BASE` | `http://127.0.0.1:8787` | `scripts/ingest.ts`가 호출할 Collector 주소 |

게임 설정에서 복사하는 마을별 API Token은 소유권 확인용이며 공식 Player API 조회 키가 아닙니다. 이 프로젝트는 공식 개발자 사이트에서 발급한 서버 키만 `CLASH_OF_CLANS_API_TOKEN`으로 받습니다.

## 로컬 실행

```bash
# DB + Collector + Notifier + Dashboard
just ui

# 대시보드 포트 변경
just ui 3001

# 개별 실행
cp apps/dashboard/.env.example apps/dashboard/.env.local
just dashboard

cp packages/collector/.env.example packages/collector/.env
just collector

cp packages/notifier/.env.example packages/notifier/.env
just notifier
```

## 데이터 수집 경로

| 경로 | 식별·인증 | 용도 |
| --- | --- | --- |
| 게임 export | JSON의 플레이어 태그 + 관리자 인증 | 일상적인 업그레이드·슬롯 갱신 |
| `POST /api/ingest` | 계정별 API 키 또는 관리자 키 + 문서의 플레이어 태그 | 외부 도구의 JSON/JSONL Push 수집 |
| 계정 `sourceUrl` | 계정별 API 키를 Bearer로 전송 | 외부 상태 서버를 주기적으로 Pull |
| 공식 Player API | 전역 `CLASH_OF_CLANS_API_TOKEN` | 이름, 태그, 타운홀과 경험치 레벨 보강 |

게임 export와 snapshot에서 감지한 업그레이드는 `tracked_upgrades`에 합쳐집니다. 같은 마을·항목·다음 레벨의 중복 타이머는 취소 처리하고, 더 이상 관측되지 않은 활성 항목은 완료 시각에 따라 완료 또는 취소 처리합니다.

## 데이터 저장과 보존

계정, 태그 그룹 순서, export, 스냅샷, 업그레이드와 알림 상태는 PostgreSQL에 저장합니다.

- `accounts`: 마을, 플레이어 태그, 표시 태그와 연동 정보
- `dashboard_settings`: 대시보드 그룹 순서
- `village_exports`: 게임 export 원문과 정규화 결과
- `snapshot_logs`: 자동 수집 원문과 정규화 결과
- `tracked_upgrades`: export와 snapshot에서 통합한 업그레이드
- `upgrade_notifications`: 예약, 발송, 실패와 재시도 상태

독립 보존본은 UTC 날짜별로 기록합니다.

```text
/data/accounts/<account-uuid>/latest.json
/data/accounts/<account-uuid>/snapshots/YYYY-MM-DD.jsonl
```

보존 정리는 Collector 시작 시 한 번, 이후 6시간마다 실행됩니다. Notifier는 파일을 읽지 않고 PostgreSQL만 사용합니다.

## 백업과 복원

```bash
# 모든 마을
just history-export

# UUID, 플레이어 태그 또는 정확한 표시 이름으로 한 마을
just history-export village='#GRG2VGRQ9'

# 파일 또는 디렉터리를 현재 DB에 병합
just history-import path=.local/village-history

# 빈 DB에 seed
just history-seed

# 개발 DB를 삭제하고 백업으로 다시 생성; just ui를 먼저 종료
just db-reseed
```

백업에는 표시 이름, 플레이어 태그, 색상, 계정 태그, 자원 상태·준비 시간, snapshot/export가 포함됩니다. 수집 API 키와 Pull URL은 포함하지 않습니다. Import는 플레이어 태그로 기존 계정을 찾으며, 기존 계정의 현재 설정은 덮어쓰지 않습니다. 새 계정을 만들 때는 백업의 자원 설정을 복원합니다. 동일한 snapshot과 export를 건너뛰므로 반복 실행해도 히스토리가 중복되지 않습니다.

## Notifier 분리 배포

Collector가 먼저 DB 마이그레이션을 실행해야 합니다. 별도 알림 서버의 Notifier는 수집 서버와 같은 PostgreSQL에 연결합니다.

```bash
docker build -f docker/Dockerfile --target services -t multi-coc-services .
docker run -d --name coc-notifier --restart unless-stopped \
  --env-file packages/notifier/.env \
  multi-coc-services node packages/notifier/src/notifier.ts
```

Notifier는 발송 대상을 원자적으로 선점합니다. 성공은 `sent`, 실패는 오류와 다음 재시도 시각을 기록하며 lease와 DB 제약으로 다중 프로세스의 중복 선점을 방지합니다.

## API

공개·수집 API:

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/health` | Collector, DB, 관리자 설정 상태 |
| GET | `/api/sources` | 계정별 Pull·공식 API 동기화 상태 |
| GET | `/api/dashboard` | 최신 마을 상태와 그룹 순서 |
| GET | `/api/history?account=<uuid>&limit=100` | 최근 snapshot, 최대 500개 |
| POST | `/api/ingest` | 계정 API 키 또는 관리자 키로 JSON/JSONL Push 수집 |

관리자 Bearer 인증 필요:

| Method | Path | 설명 |
| --- | --- | --- |
| GET/POST | `/api/admin/accounts` | 계정 목록·생성 |
| PATCH/DELETE | `/api/admin/accounts/<uuid>` | 계정 수정·삭제 |
| PATCH | `/api/admin/accounts/<uuid>/resource-status` | Import 후 자원 상태 응답 저장 |
| GET/PATCH | `/api/admin/dashboard-settings` | 그룹 순서 조회·변경 |
| GET | `/api/admin/upgrades` | 추적 업그레이드 목록 |
| POST | `/api/admin/village-export/preview` | export 검증과 미리보기 |
| POST | `/api/admin/village-export` | 확인한 export 반영과 선택적 신규 마을 생성 |

운영에서는 Collector 앞에 TLS 리버스 프록시를 두고 `CORS_ORIGIN`을 실제 대시보드 Origin으로 제한합니다. Clipboard API를 사용하는 `Quick Paste`도 localhost가 아닌 환경에서는 HTTPS가 필요합니다.

## 다국어

UI locale은 `ko-KR`, `en-US`이며 선택은 쿠키에 저장됩니다. 번역은 `apps/dashboard/messages/<locale>.json`, 지원 locale은 `apps/dashboard/app/i18n-config.ts`에서 관리합니다. 새 언어는 영어 메시지와 같은 키를 모두 제공해야 합니다.

Bark 언어는 UI와 별개로 `NOTIFICATION_LOCALE=ko|en`을 사용합니다.
