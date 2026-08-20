import { unlockAudio } from "../audio/audio-manager.js";
import { useGameStore } from "../store/game-store.js";

export function TitleScreen() {
  const highestFloor = useGameStore((state) => state.snapshot.highestFloor);
  const dispatch = useGameStore((state) => state.dispatch);

  const start = () => {
    unlockAudio();
    dispatch({ type: "OPEN_SELECT" });
  };

  return (
    <main className="title-screen">
      <div className="title-screen__mist title-screen__mist--back" />
      <div className="tower" aria-hidden="true">
        <div className="tower__crown" />
        <div className="tower__body">
          {Array.from({ length: 11 }, (_, index) => (
            <i key={index} />
          ))}
        </div>
      </div>
      <div className="title-screen__mist title-screen__mist--front" />

      <section className="title-panel" aria-labelledby="game-title">
        <p className="eyebrow">A TOWERBOUND ROGUELIKE</p>
        <h1 id="game-title">
          <span>제50</span>첨탑
        </h1>
        <p className="title-panel__subtitle">THE FIFTIETH SPIRE</p>
        <div className="floor-record" aria-label="탑 진행도">
          <span>현재 최고</span>
          <strong>{highestFloor}F</strong>
          <i />
          <span>최종 목표</span>
          <strong>50F</strong>
        </div>
        <button className="brush-button" type="button" onClick={start}>
          <span>게임 시작</span>
          <small>NEW ASCENT</small>
        </button>
        <p className="title-panel__hint">
          P0 PLAYABLE BUILD · 키보드와 마우스를 사용합니다
        </p>
      </section>
    </main>
  );
}
