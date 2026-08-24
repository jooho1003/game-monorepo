import { useEffect, useState } from "react";
import { playSfx, setMusicContext } from "../audio/audio-manager.js";
import { getWeaponDefinition, weaponDefinitions } from "../config/weapons.js";
import type { WeaponId } from "../domain/model.js";
import { useGameStore } from "../store/game-store.js";

export function SelectScreen() {
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponId>("longsword");
  const dispatch = useGameStore((state) => state.dispatch);
  const selected = getWeaponDefinition(selectedWeapon);

  useEffect(() => {
    setMusicContext("select");
    for (const weapon of weaponDefinitions) {
      const image = new Image();
      image.decoding = "async";
      image.src = weapon.characterImage;
    }
  }, []);

  const startRun = () => {
    playSfx("uiConfirm");
    dispatch({
      type: "START_RUN",
      weapon: selectedWeapon,
      seed: Date.now() >>> 0,
    });
  };

  return (
    <main className="select-screen">
      <header className="select-header">
        <button
          className="text-button"
          type="button"
          onClick={() => {
            playSfx("uiConfirm", { volume: 0.24 });
            dispatch({ type: "RETURN_TITLE" });
          }}
        >
          <span>←</span> BACK
        </button>
        <div className="select-header__brand">
          <p>The End&apos;s Tower</p>
          <strong>LOADOUT</strong>
        </div>
        <div className="select-header__progress">
          <span>CHARACTER SELECT</span>
          <strong>01 / 01</strong>
        </div>
      </header>

      <section className="loadout-layout">
        <aside className="weapon-panel" aria-labelledby="weapon-heading">
          <div className="weapon-panel__title">
            <p>SELECT EQUIPMENT</p>
            <h2 id="weapon-heading">시작 무기</h2>
            <span>하나의 무기만 장착할 수 있습니다.</span>
          </div>

          <div className="weapon-grid" role="list">
            {weaponDefinitions.map((weapon) => {
              const active = weapon.id === selectedWeapon;
              return (
                <button
                  className={`weapon-card${active ? " is-selected" : ""}`}
                  key={weapon.id}
                  type="button"
                  aria-pressed={active}
                  style={
                    { "--weapon-accent": weapon.accent } as React.CSSProperties
                  }
                  onClick={() => {
                    playSfx("uiConfirm", { volume: 0.22 });
                    setSelectedWeapon(weapon.id);
                  }}
                >
                  <img src={weapon.image} alt="" />
                  <span>
                    <small>{weapon.englishName}</small>
                    <strong>{weapon.name}</strong>
                  </span>
                  <i aria-hidden="true">{active ? "◆" : "◇"}</i>
                </button>
              );
            })}
          </div>
        </aside>

        <article className="character-card" aria-label="캐릭터 장비 미리보기">
          <div className="character-card__index">
            <span>NO. 01</span>
            <i />
            <strong>ERN</strong>
          </div>
          <div className="character-portrait">
            <div className="character-portrait__halo" aria-hidden="true" />
            <img
              src={selected.characterImage}
              alt={`${selected.name}을 장비한 에른`}
              width={1024}
              height={1536}
              decoding="async"
              loading="eager"
              style={
                {
                  "--character-scale": selected.characterScale,
                  "--character-offset-y": selected.characterOffsetY,
                } as React.CSSProperties
              }
              onError={(event) => {
                const image = event.currentTarget;
                image.onerror = null;
                image.src = "/assets/loadout/characters/ern-longsword.png";
              }}
            />
            <span className="character-portrait__floor" aria-hidden="true" />
          </div>
          <div className="character-card__info">
            <div>
              <p>초보 탐험가</p>
              <h2>에른</h2>
            </div>
            <span>LV. 01</span>
          </div>
        </article>

        <section
          className="weapon-detail"
          aria-live="polite"
          style={{ "--weapon-accent": selected.accent } as React.CSSProperties}
        >
          <div className="weapon-detail__heading">
            <p>{selected.englishName}</p>
            <h1>{selected.name}</h1>
            <span>{selected.role}</span>
          </div>

          <p className="weapon-detail__description">{selected.description}</p>

          <div className="weapon-stats" aria-label={`${selected.name} 능력치`}>
            <Stat
              label="공격"
              englishLabel="ATTACK"
              value={selected.stats.attack}
            />
            <Stat
              label="속도"
              englishLabel="SPEED"
              value={selected.stats.speed}
            />
            <Stat
              label="방어"
              englishLabel="DEFENSE"
              value={selected.stats.defense}
            />
          </div>

          <div className="weapon-skill">
            <img src={selected.image} alt="" />
            <div>
              <p>FIRST SKILL</p>
              <h3>{selected.skill}</h3>
              <span>{selected.trait}</span>
            </div>
          </div>

          <button className="depart-button" type="button" onClick={startRun}>
            <span>
              <small>CONFIRM LOADOUT</small>이 장비로 1층에 입장
            </span>
            <strong>→</strong>
          </button>
        </section>
      </section>
    </main>
  );
}

function Stat({
  label,
  englishLabel,
  value,
}: {
  label: string;
  englishLabel: string;
  value: number;
}) {
  return (
    <div className="weapon-stat">
      <span>
        {label} <small>{englishLabel}</small>
      </span>
      <div>
        <i style={{ width: `${value}%` }} />
      </div>
      <strong>{value}</strong>
    </div>
  );
}
