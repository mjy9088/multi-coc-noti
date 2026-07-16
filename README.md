# Multi Village Command Center

여러 Clash of Clans 마을의 빌더·연구 슬롯과 진행 중인 업그레이드를 한곳에서 보고, 완료 시점을 iOS Bark로 알리는 반응형 대시보드입니다. 게임에서 복사한 export JSON과 선택적 자동 수집 데이터를 PostgreSQL에 통합해 보존합니다.

## 주요 기능

- 전체 마을의 빌더, 연구소, 펫, 장인기지 슬롯과 업그레이드 완료 시각 표시
- 계정 태그 기반 그룹 보기와 서버에 저장되는 그룹 순서
- 업그레이드를 시작할 수 있는 마을 우선 표시
- 게임 export JSON 자동 검토, 클립보드 붙여넣기와 전역 `Quick Paste`
- 마을별 자원 상태·준비 시간에 따른 PostgreSQL 기반 Bark 알림·재시도
- 모바일 고정 섹션 탭, 하단 Import 동작 영역과 마을 설정 바로가기
- 한국어·영어 UI, 마을별 히스토리 백업과 복원

## 빠른 시작

필요한 도구는 Node.js 24, pnpm, Docker와 just이며 mise로 설치할 수 있습니다.

```bash
cp docker/.env.example docker/.env
# docker/.env의 ADMIN_TOKEN, POSTGRES_PASSWORD, BARK_DEVICE_KEY를 변경
mise install
just setup
just ui
```

브라우저에서 `http://localhost:3000`을 열고 `Settings → Update Data`에서 `ADMIN_TOKEN`으로 로그인합니다. 게임 export JSON을 붙여넣으면 플레이어 태그로 기존 마을을 자동 식별하며, 처음 보는 태그일 때만 표시 이름을 입력합니다.

`just ui`는 PostgreSQL을 Docker로, Collector·Notifier·Next.js를 로컬 개발 프로세스로 실행합니다. 포트를 바꾸려면 `just ui 3001`처럼 실행합니다. 전체 서비스를 Docker로 실행하려면 다음 명령을 사용합니다.

```bash
just up
```

기본 주소는 대시보드 `http://localhost:3000`, Collector API `http://localhost:8787`입니다.

## 문서

- [대시보드와 설정 사용법](docs/dashboard-guide.md): 태그 그룹, 표시 옵션, Quick Paste, 알림과 모바일 사용 흐름
- [마을 데이터 업데이트 흐름](docs/village-data-flow.md): export 검증, 식별자, 업그레이드 슬롯 계산과 안전장치
- [자원 상태 기반 알림 정책](docs/resource-notification-policy.md): 자원 상태, 준비 시간, 알림 시점과 중복 방지 동작
- [운영 가이드](docs/operations.md): 환경 변수, 실행 명령, 데이터 보존, 백업·복원, 분리 배포와 API

## 구성

| 경로 | 역할 |
| --- | --- |
| `apps/dashboard` | Next.js 반응형 대시보드와 관리자 UI |
| `packages/collector` | Push/Pull 수집, 게임 export 처리, 공식 Player API 보강과 HTTP API |
| `packages/notifier` | PostgreSQL 알림 큐 소비와 Bark 발송 |
| `packages/database` | 스키마, 계정·업그레이드·알림·히스토리 저장소 |
| `packages/shared` | 스냅샷 정규화, 계정 태그와 JSONL 유틸리티 |
| `packages/upgrade-availability` | 고블린 장인·연구원 추정을 포함한 표시 가능 슬롯 계산 |

Collector와 Notifier는 `tracked_upgrades`와 `upgrade_notifications`를 통해 연결됩니다. 프로세스를 다른 서버로 분리해도 같은 PostgreSQL을 사용해야 하며, 스키마 마이그레이션은 Collector 시작 시 자동 실행됩니다.

## 자주 쓰는 명령

```bash
just ui                 # DB + 로컬 개발 서비스
just up                 # 전체 Docker 실행
just down               # Docker 서비스 종료
just logs collector     # 서비스 로그
just status             # Collector 상태
just sources            # 계정별 수집·공식 API 상태
just data export        # 모든 마을 히스토리 백업
just data import --path .local/village-history
just check              # 테스트, lint, Compose 검증
```

pnpm 명령을 직접 사용할 수도 있습니다.

```bash
pnpm typecheck
pnpm test
pnpm --filter @multi-coc/dashboard lint
```

## 개발 원칙

- 계정, 그룹 순서와 알림 설정은 env가 아니라 PostgreSQL에 저장합니다.
- 비밀값은 `docker/.env` 또는 패키지별 `.env`에만 두며 `NEXT_PUBLIC_*`에는 넣지 않습니다.
- 플레이어 태그는 게임 데이터 매칭에, UUID는 내부 DB 관계와 API 경로에 사용합니다.
- 공식 Player API와 게임 export가 제공하지 않는 현재 자원량은 추정해 표시하지 않습니다.
- 데모 fallback은 `NEXT_PUBLIC_DEMO_MODE=true`일 때만 활성화합니다.
