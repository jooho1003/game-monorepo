import Phaser from "phaser";
import { ClickerScene } from "./scenes/clicker-scene.js";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 800,
  height: 600,
  backgroundColor: "#16213e",
  scene: [ClickerScene],
});
