# game-monorepo

여러 웹 게임을 한 저장소에서 개발하고, 엔진 독립적인 공통 로직은 `packages/`로 묶어
재사용하는 모노레포. pnpm workspaces + Turborepo 기반, 게임은 TypeScript + Phaser + Vite.

## 구조

```
game-monorepo/
├── apps/                    # 개별 게임 (각각 독립 배포)
│   └── sample-game/         # 예시: 클리커 게임 (Phaser + Vite, 포트 5173)
├── packages/
│   ├── game-core/           # @game/core — 엔진 독립 로직 (시드 RNG, 점수/콤보, 수학 유틸)
│   └── typescript-config/   # @game/typescript-config — 공용 tsconfig
├── pnpm-workspace.yaml
└── turbo.json
```

## 명령어

```bash
pnpm install                  # 전체 의존성 설치
pnpm dev --filter=sample-game # 특정 게임 dev 서버
pnpm build                    # 전체 빌드 (turbo 캐시)
pnpm test                     # game-core 단위 테스트 (vitest)
pnpm typecheck                # 전체 타입 체크
```

## 새 게임 추가하기

1. `apps/sample-game`을 `apps/<이름>`으로 복사하고 `package.json`의 name·포트 수정
2. 공통 로직이 필요하면 dependencies에 `"@game/core": "workspace:*"`
3. `pnpm install` 후 `pnpm dev --filter=<이름>`

## 공통 코드 규칙

- `@game/core`에는 **Phaser(엔진)에 의존하지 않는 순수 로직만** 넣는다 —
  난수, 점수 계산, 물리/수학 유틸, 저장 포맷, 밸런스 수치 등.
  엔진 독립이어야 vitest로 즉시 테스트되고, 나중에 다른 엔진으로 갈아타도 재사용된다.
- 게임 로직에서 `Math.random()` 금지 — `createRng(seed)`를 쓴다.
  시드만 알면 플레이가 재현되므로 리플레이·디버깅·테스트가 쉬워진다.
- Phaser 씬/렌더링 코드는 각 게임 안에 둔다. 여러 게임이 같은 씬 패턴을 공유하게 되면
  그때 `packages/game-phaser` 같은 엔진 의존 공용 패키지를 새로 만든다.

## 배포

정적 사이트라 어디든 올릴 수 있다. Vercel이면 게임마다 프로젝트를 만들고
Root Directory를 `apps/<이름>`으로 지정 (Framework: Vite).
