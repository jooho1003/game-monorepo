import { useEffect } from "react";
import { getWeaponDefinition } from "../config/weapons.js";
import { useGameStore } from "../store/game-store.js";
import { DialogueOverlay } from "./components/DialogueOverlay.js";
import { GameCanvas } from "./components/GameCanvas.js";
import { Hud } from "./components/Hud.js";
import { ShopPanel } from "./components/ShopPanel.js";

export function GameScreen() {
  const zone = useGameStore((state) => state.snapshot.zone);
  const dialogueOpen = useGameStore((state) => state.snapshot.dialogueOpen);
  const dispatch = useGameStore((state) => state.dispatch);

  useEffect(() => {
    const returnToTitle = (event: KeyboardEvent) => {
      if (event.key === "Escape") dispatch({ type: "RETURN_TITLE" });
    };
    window.addEventListener("keydown", returnToTitle);
    return () => window.removeEventListener("keydown", returnToTitle);
  }, [dispatch]);

  return (
    <main className="game-screen">
      <GameCanvas />
      <Hud />
      {dialogueOpen ? <DialogueOverlay /> : null}
      {zone === "shop" && !dialogueOpen ? <ShopPanel /> : null}
      <div className="game-screen__footer">
        <span>WASD 이동</span>
        <span>우클릭 공격</span>
        <span>1 스킬</span>
        <span>Z 회수</span>
        <span>포탈 위 W</span>
      </div>
      <WeaponStamp />
    </main>
  );
}

function WeaponStamp() {
  const weaponId = useGameStore((state) => state.snapshot.weapon);
  const weapon = getWeaponDefinition(weaponId);

  return (
    <div className="weapon-stamp" style={{ borderColor: weapon.accent }}>
      <span>{weapon.icon}</span>
      {weapon.name}
    </div>
  );
}
