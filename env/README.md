# 앱 환경 파일

가게 앱과 라이더 앱이 함께 쓴다. 빌드할 때 하나를 골라 넘기면 그 빌드가 볼 서버가 정해진다.

```bash
flutter run --dart-define-from-file=../env/local.json      # 앱 폴더(customer-app, driver-app)에서
```

| 파일 | 쓰는 곳 | 서버 주소(API_BASE_URL) 규칙 |
| --- | --- | --- |
| `local.json` | 시뮬레이터·에뮬레이터, USB로 연결한 기기 | 아무 주소나 (비우면 `http://localhost:4000/api`) |
| `device.json` | 기기에 설치해 시험 | HTTPS, 또는 같은 와이파이의 사설 IP(`http://192.168.x.x:4000/api` 등) |
| `prod.json` | 스토어 배포 | HTTPS만 (터널 주소는 안 된다). **비어 있음** — 운영 도메인이 정해지면 넣는다 |

세 파일 모두 카카오 지도 SDK의 네이티브 앱 키를 앱마다 따로 담는다 — `KAKAO_CUSTOMER_APP_KEY`(가게 앱), `KAKAO_DRIVER_APP_KEY`(라이더 앱). 카카오 콘솔에서 키마다 그 앱의 패키지명·키 해시·번들 ID를 등록한다. 앱에 들어가는 키라 숨길 값은 아니다.

주소가 비었거나 규칙에 맞지 않는 빌드는 켜지자마자 이유를 띄우고 멈춘다. 규칙은 `packages/movo_api/lib/src/environment.dart`, 쓰는 법은 각 앱 README의 '서버 연결'.
