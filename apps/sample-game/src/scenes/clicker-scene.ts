import Phaser from "phaser";
import { createRng, ScoreBoard, type Rng } from "@game/core";

/**
 * 공용 패키지 사용 예시 씬: 원을 클릭하면 점수(콤보 배율 적용)를 얻고,
 * 원이 시드 기반 난수 위치로 이동한다. 놓치면(빈 곳 클릭) 콤보가 끊긴다.
 */
export class ClickerScene extends Phaser.Scene {
  private board = new ScoreBoard();
  private rng: Rng = createRng(Date.now());
  private target!: Phaser.GameObjects.Arc;
  private scoreText!: Phaser.GameObjects.Text;

  constructor() {
    super("clicker");
  }

  create(): void {
    this.scoreText = this.add.text(16, 16, "", { fontSize: "24px" });
    this.updateHud();

    this.target = this.add.circle(400, 300, 40, 0xe94560);
    this.target.setInteractive();

    this.target.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      this.board.add(100);
      this.moveTarget();
      this.updateHud();
    });

    this.input.on("pointerdown", (_p: Phaser.Input.Pointer, over: unknown[]) => {
      if (over.length === 0) {
        this.board.breakCombo();
        this.updateHud();
      }
    });
  }

  private moveTarget(): void {
    this.target.setPosition(
      this.rng.intBetween(60, 740),
      this.rng.intBetween(80, 540),
    );
  }

  private updateHud(): void {
    this.scoreText.setText(
      `점수 ${this.board.score}  콤보 x${this.board.combo}  최고 ${this.board.best}`,
    );
  }
}
