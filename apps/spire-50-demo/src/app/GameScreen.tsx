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
import { PauseMenu } from "./components/PauseMenu.js";
import { ShopPanel } from "./components/ShopPanel.js";

export function GameScreen() {
  const zone = useGameStore((state) => state.snapshot.zone);
  const floor = useGameStore((state) => state.snapshot.floor);
  const dialogueOpen = useGameStore((state) => state.snapshot.dialogueOpen);
  const dispatch = useGameStore((state) => state.dispatch);
  const mission = useGameStore((state) => state.fifthFloorMission);
  const setUiOverlayOpen = useGameStore((state) => state.setUiOverlayOpen);
  const [openPanel, setOpenPanel] = useState<GamePanelId | null>(null);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [shopHidden, setShopHidden] = useState(false);

  useEffect(() => {
    setMusicContext(zone === "battle" && floor === 5 ? "boss" : zone);
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
        if (mission?.status === "active" || pauseOpen) return;
        setOpenPanel((current) =>
          current === requestedPanel ? null : requestedPanel,
        );
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (pauseOpen) {
          setPauseOpen(false);
          return;
        }
        if (openPanel) {
          setOpenPanel(null);
          return;
        }
        if (zone === "shop" && !shopHidden && !dialogueOpen) {
          setShopHidden(true);
          return;
        }
        if (dialogueOpen) return;
        setPauseOpen(true);
      }
    };
    window.addEventListener("keydown", handleGameKeys);
    return () => window.removeEventListener("keydown", handleGameKeys);
  }, [dialogueOpen, mission?.status, openPanel, pauseOpen, shopHidden, zone]);

  useEffect(() => {
    if (mission?.status === "active") setOpenPanel(null);
  }, [mission?.status]);

  useEffect(() => {
    setShopHidden(false);
  }, [zone]);

  useEffect(() => {
    setUiOverlayOpen(openPanel !== null || pauseOpen);
    return () => setUiOverlayOpen(false);
  }, [openPanel, pauseOpen, setUiOverlayOpen]);

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
      {zone === "shop" && !dialogueOpen && !shopHidden ? <ShopPanel /> : null}
      {openPanel ? (
        <GamePanels panel={openPanel} onClose={() => setOpenPanel(null)} />
      ) : null}
      {pauseOpen ? <PauseMenu onClose={() => setPauseOpen(false)} /> : null}
      <div className="game-screen__footer">
        <span>WASD 이동</span>
        <span>이동키 2회 대시</span>
        <span>우클릭 커서 방향 공격</span>
        <span>1 주력 스킬 · 2 두 번째 스킬 · 3 세 번째 스킬</span>
        <span>Z 회수</span>
        <span>포탈 위 W</span>
        {zone === "battle" && floor === 5 ? (
          <>
            <span>G 밀치기·잠든 눈 타격</span>
            <span>N 임무 상세 정보</span>
          </>
        ) : null}
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
      <img src={`/assets/game/world/weapons/${weapon.id}.png`} alt="" />
      <span>{weapon.name}</span>
    </div>
  );
}
