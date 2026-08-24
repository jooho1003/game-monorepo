import { useEffect, useRef } from "react";
import type Phaser from "phaser";
import type { ZoneId } from "../../domain/model.js";
import { createPhaserGame } from "../../game/create-game.js";
import { PlayScene } from "../../game/PlayScene.js";
import { useGameStore } from "../../store/game-store.js";

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const zone = useGameStore((state) => state.snapshot.zone);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventContextMenu = (event: MouseEvent) => event.preventDefault();
    const releaseInput = () => {
      const scene = gameRef.current?.scene.getScene("play");
      scene?.input.keyboard?.resetKeys();
    };
    container.addEventListener("contextmenu", preventContextMenu);
    window.addEventListener("blur", releaseInput);
    gameRef.current = createPhaserGame(container);

    return () => {
      container.removeEventListener("contextmenu", preventContextMenu);
      window.removeEventListener("blur", releaseInput);
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = gameRef.current?.scene.getScene("play");
    if (scene instanceof PlayScene) scene.showZone(zone);
  }, [zone]);

  return (
    <div
      ref={containerRef}
      className="game-canvas"
      aria-label={`${zoneLabel(zone)} 게임 화면`}
      tabIndex={0}
    />
  );
}

function zoneLabel(zone: ZoneId): string {
  if (zone === "battle") return "탑 공략장소";
  if (zone === "shop") return "아이템 상점";
  return "탑 휴식처";
}
