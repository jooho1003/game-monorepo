import { unlockAudio } from "../audio/audio-manager.js";
import { useGameStore } from "../store/game-store.js";

export function TitleScreen() {
  const highestFloor = useGameStore((state) => state.snapshot.highestFloor);
  const hasSave = useGameStore((state) => state.snapshot.seed !== 0);
  const dispatch = useGameStore((state) => state.dispatch);

  const startNewGame = () => {
    unlockAudio();
    dispatch({ type: "OPEN_SELECT" });
  };

  const loadGame = () => {
    if (!hasSave) return;
    unlockAudio();
    dispatch({ type: "LOAD_GAME" });
  };

  return (
    <main className="title-screen">
      <section className="title-panel" aria-labelledby="game-title">
        <div className="title-panel__sigil" aria-hidden="true">
          <i />
        </div>
        <p className="title-panel__overtitle">THE LAST ASCENT</p>
        <h1 id="game-title">종말의 탑</h1>
        <p className="title-panel__subtitle">TOWER OF THE END</p>

        <div className="floor-record" aria-label="탑 진행도">
          <span>HIGHEST FLOOR</span>
          <strong>{highestFloor.toString().padStart(2, "0")}</strong>
          <i />
          <span>DESTINATION</span>
          <strong>50</strong>
        </div>

        <nav className="title-menu" aria-label="메인 메뉴">
          <button
            className="title-menu__button"
            type="button"
            onClick={startNewGame}
          >
            <span>NEW GAME</span>
            <small>새로운 도전</small>
          </button>
          <button
            className="title-menu__button"
            type="button"
            disabled={!hasSave}
            aria-describedby={!hasSave ? "load-game-status" : undefined}
            onClick={loadGame}
          >
            <span>LOAD GAME</span>
            <small>{hasSave ? "이어하기" : "저장된 여정 없음"}</small>
          </button>
        </nav>

        <p className="title-panel__hint" id="load-game-status">
          {hasSave
            ? "지난 여정이 휴식처에 보존되어 있습니다."
            : "새 게임을 시작하면 여정이 자동으로 저장됩니다."}
        </p>
      </section>

      <p className="title-screen__edition">P0 PLAYABLE BUILD · 2026</p>
    </main>
  );
}
