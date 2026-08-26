import Phaser from "phaser";
import { PlayScene } from "./PlayScene.js";

export function createPhaserGame(parent: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: "#101923",
    pixelArt: false,
    render: {
      antialias: true,
      antialiasGL: true,
      roundPixels: true,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720,
    },
    input: {
      mouse: {
        preventDefaultWheel: true,
      },
    },
    scene: [PlayScene],
  });
  if (import.meta.env.DEV) {
    (window as { __spireGame?: Phaser.Game }).__spireGame = game;
  }
  return game;
}
