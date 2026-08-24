import { useEffect, useState } from "react";
import { setMusicContext, unlockAudio } from "../audio/audio-manager.js";
import { getWeaponDefinition } from "../config/weapons.js";
import { useGameStore } from "../store/game-store.js";
import { DialogueOverlay } from "./components/DialogueOverlay.js";
import { GameCanvas } from "./components/GameCanvas.js";
import { Hud } from "./components/Hud.js";
import { GamePanels, type GamePanelId } from "./components/GamePanels.js";
import {
  FifthFloorMissionOverlay,
  MissionFailureOverlay,
} from "./components/FifthFloorMissionOverlay.js";
import { ShopPanel } from "./components/ShopPanel.js";

export function GameScreen() {
  const zone = useGameStore((state) => state.snapshot.zone);
  const floor = useGameStore((state) => state.snapshot.floor);
  const dialogueOpen = useGameStore((state) => state.snapshot.dialogueOpen);
  const dispatch = useGameStore((state) => state.dispatch);
  const mission = useGameStore((state) => state.fifthFloorMission);
  const [openPanel, setOpenPanel] = useState<GamePanelId | null>(null);

  useEffect(() => {
    setMusicContext(
      zone === "battle" && floor === 5 ? "boss" : zone,
    );
  }, [floor, zone]);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const handleGameKeys = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const panelByKey: Partial<Record<string, GamePanelId>> = {
        k: "skills",
        i: "inventory",
        p: "character",
      };
      const requestedPanel = panelByKey[key];
      if (requestedPanel) {
        event.preventDefault();
        if (mission?.status === "active") return;
        setOpenPanel((current) =>
          current === requestedPanel ? null : requestedPanel,
        );
        return;
      }
      if (event.key === "Escape") {
        if (openPanel) setOpenPanel(null);
        else dispatch({ type: "RETURN_TITLE" });
      }
    };
    window.addEventListener("keydown", handleGameKeys);
    return () => window.removeEventListener("keydown", handleGameKeys);
  }, [dispatch, mission?.status, openPanel]);

  useEffect(() => {
    if (mission?.status === "active") setOpenPanel(null);
  }, [mission?.status]);

  useEffect(() => {
    let lastRecoveryAt = Date.now();
    const recover = window.setInterval(() => {
      const now = Date.now();
      if (useGameStore.getState().snapshot.zone !== "rest") {
        lastRecoveryAt = now;
        return;
      }
      dispatch({
        type: "RECOVER_RESOURCES",
        elapsedMs: now - lastRecoveryAt,
      });
      lastRecoveryAt = now;
    }, 5_000);
    return () => window.clearInterval(recover);
  }, [dispatch]);

  return (
    <main className="game-screen">
      <GameCanvas />
      <Hud />
      <FifthFloorMissionOverlay />
      <MissionFailureOverlay />
      {dialogueOpen ? <DialogueOverlay /> : null}
      {zone === "shop" && !dialogueOpen ? <ShopPanel /> : null}
      {openPanel ? (
        <GamePanels panel={openPanel} onClose={() => setOpenPanel(null)} />
      ) : null}
      <div className="game-screen__footer">
        <span>WASD 이동</span>
        <span>이동키 2회 대시</span>
        <span>우클릭 커서 방향 공격</span>
        <span>1 스킬</span>
        <span>Z 회수</span>
        <span>포탈 위 W</span>
        <span>K 스킬 · I 가방 · P 상태</span>
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
      <img
        src={`/assets/game/world/weapons/${weapon.id}.png`}
        alt=""
      />
      <span>{weapon.name}</span>
    </div>
  );
}
