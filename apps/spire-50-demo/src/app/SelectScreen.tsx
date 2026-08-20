import { useState } from "react";
import { getWeaponDefinition, weaponDefinitions } from "../config/weapons.js";
import type { WeaponId } from "../domain/model.js";
import { useGameStore } from "../store/game-store.js";

export function SelectScreen() {
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponId>("longsword");
  const dispatch = useGameStore((state) => state.dispatch);
  const selected = getWeaponDefinition(selectedWeapon);

  const startRun = () => {
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
          onClick={() => dispatch({ type: "RETURN_TITLE" })}
        >
          ← 타이틀
        </button>
        <div>
          <p className="eyebrow">PREPARE THE ASCENT</p>
          <h1>도전자를 준비하세요</h1>
        </div>
        <span className="select-header__step">LOADOUT 01</span>
      </header>

      <section className="loadout-layout">
        <article className="character-card">
          <span className="character-card__badge">선택 가능</span>
          <div className="character-portrait" aria-label="에른 임시 초상">
            <div className="character-portrait__hair" />
            <div className="character-portrait__face" />
            <div className="character-portrait__coat" />
            <span>PROTOTYPE</span>
          </div>
          <div className="character-card__info">
            <p>기본 캐릭터</p>
            <h2>에른</h2>
            <span>Lv.1 초보자</span>
          </div>
        </article>

        <section className="weapon-panel" aria-labelledby="weapon-heading">
          <div className="weapon-panel__title">
            <div>
              <p className="eyebrow">CHOOSE ONE</p>
              <h2 id="weapon-heading">시작 무기</h2>
            </div>
            <span>하나만 장착 가능</span>
          </div>

          <div className="weapon-grid">
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
                  onClick={() => setSelectedWeapon(weapon.id)}
                >
                  <strong>{weapon.icon}</strong>
                  <span>{weapon.name}</span>
                  <small>{active ? "선택됨" : "선택"}</small>
                </button>
              );
            })}
          </div>

          <div className="weapon-detail">
            <div
              className="weapon-detail__icon"
              style={
                { "--weapon-accent": selected.accent } as React.CSSProperties
              }
            >
              {selected.icon}
            </div>
            <div>
              <p>{selected.name} 전투 방식</p>
              <h3>{selected.trait}</h3>
              <span>
                첫 스킬 <strong>{selected.skill}</strong> · 관리자 대화 후 해금
              </span>
            </div>
          </div>

          <button className="depart-button" type="button" onClick={startRun}>
            이 장비로 1층에 입장
            <span>→</span>
          </button>
        </section>
      </section>
    </main>
  );
}
