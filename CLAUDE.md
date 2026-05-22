# local-bites — Claude Code 지시사항

## 워크플로우: 자동 PR + 머지

모든 코드 변경은 사용자 확인 없이 자동으로 다음 순서로 진행:

1. 변경사항 commit
2. `claude/dreamy-volta-GayKF` 브랜치로 push
3. main 대상 PR 생성 (또는 기존 열린 PR 재사용)
4. CI 통과 후 squash 머지

예외 (사용자 확인 필요):
- 파괴적 git 작업 (force push, reset --hard 등)
- 환경변수 / 시크릿 변경
- 새 의존성 추가 시 라이선스/보안 우려가 있는 경우
- 데이터 파일 (data/places.json, data/places.overrides.json) 충돌 해결 시 어느 쪽을 택할지 불분명한 경우

## 브랜치

- 개발 브랜치: `claude/dreamy-volta-GayKF`
- 머지 대상: `main`

## 머지 충돌

`data/places.json` 충돌은 보통 양쪽이 v2 스키마로 다른 시점에 refetch 된 결과
→ 더 최근 `generatedAt` 타임스탬프 가진 쪽 채택

## data/places.json 은 main 에서만 갱신됨

`.github/workflows/fetch-places.yml` 는 `branches: [main]` 으로 제한되어 있음.
feature branch (claude/dreamy-volta-GayKF) 에서는 **절대로** `data/places.json`
을 직접 commit 하지 말 것. 갱신이 필요하면 PR 머지 후 main 에서 자동 실행되는
워크플로우에 맡길 것. 이 규칙을 어기면 양쪽 브랜치가 places.json 을 동시
수정해서 PR 머지 시 충돌 발생.

## 환경

- production URL: `https://local-bites-pied.vercel.app`
- 프리뷰 URL 패턴: `local-bites-git-claude-dreamy-volta-gaykf-siksik-e0-0s-projects.vercel.app`
- 두 URL 모두 NCP Maps Application 의 Web 서비스 URL 에 등록되어야 지도가 동작
