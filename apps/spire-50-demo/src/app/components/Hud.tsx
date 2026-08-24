import { getWeaponDefinition } from "../../config/weapons.js";
import {
  HP_REGEN_PER_MINUTE,
  MP_REGEN_PER_MINUTE,
} from "../../domain/engine.js";
import { useGameStore } from "../../store/game-store.js";

const zoneNames = {
  rest: "탑 휴식처",
  battle: "탑 공략장소",
  shop: "아이템 상점",
} as const;

export function Hud() {
  const floor = useGameStore((state) => state.snapshot.floor);
  const zone = useGameStore((state) => state.snapshot.zone);
  const level = useGameStore((state) => state.snapshot.level);
  const experience = useGameStore((state) => state.snapshot.experience);
  const experienceToNextLevel = useGameStore(
    (state) => state.snapshot.experienceToNextLevel,
  );
  const hp = useGameStore((state) => state.snapshot.hp);
  const mp = useGameStore((state) => state.snapshot.mp);
  const gold = useGameStore((state) => state.snapshot.gold);
  const objective = useGameStore((state) => state.snapshot.objective);
  const notice = useGameStore((state) => state.snapshot.notice);
  const skillUnlocked = useGameStore((state) => state.snapshot.skillUnlocked);
  const weaponId = useGameStore((state) => state.snapshot.weapon);
  const weapon = getWeaponDefinition(weaponId);

  return (
    <>
      <section className="hud-status" aria-label="플레이어 상태">
        <div className="hud-status__avatar">
          <img src="/assets/game/hud/ern-icon.png" alt="에른" />
        </div>
        <div className="hud-status__bars">
          <div className="hud-status__identity">
            <strong>에른</strong>
            <span>Lv.{level}</span>
          </div>
          <Meter label="HP" value={hp} tone="hp" />
          <Meter label="MP" value={mp} tone="mp" />
          <div className="regen-rate">
            HP +{HP_REGEN_PER_MINUTE}/분 · MP +{MP_REGEN_PER_MINUTE}/분
          </div>
          <ExperienceMeter
            value={experience}
            required={experienceToNextLevel}
          />
        </div>
        <div className="hud-status__gold">
          <span>◆</span> {gold}
        </div>
      </section>

      <section className="hud-objective">
        <p>
          탑 {floor}층 <i /> {zoneNames[zone]}
        </p>
        <strong>{objective}</strong>
        <span>{notice}</span>
      </section>

      <section className="skill-slot" aria-label="스킬 상태">
        <div className={skillUnlocked ? "is-ready" : "is-locked"}>
          <kbd>1</kbd>
          <img src={weapon.skillIcon} alt="" />
          <span>
            <strong>{skillUnlocked ? weapon.skill : "잠김"}</strong>
            <small>{skillUnlocked ? "MP 25" : "관리자 대화"}</small>
          </span>
        </div>
      </section>
    </>
  );
}

function ExperienceMeter({
  value,
  required,
}: {
  value: number;
  required: number;
}) {
  const percentage = Math.min(100, (value / required) * 100);
  return (
    <div
      className="experience-meter"
      aria-label={`경험치 ${value} / ${required}`}
    >
      <span>EXP</span>
      <div>
        <i style={{ width: `${percentage}%` }} />
        <strong>
          {Math.floor(value)} / {required}
        </strong>
      </div>
    </div>
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
