# Local Bites — 맛집 정보판

가족여행 맛집 후보를 한 화면에서 함께 정하는 보드. Naver 지도 단축 링크를 추가하면 카드로 자동 표시됩니다. 현재 20건 운영 중.

## 아키텍처

**Dual-source 구조**: Supabase를 메인 데이터 레이어로 사용하고, `data/places.json` 은 빌드 캐시/fallback 역할을 합니다.

```
share_link (URL 목록)
   │
   ├─► POST /api/places/add ──► Supabase lb_places UPSERT (즉시 표시)
   │                        └─► GitHub Contents API → share_link commit
   │
   └─► GHA fetch-places.yml (share_link 변경 감지)
          │  npm run fetch:places
          ├─► Naver 페이지 파싱 → data/places.json commit
          └─► Supabase lb_places UPSERT (데이터 보강)

app/page.tsx
   └─► Supabase SELECT lb_places (런타임, force-dynamic)
          └─► lb_place_overrides JOIN (수동 보정값 우선 적용)
```

### Supabase 테이블

| 테이블 | 역할 |
| ------ | ---- |
| `lb_places` | 장소 마스터 (Naver 파싱 데이터 + 즉시 등록 데이터) |
| `lb_place_overrides` | 수동 보정값 (이름·주소·좌표·설명·영업시간 등) — 자동 파싱값보다 우선 |
| `lb_place_likes` | 좋아요 (place_id, user_token) |
| `lb_place_comments` | 댓글 (place_id, user_token, body) |
| `lb_user_scraps` | 스크랩 (place_id, user_token) |

### 핵심 파일

- **`share_link`** — 사용자가 관리하는 URL 목록. 한 줄에 `https://naver.me/XXXX`. 필요시 ` | 식당|카페|기타` 카테고리 지정.
- **`scripts/fetch-places.ts`** — 독립 실행 스크립트. `share_link` 파싱 → Naver 페이지 수집 → `data/places.json` 저장 + Supabase UPSERT.
- **`data/places.json`** — GHA가 생성·커밋하는 캐시 파일.
- **`app/page.tsx`** — Supabase에서 직접 읽어 서버 컴포넌트 렌더 (force-dynamic).

## 로컬 개발

```bash
npm install
cp .env.local.example .env.local   # 환경 변수 설정
npm run fetch:places               # share_link → data/places.json (선택, 데이터 갱신용)
npm run dev                        # http://localhost:3000
```

스크립트는 빌드와 분리되어 있어 언제든 단독 실행 가능.

### 환경 변수

| 변수 | 기본 | 설명 |
| ---- | ---- | ---- |
| `NEXT_PUBLIC_SUPABASE_URL` | — | **(필수)** Supabase 프로젝트 URL (`https://xxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | **(필수)** Supabase anon/public key — 클라이언트 읽기용 |
| `SUPABASE_SERVICE_ROLE_KEY` | — | **(필수)** Supabase service_role key — 서버 쓰기용 (비공개 유지) |
| `GITHUB_TOKEN` | — | **(필수)** "후보 추가"·편집·삭제 시 GitHub Contents API commit 권한. 권한: `contents:write` |
| `ADMIN_PASSWORD` | — | **(필수)** 관리자 인증 비밀번호. 카드 편집/삭제 기능 활성화. |
| `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` | — | **(필수)** Naver Maps v3 Client ID. NCP → Maps → Application 등록 후 발급. **Web Dynamic Map** 서비스 활성화 필수. |
| `GITHUB_REPO_OWNER` | `siksik-e0-0` | 저장소 owner |
| `GITHUB_REPO_NAME` | `local-bites` | 저장소 이름 |
| `GITHUB_BRANCH` | `main` | 저장 대상 브랜치 |
| `FORCE_REFETCH` | `0` | `1` 이면 캐시 무시하고 모든 항목 재수집 |
| `SKIP_FETCH` | `0` | `1` 이면 `data/places.json` 그대로 유지 |
| `MAX_FETCHES_PER_BUILD` | `50` | 빌드당 최대 Naver 호출 횟수 |
| `NEXT_PUBLIC_NAVER_MAP_KEY_PARAM` | (자동) | 지도 스크립트 쿼리 파라미터 이름. 미지정 시 `ncpKeyId` → `ncpClientId` 순 자동 시도. |

### Vercel 환경 변수 설정

Vercel → Project → Settings → Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Production / Preview / Development 모두
- `SUPABASE_SERVICE_ROLE_KEY` — Production 전용 (Preview는 선택)
- `GITHUB_TOKEN` — Production / Preview / Development 모두 (`contents:write` 권한 Fine-grained PAT)

### GitHub Actions Secrets

Settings → Secrets and variables → Actions:

| Secret | 설명 |
| ------ | ---- |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |

GHA가 `fetch-places.ts` 실행 후 Supabase UPSERT에 사용합니다.

## share_link 형식

```text
# 주석 (무시)
https://naver.me/5130R7qr
https://naver.me/FyAteQQN | 카페
https://naver.me/FBe2MAkT | 식당
```

- 빈 줄 / `#` 주석 / 앞뒤 공백 허용
- 중복 URL 자동 제거
- 카테고리 미지정시 Naver 카테고리에서 자동 추론

## 후보 추가 (AddDialog)

화면 우상단 **"+ 후보 추가"** 버튼 → Naver 지도 단축 URL 입력:

1. **미리보기**: Naver 페이지에서 이름·전화번호·대표 메뉴 3개 자동 추출
2. **자동 geocode**: 미리보기 후 주소를 NCP Maps Geocode API로 좌표 변환
3. **저장 시 동작**:
   - Supabase `lb_places` UPSERT → 카드 즉시 표시
   - GitHub `share_link` 에 URL append commit → GHA 자동 실행 → Naver 전체 데이터 보강

## 카드 상세 (PlaceDetail)

카드 클릭 시 슬라이드업 패널:
- 영업시간, 전화번호, 지도
- **대표 메뉴 chips** — Naver에서 수집한 메뉴 최대 5개 표시 (5개 초과 시 `+N개` 표시)
- 좋아요 / 댓글 / 스크랩

## 데이터 갱신 자동화 (GitHub Actions)

`share_link` 변경 시 GHA (`.github/workflows/fetch-places.yml`) 자동 실행:

1. `npm run fetch:places` — Naver 파싱 + `data/places.json` 갱신
2. Supabase `lb_places` UPSERT — 전화번호·메뉴·영업시간 등 보강
3. `data/places.json` commit (`[skip ci]` — 재귀 트리거 없음)

트리거 경로: `share_link`, `scripts/fetch-places.ts`, `lib/naver.ts`, `.github/workflows/fetch-places.yml`

수동 실행: GitHub → Actions → "Fetch places" → Run workflow (옵션: 캐시 무시)

> **참고**: Naver 는 데이터센터 IP 를 차단합니다. GitHub Actions 러너 IP 가
> 차단되면 워크플로우는 placeholder 카드만 생성합니다. 그래도 빌드는 통과.
> 차단시 fallback: 로컬에서 `npm run fetch:places` 실행 후 커밋.

## Vercel 배포

1. 저장소를 GitHub 에 푸시.
2. https://vercel.com/new → 이 저장소 import → 기본 설정 그대로 Deploy.
3. 환경 변수 설정 (위 목록 참조).
4. 이후 코드 변경 push 시 자동 재빌드.

**Production URL**: https://sik-dorak.vercel.app

### Vercel Ignored Build Step

`vercel.json`에 `ignoreCommand`로 `scripts/vercel-ignore.sh` 등록됨.

`share_link` / `data/places.json` / `data/places.overrides.json` **만** 변경된 커밋은 Vercel 빌드를 자동 **스킵**합니다. GHA가 주기적으로 `data/places.json` 을 커밋하더라도 Vercel 빌드 한도에 영향 없음.

코드 파일 (`lib/`, `app/`, `components/` 등) 변경 시에는 정상 빌드.

권장 설정:
- **Build Region**: `icn1` (서울) — Naver 차단 회피 가능성 높음.
- **Env Vars** (선택): Naver 가 자주 차단되면 `SKIP_FETCH=1` 토글.

## Naver 봇 차단 우회

- Cache-first — 이미 처리된 URL 은 재수집하지 않음 (신규만 처리).
- 실제 Chrome 헤더 셋 (`User-Agent`, `sec-ch-ua`, `Accept-Language` 등) + UA 풀 라운드로빈.
- 403/429 → exponential backoff + jitter, URL 간 랜덤 sleep.
- 다중 엔드포인트 시도: `restaurant/<id>/home` → `place/<id>/home` → `cafe/<id>/home`.
- 추출 fallback: `__APOLLO_STATE__` → JSON-LD → OG meta → 캐시 → 시드.
- 모든 레이어 실패시 빌드는 통과 (`process.exit(0)`), 카드에 "데이터 갱신 필요" 배지 표시.

## 디렉토리

```
.
├── app/
│   ├── page.tsx                    # 메인 페이지 (Supabase SELECT, force-dynamic)
│   └── api/places/
│       ├── add/route.ts            # 후보 추가 (Supabase UPSERT + GitHub commit)
│       ├── edit/route.ts           # 편집 (lb_place_overrides UPSERT)
│       ├── delete/route.ts         # 삭제 (lb_places DELETE + share_link 제거)
│       ├── like/route.ts           # 좋아요 토글
│       ├── comment/route.ts        # 댓글 CRUD
│       ├── scrap/route.ts          # 스크랩 토글
│       └── preview/route.ts        # AddDialog 미리보기 (Naver 파싱)
├── components/
│   ├── board.tsx                   # 카드 그리드 + 소셜 상태 관리
│   ├── place-detail.tsx            # 상세 패널 (메뉴 chips 포함)
│   └── add-dialog.tsx              # 후보 추가 다이얼로그 (자동 채움 + geocode)
├── lib/
│   ├── naver.ts                    # Naver 파서 (Apollo state, JSON-LD, OG)
│   ├── supabase.ts                 # Supabase 클라이언트 (anon + admin)
│   ├── types.ts                    # Place, MenuItem, 공유 타입
│   └── admin-auth.ts               # 관리자 인증 (timing-safe)
├── scripts/
│   ├── fetch-places.ts             # 독립 실행 수집기 (Naver → JSON + Supabase)
│   └── vercel-ignore.sh            # Vercel Ignored Build Step
├── data/
│   ├── places.json                 # GHA 생성 캐시 (fallback용)
│   └── places.overrides.json       # 수동 보정 (레거시, lb_place_overrides로 이전)
├── share_link                      # URL 목록 (append-only)
└── vercel.json                     # ignoreCommand 설정
```
