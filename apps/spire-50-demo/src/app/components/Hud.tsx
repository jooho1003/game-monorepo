import {
  SKILL2_MANA_COST,
  getSkill2Definition,
  skill2IconPath,
} from "../../config/skills.js";
import { getWeaponDefinition } from "../../config/weapons.js";
import {
  HP_REGEN_PER_MINUTE,
  MP_REGEN_PER_MINUTE,
  SKILL2_MAX_LEVEL,
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
  const skillPoints = useGameStore((state) => state.snapshot.skillPoints);
  const skill2Level = useGameStore((state) => state.snapshot.skill2Level);
  const dispatch = useGameStore((state) => state.dispatch);
  const weaponId = useGameStore((state) => state.snapshot.weapon);
  const weapon = getWeaponDefinition(weaponId);
  const skill2 = getSkill2Definition(weaponId);
  const canAllocate = skillPoints > 0 && skill2Level < SKILL2_MAX_LEVEL;

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
        {(skillPoints > 0 || skill2Level > 0) && (
          <div className="skill-points" aria-label="스킬 포인트">
            <strong>스킬 포인트 {skillPoints}</strong>
            <button
              type="button"
              disabled={!canAllocate}
              onClick={() =>
                dispatch({ type: "ALLOCATE_SKILL_POINT", skill: "skill2" })
              }
            >
              {skill2Level === 0
                ? `${skill2.name} 배우기`
                : skill2Level >= SKILL2_MAX_LEVEL
                  ? `${skill2.name} 최대 레벨`
                  : `${skill2.name} 강화 (Lv.${skill2Level} → ${skill2Level + 1})`}
            </button>
          </div>
        )}
        <div className={skillUnlocked ? "is-ready" : "is-locked"}>
          <kbd>1</kbd>
          <img src={weapon.skillIcon} alt="" />
          <span>
            <strong>{skillUnlocked ? weapon.skill : "잠김"}</strong>
            <small>{skillUnlocked ? "MP 25" : "관리자 대화"}</small>
          </span>
        </div>
        <div className={skill2Level > 0 ? "is-ready" : "is-locked"}>
          <kbd>2</kbd>
          <img src={skill2IconPath(weaponId)} alt="" />
          <span>
            <strong>
              {skill2Level > 0 ? `${skill2.name} Lv.${skill2Level}` : "잠김"}
            </strong>
            <small>
              {skill2Level > 0 ? `MP ${SKILL2_MANA_COST}` : "스킬 포인트 필요"}
            </small>
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
