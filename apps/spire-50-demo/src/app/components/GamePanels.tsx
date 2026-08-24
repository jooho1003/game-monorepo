import { getWeaponDefinition } from "../../config/weapons.js";
import { getItemPresentation } from "../../config/items.js";
import {
  HP_REGEN_PER_MINUTE,
  MP_REGEN_PER_MINUTE,
} from "../../domain/engine.js";
import { useGameStore } from "../../store/game-store.js";

export type GamePanelId = "skills" | "inventory" | "character";

export function GamePanels({
  panel,
  onClose,
}: {
  panel: GamePanelId;
  onClose: () => void;
}) {
  const title =
    panel === "skills"
      ? "스킬 트리"
      : panel === "inventory"
        ? "아이템 가방"
        : "캐릭터 상태";

  return (
    <div
      className="game-panel-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="game-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="game-panel__header">
          <div>
            <p>ERN · TOWER RECORD</p>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={`${title} 닫기`}>
            ESC
          </button>
        </header>
        {panel === "skills" ? <SkillTree /> : null}
        {panel === "inventory" ? <Inventory /> : null}
        {panel === "character" ? <CharacterStatus /> : null}
      </section>
    </div>
  );
}

function SkillTree() {
  const weaponId = useGameStore((state) => state.snapshot.weapon);
  const level = useGameStore((state) => state.snapshot.level);
  const skillPoints = useGameStore((state) => state.snapshot.skillPoints);
  const skillUnlocked = useGameStore((state) => state.snapshot.skillUnlocked);
  const weapon = getWeaponDefinition(weaponId);
  return (
    <div className="skill-tree">
      <div className="skill-tree__summary">
        <p>스킬에 마우스를 올리거나 Tab으로 선택하면 상세 설명을 확인할 수 있습니다.</p>
        <span>보유 스킬 포인트</span>
        <strong>{skillPoints}</strong>
      </div>
      <div className="skill-tree__path" aria-label="스킬 성장 경로">
        <article
          className={skillUnlocked ? "is-unlocked" : "is-locked"}
          tabIndex={0}
          aria-describedby="primary-skill-tooltip"
        >
          <img className="skill-tree__icon" src={weapon.skillIcon} alt="" />
          <strong>{weapon.skill}</strong>
          <span>
            {skillUnlocked ? "사용 가능 · MP 25" : "관리자 대화 필요"}
          </span>
          <div
            className="skill-tooltip"
            id="primary-skill-tooltip"
            role="tooltip"
          >
            <em>{weapon.role}</em>
            <strong>{weapon.skill}</strong>
            <p>{weapon.skillDescription}</p>
            <small>{weapon.skillEffect}</small>
          </div>
        </article>
        <b aria-hidden="true" />
        <article
          className={level >= 3 ? "is-unlocked" : "is-locked"}
          tabIndex={0}
          aria-describedby="focus-skill-tooltip"
        >
          <i>Ⅱ</i>
          <strong>집중 강화</strong>
          <span>Lv.3 · 주력 스킬 피해 강화</span>
          <div
            className="skill-tooltip"
            id="focus-skill-tooltip"
            role="tooltip"
          >
            <em>패시브 강화</em>
            <strong>집중 강화</strong>
            <p>선택한 무기의 주력 스킬 피해량을 20% 높입니다.</p>
            <small>해금 조건 · Lv.3</small>
          </div>
        </article>
        <b aria-hidden="true" />
        <article
          className={level >= 5 ? "is-unlocked" : "is-locked"}
          tabIndex={0}
          aria-describedby="resonance-skill-tooltip"
        >
          <i>Ⅲ</i>
          <strong>탑의 공명</strong>
          <span>Lv.5 · 마력 회복과 범위 강화</span>
          <div
            className="skill-tooltip"
            id="resonance-skill-tooltip"
            role="tooltip"
          >
            <em>패시브 강화</em>
            <strong>탑의 공명</strong>
            <p>스킬 범위를 넓히고 사용 직후 마력을 일부 회복합니다.</p>
            <small>해금 조건 · Lv.5</small>
          </div>
        </article>
      </div>
    </div>
  );
}

function Inventory() {
  const inventory = useGameStore((state) => state.snapshot.inventory);
  return (
    <div className="inventory-grid">
      {inventory.map((item) => (
        <article key={item.id}>
          <div
            className="inventory-grid__icon"
            style={{ borderColor: getItemPresentation(item.id).tone }}
          >
            <img src={getItemPresentation(item.id).icon} alt="" />
          </div>
          <div>
            <strong>{item.name}</strong>
            <p>{item.description}</p>
          </div>
          <span>× {item.quantity}</span>
        </article>
      ))}
      {Array.from({ length: Math.max(0, 6 - inventory.length) }, (_, index) => (
        <div
          className="inventory-grid__empty"
          key={`empty-${index}`}
          aria-label="빈 칸"
        />
      ))}
    </div>
  );
}

function CharacterStatus() {
  const level = useGameStore((state) => state.snapshot.level);
  const floor = useGameStore((state) => state.snapshot.floor);
  const hp = useGameStore((state) => state.snapshot.hp);
  const mp = useGameStore((state) => state.snapshot.mp);
  const gold = useGameStore((state) => state.snapshot.gold);
  const weaponId = useGameStore((state) => state.snapshot.weapon);
  const weapon = getWeaponDefinition(weaponId);
  const attack = weapon.stats.attack + (level - 1) * 3;
  const defense = weapon.stats.defense + (level - 1) * 2;
  const speed = weapon.stats.speed + level - 1;
  const rows = [
    ["레벨", level],
    ["현재 층", `${floor}층`],
    ["장착 무기", weapon.name],
    ["공격", attack],
    ["방어", defense],
    ["속도", speed],
    ["HP", `${Math.round(hp)} / 100`],
    ["MP", `${Math.round(mp)} / 100`],
    ["소지 골드", gold],
  ] as const;
  return (
    <div className="character-status">
      <div className="character-status__portrait">
        <img src="/assets/game/hud/ern-icon.png" alt="에른" />
        <strong>에른</strong>
        <span>
          HP +{HP_REGEN_PER_MINUTE}/분 · MP +{MP_REGEN_PER_MINUTE}/분
        </span>
      </div>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
