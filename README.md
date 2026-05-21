# Local Bites — 맛집 정보판

가족여행 맛집 후보를 한 화면에서 함께 정하는 보드. Naver 지도 단축 링크를 `share_link` 파일에 추가하면 카드로 자동 표시됩니다.

## 아키텍처

- **`share_link`** — 사용자가 직접 관리하는 텍스트 파일. 한 줄에 하나의 `https://naver.me/XXXX` URL. 필요시 ` | 식당|카페|기타` 카테고리 지정.
- **`scripts/fetch-places.ts`** — 완전 독립 실행 스크립트. `share_link` 를 읽고 Naver 페이지를 파싱해 `data/places.json` 으로 저장.
- **`data/places.json`** — 화면에서 그대로 import 해 읽기만 하는 단일 데이터 소스.
- **`app/page.tsx`** — 위 JSON 을 import 해서 카드 그리드 렌더. 런타임 fetch 없음.

## 로컬 개발

```bash
npm install
npm run fetch:places   # share_link → data/places.json (선택, 데이터 갱신용)
npm run dev            # http://localhost:3000
```

스크립트는 빌드와 분리되어 있어 언제든 단독 실행 가능. 화면은 `data/places.json` 만 읽으므로 fetch 실패와 무관하게 동작합니다.

### 환경 변수

| 변수 | 기본 | 설명 |
| ---- | ---- | ---- |
| `FORCE_REFETCH` | `0` | `1` 이면 캐시 무시하고 모든 항목 재수집 (기본은 한 번 처리된 URL 은 건너뜀) |
| `SKIP_FETCH` | `0` | `1` 이면 `data/places.json` 그대로 유지 |
| `MAX_FETCHES_PER_BUILD` | `50` | 빌드당 최대 Naver 호출 횟수 |
| `GITHUB_TOKEN` | — | **(필수)** 페이지에서 "후보 추가"·관리자 편집/삭제 시 GitHub Contents API 로 commit 하기 위한 토큰. 권한: `contents:write` |
| `GITHUB_REPO_OWNER` | `siksik-e0-0` | 저장소 owner |
| `GITHUB_REPO_NAME` | `local-bites` | 저장소 이름 |
| `GITHUB_BRANCH` | `main` | 저장 대상 브랜치 |
| `ADMIN_PASSWORD` | — | **(필수)** 헤더의 "관리자" 버튼 인증에 사용. 일치 시 카드 편집/삭제 기능 활성화. |
| `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` | — | **(필수)** 페이지 하단 지도 렌더링에 사용하는 Naver Maps v3 Client ID. Naver Cloud Platform → Maps → Application 등록 → Web 서비스 URL 에 배포 도메인 등록 후 발급. |

### Vercel에 GITHUB_TOKEN 설정하기

1. GitHub → Settings → Developer settings → **Personal access tokens (Fine-grained)** → Generate new token
2. Repository access: `local-bites` 만 선택
3. Permissions → **Contents: Read and write**
4. Generate → 토큰 복사
5. Vercel → Project → Settings → Environment Variables → `GITHUB_TOKEN` = 위 토큰 (Production / Preview / Development 모두 체크)
6. Redeploy

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

## 데이터 갱신 자동화 (GitHub Actions)

`share_link` 가 변경되면 GitHub Actions (`.github/workflows/fetch-places.yml`) 이
자동으로 `npm run fetch:places` 를 실행하고 `data/places.json` 을 커밋합니다.
사용자는 `share_link` 만 편집 → push 하면 됩니다.

- 트리거: `share_link`, `scripts/fetch-places.ts`, `lib/naver.ts` 변경시
- 수동 실행: GitHub → Actions → "Fetch places" → Run workflow (옵션: 캐시 무시)
- 권한: 워크플로우가 `contents: write` 로 직접 커밋 (별도 PAT 불필요)
- 커밋 메시지에 `[skip ci]` 가 있어 재귀 트리거 없음

> **참고**: Naver 는 데이터센터 IP 를 차단합니다. GitHub Actions 러너 IP 가
> 차단되면 워크플로우는 placeholder 카드만 생성합니다. 그래도 빌드는 통과.
> 차단시 fallback: 로컬에서 `npm run fetch:places` 실행 후 커밋.

## Vercel 배포

1. 저장소를 GitHub 에 푸시.
2. https://vercel.com/new → 이 저장소 import → 기본 설정 그대로 Deploy.
3. **Production Branch 설정**: 기본은 `main`. 작업 브랜치에서 작업 중이라면
   Vercel Project Settings → Git → Production Branch 를 해당 브랜치로 변경,
   또는 작업 브랜치를 `main` 에 머지.
4. 이후 `share_link` 변경/push 시 자동 재빌드.

권장 설정:
- **Build Region**: `icn1` (서울) — Naver 차단 회피 가능성 높음.
- **Env Vars** (선택): Naver 가 자주 차단되면 `SKIP_FETCH=1` 토글.

## Naver 봇 차단 우회

- Cache-first (24h TTL) → 빌드마다 모든 항목을 다시 두드리지 않음.
- 실제 Chrome 헤더 셋 (`User-Agent`, `sec-ch-ua`, `Accept-Language` 등) + UA 풀 라운드로빈.
- 403/429 → exponential backoff + jitter, URL 간 랜덤 sleep.
- 다중 엔드포인트 시도: `restaurant/<id>/home` → `place/<id>/home` → `cafe/<id>/home`.
- 추출 fallback: `__APOLLO_STATE__` → JSON-LD → OG meta → 캐시 → 시드.
- 모든 레이어 실패시 빌드는 통과(`process.exit(0)`), 카드에 "데이터 갱신 필요" 배지 표시.

## 디렉토리

```
.
├── app/                    # Next.js App Router
├── components/             # UI
├── lib/                    # naver 파서, 타입
├── scripts/fetch-places.ts # 독립 실행 데이터 수집기
├── data/
│   ├── places.json         # 화면이 import 하는 단일 소스
│   └── places.seed.json    # 콜드 부트 fallback
└── share_link              # 사용자가 append 하는 URL 목록
```
