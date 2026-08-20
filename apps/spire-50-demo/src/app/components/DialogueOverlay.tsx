import { useEffect } from "react";
import { getWeaponDefinition } from "../../config/weapons.js";
import { useGameStore } from "../../store/game-store.js";

const dialogue = [
  "도전자여, 이곳은 종말의 탑 첫 번째 휴식처다. 정상은 아직 구름 너머에 있지.",
  "층마다 마주치는 방랑자를 경계해라. 네 편이 될 수도, 몬스터와 함께 달려들 수도 있다.",
  "네 무기에 첫 각인을 새겼다. 전투장에서 숫자 1을 눌러 그 힘을 시험해라.",
] as const;

export function DialogueOverlay() {
  const index = useGameStore((state) => state.snapshot.dialogueIndex);
  const weaponId = useGameStore((state) => state.snapshot.weapon);
  const dispatch = useGameStore((state) => state.dispatch);
  const weapon = getWeaponDefinition(weaponId);
  const line = dialogue[index] ?? dialogue[dialogue.length - 1];

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
    <section className="dialogue" aria-live="polite">
      <div className="dialogue__portrait" aria-hidden="true">
        <span>塔</span>
      </div>
      <div className="dialogue__body">
        <p>탑 관리자 · 오르반</p>
        <blockquote>{line}</blockquote>
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
