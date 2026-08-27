import { useState } from "react";
import { useGameStore } from "../../store/game-store.js";

export function PauseMenu({ onClose }: { onClose: () => void }) {
  const dispatch = useGameStore((state) => state.dispatch);
  const [quitBlocked, setQuitBlocked] = useState(false);

  const quitGame = () => {
    window.close();
    window.setTimeout(() => setQuitBlocked(true), 150);
  };

  return (
    <div
      className="game-panel-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="pause-menu"
        role="dialog"
        aria-modal="true"
        aria-label="일시 정지 메뉴"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">THE END'S TOWER</p>
        <h2>잠시 멈춤</h2>
        <div className="pause-menu__actions">
          <button type="button" onClick={quitGame}>
            게임 종료
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "RETURN_TITLE" })}
          >
            타이틀로 가기
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "OPEN_SELECT" })}
          >
            다른 캐릭터 체험하기
          </button>
        </div>
        {quitBlocked ? (
          <em>브라우저가 창 닫기를 막았습니다. 탭을 직접 닫아 주세요.</em>
        ) : null}
        <small>ESC 또는 바깥 클릭으로 게임으로 돌아갑니다.</small>
      </section>
    </div>
  );
}
