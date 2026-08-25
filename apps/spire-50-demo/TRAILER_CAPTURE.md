# 트레일러 캡처 모드

개발 서버에서 `capture=trailer`를 사용하면 실제 플레이 장면을 반복 촬영할 수
있는 고정 상태로 시작합니다. 캡처 모드는 개발 빌드에서만 활성화되며 게임의
일반 저장 데이터는 시작 장면에 영향을 주지 않습니다.

```text
http://localhost:5174/?capture=trailer&captureScene=battle&captureHud=clean&captureWeapon=longsword&captureRole=ally
```

## 파라미터

| 파라미터 | 값 | 설명 |
| --- | --- | --- |
| `captureScene` | `title`, `loadout`, `dialogue`, `rest`, `battle`, `shop`, `boss` | 촬영 시작 장면 |
| `captureHud` | `full`, `clean`, `none` | HUD 노출 단계 |
| `captureWeapon` | `longsword`, `dagger`, `shield`, `bow`, `staff` | 시작 무기 |
| `captureRole` | `ally`, `enemy` | 1층 방랑자 관계 |

`clean`은 조작표·개발 빌드 문구·긴 상태 알림을 제거하면서 HP, 목표, 스킬과
보스 임무 UI는 유지합니다. `none`은 순수 월드 장면을 위한 설정입니다.

5층 촬영에는 기존 개발 옵션을 함께 사용할 수 있습니다.

```text
?capture=trailer&captureScene=boss&captureHud=clean&debugSpawn=cyclops&debugMissionInvulnerable=1&missionSeconds=300
```

원본 클립을 `.trailer-capture/raw`에 준비한 뒤 저장소 루트에서 다음 명령으로
메인 및 SNS 편집본을 다시 렌더링합니다.

```powershell
pnpm --filter=spire-50-demo dev
powershell -ExecutionPolicy Bypass -File apps/spire-50-demo/tools/render-trailers.ps1
```

완성본은 `deliverables/trailers`에 생성됩니다.
