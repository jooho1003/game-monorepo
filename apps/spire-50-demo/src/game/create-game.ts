import Phaser from "phaser";
import { PlayScene } from "./PlayScene.js";

export function createPhaserGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: "#101923",
    render: {
      antialias: true,
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
}
