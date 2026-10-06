# 전사의 여정

브라우저에서 돌아가는 3D 액션 게임 (WebGL2, 외부 라이브러리 없음). 기사가 숲과 수정 동굴을 지나 보스 바위 골렘과 싸웁니다.

## 바로 해 보기

```bash
python3 tools/serve.py      # http://localhost:8000 을 브라우저로 열기
```

`index.html`을 파일로 바로 열면 브라우저 보안 때문에 안 될 수 있어서, 위 테스트 서버로 여는 것이 안전합니다.

## 이어서 만들기

- **`PROGRESS.md`에 모든 것이 정리되어 있습니다**: 조작, 파일별 역할, 지금까지 한 일, 다음 할 일, 아티팩트 갱신 방법.
- 밸런스·그래픽 숫자: `js/config.js`, 테마별 색·조명·화면 마무리: `js/render.js`의 `LIGHTING`.
- 새 스크립트 파일을 추가하면 `index.html`과 `artifact.html`의 `<script>` 목록을 둘 다 고쳐 주세요.
- Claude Code에서 이어 갈 때: 이 폴더를 열고 "PROGRESS.md 읽고 이어서 만들어 줘"라고 하면 됩니다.
- 저장소: `git remote -v`로 원래 GitHub 주소를 확인할 수 있습니다 (작업 브랜치 `claude/awesome-tesla-94irri`).

## 폴더

| 경로 | 내용 |
|---|---|
| `index.html` / `artifact.html` | 브라우저용 / Claude 아티팩트용 시작 파일 |
| `js/` | 게임 코드 전부 |
| `tools/` | 테스트 서버, 헤드리스 크롬 스크린샷 도구 |
| `.claude/shots/ref/` | 그래픽 참고 그림 (야숨·왕눈) |
| `.claude/shots/final/` | 최근 화면 (zip에만 들어 있음) |
