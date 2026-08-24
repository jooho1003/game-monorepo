import { useEffect } from "react";
import { getWeaponDefinition } from "../../config/weapons.js";
import { useGameStore } from "../../store/game-store.js";

const dialogue = [
  {
    speaker: "orban",
    name: "탑 관리자 · 오르반",
    line: "도전자여, 이곳은 The End's Tower의 첫 번째 휴식처다. 정상은 아직 구름 너머에 있지.",
  },
  {
    speaker: "ern",
    name: "초보 탐험가 · 에른",
    line: "이 탑의 방랑자들은 모두 적입니까? 혼자서 정상까지 가야 하는 건 아니겠죠?",
  },
  {
    speaker: "orban",
    name: "탑 관리자 · 오르반",
    line: "네 편이 될 자도, 몬스터와 함께 달려들 자도 있다. 네 무기에 첫 각인을 새겼으니 직접 확인해라.",
  },
] as const;

export function DialogueOverlay() {
  const index = useGameStore((state) => state.snapshot.dialogueIndex);
  const weaponId = useGameStore((state) => state.snapshot.weapon);
  const dispatch = useGameStore((state) => state.dispatch);
  const weapon = getWeaponDefinition(weaponId);
  const current = dialogue[index] ?? dialogue[dialogue.length - 1]!;
  const isPlayerTurn = current.speaker === "ern";

  useEffect(() => {
    const advance = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        dispatch({ type: "ADVANCE_DIALOGUE" });
      }
    };
    window.addEventListener("keydown", advance);
    return () => window.removeEventListener("keydown", advance);
  }, [dispatch]);

  return (
    <section
      className={`dialogue${isPlayerTurn ? " dialogue--player" : ""}`}
      aria-live="polite"
    >
      <figure className="dialogue__portrait" aria-hidden="true">
        <img
          src={
            isPlayerTurn
              ? "/assets/game/dialogue/ern.png"
              : "/assets/game/dialogue/orban.png"
          }
          alt=""
        />
      </figure>
      <div className="dialogue__body">
        <p>{current.name}</p>
        <blockquote>{current.line}</blockquote>
        {index === dialogue.length - 1 ? (
          <span className="dialogue__reward">해금 예정 · {weapon.skill}</span>
        ) : null}
      </div>
      <button
        className="dialogue__next"
        type="button"
        onClick={() => dispatch({ type: "ADVANCE_DIALOGUE" })}
      >
        {index === dialogue.length - 1 ? "스킬 받기" : "다음"}
        <small>SPACE</small>
      </button>
    </section>
  );
}
