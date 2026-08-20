import { useGameStore } from "../../store/game-store.js";

const zoneNames = {
  rest: "탑 휴식처",
  battle: "탑 공략장소",
  shop: "아이템 상점",
} as const;

export function Hud() {
  const snapshot = useGameStore((state) => state.snapshot);

  return (
    <>
      <section className="hud-status" aria-label="플레이어 상태">
        <div className="hud-status__avatar">E</div>
        <div className="hud-status__bars">
          <div className="hud-status__identity">
            <strong>에른</strong>
            <span>Lv.{snapshot.level}</span>
          </div>
          <Meter label="HP" value={snapshot.hp} tone="hp" />
          <Meter label="MP" value={snapshot.mp} tone="mp" />
        </div>
        <div className="hud-status__gold">
          <span>◆</span> {snapshot.gold}
        </div>
      </section>

      <section className="hud-objective">
        <p>
          탑 {snapshot.floor}층 <i /> {zoneNames[snapshot.zone]}
        </p>
        <strong>{snapshot.objective}</strong>
        <span>{snapshot.notice}</span>
      </section>

      <section className="skill-slot" aria-label="스킬 상태">
        <div className={snapshot.skillUnlocked ? "is-ready" : "is-locked"}>
          <kbd>1</kbd>
          <strong>{snapshot.skillUnlocked ? "첫 스킬" : "잠김"}</strong>
          <small>{snapshot.skillUnlocked ? "MP 25" : "관리자 대화"}</small>
        </div>
      </section>
    </>
  );
}

function Meter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "hp" | "mp";
}) {
  return (
    <div className={`meter meter--${tone}`}>
      <span>{label}</span>
      <div>
        <i style={{ width: `${value}%` }} />
        <strong>{Math.round(value)}/100</strong>
      </div>
    </div>
  );
}
