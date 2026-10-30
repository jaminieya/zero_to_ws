# 오늘의 명전 서버

포지션별 레전드 점수 탑10을 24시간 동안 보관하는 서버입니다. Node.js 기본 모듈만 쓰므로 `npm install`이 필요 없습니다.

## 실행

```bash
node server/hof-server.js
# → 오늘의 명전 서버: http://localhost:8787/hof
```

환경 변수:

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `8787` | 포트 |
| `HOF_FILE` | `server/hof-data.json` | 기록 저장 파일 |
| `ALLOW_ORIGIN` | `*` | 게임이 올라간 주소만 허용하려면 예: `https://example.com` |

계속 켜 두려면 `pm2 start server/hof-server.js --name hof` 또는 systemd 서비스로 등록하세요.

## 게임과 연결

`index.html`에서 주소를 넣습니다.

```js
const HOF_KEY='b2ws_hof_day',HOF_TTL=24*3600*1000,HOF_API='https://내도메인/hof';
```

게임이 `https://`로 서비스되면 서버도 `https://`여야 합니다(브라우저가 http 요청을 막습니다). nginx 같은 리버스 프록시로 `/hof`를 `http://localhost:8787/hof`에 연결하면 됩니다.

## API

- `GET /hof` → `{ "C": [...], "CI": [...], "MI": [...], "OF": [...], "DH": [...], "SP": [...], "MR": [...], "CL": [...] }`
- `POST /hof` (기록 1개, JSON) → `{ "rank": 1~10 또는 0, "board": {...} }`

규칙: 포지션별 점수순 탑10만 저장하고, 탑10에 못 들면 저장하지 않습니다. 각 기록은 서버가 받은 시각부터 24시간 뒤 사라집니다. 이름·점수 등은 서버에서 범위를 검사하고, IP당 1분에 등록 10번까지 받습니다.
