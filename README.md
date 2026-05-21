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
| `FORCE_REFETCH` | `0` | `1` 이면 캐시 무시하고 모든 항목 재수집 |
| `SKIP_FETCH` | `0` | `1` 이면 `data/places.json` 그대로 유지 |
| `CACHE_TTL_HOURS` | `24` | 캐시 유효 시간 |
| `MAX_FETCHES_PER_BUILD` | `30` | 빌드당 최대 Naver 호출 횟수 |
| `NEXT_PUBLIC_REPO_EDIT_URL` | `https://github.com/siksik-e0-0/local-bites/edit/main/share_link` | "share_link 편집" 버튼이 여는 URL |

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

## Vercel 배포

1. 저장소를 GitHub에 푸시.
2. https://vercel.com/new → 이 저장소 import → 기본 설정 그대로 Deploy.
3. 이후 `share_link` 변경/push 시 자동 재빌드 (`prebuild` 훅이 `npm run fetch:places` 실행).

권장 설정:
- **Build Region**: `icn1` (서울) — Naver 차단 회피.
- **Env Vars** (선택): Naver 가 자주 차단되면 `SKIP_FETCH=1` 토글 후 로컬에서 갱신해 푸시.

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
