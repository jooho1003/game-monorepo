import Phaser from "phaser";
import type { WandererRole, ZoneId } from "../domain/model.js";
import { useGameStore } from "../store/game-store.js";

interface EnemyActor {
  node: Phaser.GameObjects.Arc;
  barBack: Phaser.GameObjects.Rectangle;
  barFill: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  hp: number;
  maxHp: number;
  speed: number;
  nextAttackAt: number;
  wanderer: boolean;
}

interface DropActor {
  node: Phaser.GameObjects.Arc;
  glow: Phaser.GameObjects.Arc;
  amount: number;
}

interface PortalActor {
  node: Phaser.GameObjects.Arc;
  rune: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  target: ZoneId;
}

type MoveKeys = Record<
  "up" | "down" | "left" | "right",
  Phaser.Input.Keyboard.Key
>;

const WIDTH = 1280;
const HEIGHT = 720;
const PLAYER_SPEED = 235;

export class PlayScene extends Phaser.Scene {
  private zone: ZoneId = "rest";
  private player!: Phaser.GameObjects.Arc;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private aimLine!: Phaser.GameObjects.Graphics;
  private moveKeys!: MoveKeys;
  private skillKey!: Phaser.Input.Keyboard.Key;
  private pickupKey!: Phaser.Input.Keyboard.Key;
  private enemies: EnemyActor[] = [];
  private drops: DropActor[] = [];
  private portals: PortalActor[] = [];
  private ally?: EnemyActor;
  private nextBasicAttackAt = 0;
  private nextSkillAt = 0;
  private nextAllyAttackAt = 0;
  private nextPortalAt = 0;
  private returnPortalCreated = false;

  constructor() {
    super("play");
  }

  create(): void {
    this.moveKeys = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as MoveKeys;
    this.skillKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.ONE,
    );
    this.pickupKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.Z,
    );
    this.input.on("pointerdown", this.onPointerDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanUp, this);

    this.zone = useGameStore.getState().snapshot.zone;
    this.buildZone();
  }

  update(time: number, delta: number): void {
    const snapshot = useGameStore.getState().snapshot;
    if (snapshot.dialogueOpen) {
      this.aimLine.clear();
      return;
    }

    this.updatePlayer(delta);
    this.updateAim();

    if (this.zone === "battle") {
      this.updateEnemies(time, delta);
      this.updateAlly(time, delta);
      this.updateActorUi();
      if (this.skillKey.isDown) this.useSkill(time);
      if (this.pickupKey.isDown) this.collectDrops();
      this.maybeCreateReturnPortal();
    }

    if (
      this.moveKeys.up.isDown &&
      time >= this.nextPortalAt &&
      this.tryPortal()
    ) {
      this.nextPortalAt = time + 700;
    }
  }

  showZone(zone: ZoneId): void {
    if (!this.scene.isActive() || this.zone === zone) return;
    this.zone = zone;
    this.scene.restart();
  }

  private buildZone(): void {
    this.cameras.main.setBackgroundColor(zoneBackground(this.zone));
    this.drawFloor();
    this.drawZoneDecoration();

    const spawn =
      this.zone === "rest" ? { x: 640, y: 560 } : { x: 640, y: 580 };
    this.playerShadow = this.add.ellipse(
      spawn.x,
      spawn.y + 17,
      48,
      18,
      0x071014,
      0.42,
    );
    this.player = this.add
      .circle(spawn.x, spawn.y, 22, 0xe8f4eb)
      .setStrokeStyle(5, 0x6fd5c3);
    this.aimLine = this.add.graphics();

    if (this.zone === "rest") this.buildRestZone();
    if (this.zone === "battle") this.buildBattleZone();
    if (this.zone === "shop") this.buildShopZone();
  }

  private drawFloor(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(this.zone === "battle" ? 0x19242a : 0x263932, 1);
    graphics.fillRoundedRect(90, 82, 1100, 570, 36);
    graphics.lineStyle(2, this.zone === "battle" ? 0x43545b : 0x54715f, 0.7);
    for (let x = 130; x < 1180; x += 72) {
      graphics.lineBetween(x, 98, x - 30, 636);
    }
    for (let y = 120; y < 640; y += 62) {
      graphics.lineBetween(106, y, 1170, y);
    }
    graphics.lineStyle(5, 0xc7b27c, 0.25);
    graphics.strokeRoundedRect(90, 82, 1100, 570, 36);
  }

  private drawZoneDecoration(): void {
    const title =
      this.zone === "rest"
        ? "REST OF THE FIRST FLOOR"
        : this.zone === "battle"
          ? "TRIAL GROUND · FLOOR 1"
          : "ROOT & RUNE SHOP";
    this.add
      .text(640, 100, title, {
        color: "#c6d8cf",
        fontFamily: "Georgia, serif",
        fontSize: "15px",
        letterSpacing: 5,
      })
      .setOrigin(0.5)
      .setAlpha(0.56);

    for (let index = 0; index < 18; index += 1) {
      const x = 120 + ((index * 67) % 1040);
      const y = 115 + ((index * 97) % 500);
      this.add.circle(x, y, index % 3 === 0 ? 3 : 2, 0x8ce6d0, 0.2);
    }
  }

  private buildRestZone(): void {
    this.add.circle(640, 280, 46, 0x9b7a4d).setStrokeStyle(5, 0xe0c690);
    this.add
      .text(640, 278, "塔", {
        color: "#fff4d2",
        fontFamily: "serif",
        fontSize: "31px",
      })
      .setOrigin(0.5);
    this.add
      .text(640, 342, "탑 관리자 · 오르반", {
        color: "#ead9b4",
        fontFamily: "sans-serif",
        fontSize: "15px",
      })
      .setOrigin(0.5);

    this.createPortal(1020, 340, "battle", "1층 공략");
    this.createPortal(260, 340, "shop", "아이템 상점");
    this.addInstruction(640, 625, "포탈 안에서 W를 다시 누르면 이동합니다");
  }

  private buildBattleZone(): void {
    this.spawnEnemy(390, 285, 0xcf5968, "회랑 쥐", 45, 70, false);
    this.spawnEnemy(865, 260, 0xd66b52, "불씨 벌레", 55, 62, false);
    this.spawnEnemy(800, 465, 0xa85d70, "탑의 잔영", 65, 78, false);

    const role = useGameStore.getState().snapshot.wandererRole;
    if (role === "ally") {
      this.ally = this.spawnActor(
        510,
        440,
        0x6fd5c3,
        "방랑자 · 아군",
        80,
        118,
        true,
      );
    } else {
      this.spawnEnemy(510, 440, 0xe0a15a, "방랑자 · 적군", 85, 96, true);
    }

    this.addInstruction(
      640,
      625,
      role === "ally"
        ? "청록 방랑자는 아군입니다 · 함께 적을 쓰러뜨리세요"
        : "주황 방랑자는 적군입니다 · 몬스터와 함께 공격합니다",
    );
  }

  private buildShopZone(): void {
    this.add
      .rectangle(640, 260, 290, 130, 0x3c2f2a)
      .setStrokeStyle(4, 0xc39261);
    this.add.circle(640, 232, 34, 0xc79262).setStrokeStyle(4, 0xf1d39b);
    this.add
      .text(640, 318, "상인 · 마라", {
        color: "#f2d7a0",
        fontSize: "16px",
      })
      .setOrigin(0.5);
    this.createPortal(640, 540, "rest", "휴식처 귀환");
  }

  private updatePlayer(delta: number): void {
    const xAxis =
      Number(this.moveKeys.right.isDown) - Number(this.moveKeys.left.isDown);
    const yAxis =
      Number(this.moveKeys.down.isDown) - Number(this.moveKeys.up.isDown);
    const vector = new Phaser.Math.Vector2(xAxis, yAxis);
    if (vector.lengthSq() > 0) vector.normalize();

    const distance = (PLAYER_SPEED * delta) / 1000;
    this.player.x = Phaser.Math.Clamp(
      this.player.x + vector.x * distance,
      122,
      WIDTH - 122,
    );
    this.player.y = Phaser.Math.Clamp(
      this.player.y + vector.y * distance,
      126,
      HEIGHT - 102,
    );
    this.playerShadow.setPosition(this.player.x, this.player.y + 17);
  }

  private updateAim(): void {
    const pointer = this.input.activePointer;
    const angle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      pointer.worldX,
      pointer.worldY,
    );
    const endX = this.player.x + Math.cos(angle) * 48;
    const endY = this.player.y + Math.sin(angle) * 48;
    this.aimLine.clear();
    this.aimLine.lineStyle(3, 0xd8fff7, 0.52);
    this.aimLine.lineBetween(this.player.x, this.player.y, endX, endY);
    this.aimLine.fillStyle(0xd8fff7, 0.72);
    this.aimLine.fillCircle(endX, endY, 4);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (
      !(pointer.event instanceof MouseEvent) ||
      pointer.event.button !== 2 ||
      this.zone !== "battle"
    ) {
      return;
    }
    if (useGameStore.getState().snapshot.dialogueOpen) return;
    const now = this.time.now;
    if (now < this.nextBasicAttackAt) return;
    this.nextBasicAttackAt = now + 360;

    const angle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      pointer.worldX,
      pointer.worldY,
    );
    const hitX = this.player.x + Math.cos(angle) * 78;
    const hitY = this.player.y + Math.sin(angle) * 78;
    this.flashAttack(hitX, hitY, 84, 0xeefcf7);
    this.damageEnemies(hitX, hitY, 92, 24);
  }

  private useSkill(time: number): void {
    const snapshot = useGameStore.getState().snapshot;
    if (time < this.nextSkillAt) return;
    if (!snapshot.skillUnlocked || snapshot.mp < 25) {
      this.nextSkillAt = time + 300;
      useGameStore.getState().dispatch({ type: "USE_SKILL", manaCost: 25 });
      return;
    }
    this.nextSkillAt = time + 1200;
    useGameStore.getState().dispatch({ type: "USE_SKILL", manaCost: 25 });

    const pointer = this.input.activePointer;
    const angle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      pointer.worldX,
      pointer.worldY,
    );
    const hitX = this.player.x + Math.cos(angle) * 150;
    const hitY = this.player.y + Math.sin(angle) * 150;
    this.flashAttack(hitX, hitY, 142, 0x70f0d7);
    this.damageEnemies(hitX, hitY, 150, 42);
  }

  private flashAttack(
    x: number,
    y: number,
    radius: number,
    color: number,
  ): void {
    const ring = this.add
      .circle(x, y, radius * 0.45, color, 0.14)
      .setStrokeStyle(7, color, 0.85);
    this.tweens.add({
      targets: ring,
      radius,
      alpha: 0,
      duration: 230,
      ease: "Quad.Out",
      onComplete: () => ring.destroy(),
    });
  }

  private damageEnemies(
    x: number,
    y: number,
    radius: number,
    damage: number,
  ): void {
    for (const actor of [...this.enemies]) {
      if (
        Phaser.Math.Distance.Between(x, y, actor.node.x, actor.node.y) > radius
      )
        continue;
      actor.hp = Math.max(0, actor.hp - damage);
      actor.node.setFillStyle(0xffffff);
      this.time.delayedCall(70, () => {
        if (actor.node.active)
          actor.node.setFillStyle(actor.wanderer ? 0xe0a15a : 0xcf5968);
      });
      this.showDamage(actor.node.x, actor.node.y - 35, damage);
      if (actor.hp === 0) this.defeatEnemy(actor);
    }
  }

  private updateEnemies(time: number, delta: number): void {
    for (const actor of this.enemies) {
      const vector = new Phaser.Math.Vector2(
        this.player.x - actor.node.x,
        this.player.y - actor.node.y,
      );
      const distance = vector.length();
      if (distance > 34) {
        vector.normalize();
        const step = (actor.speed * delta) / 1000;
        actor.node.x += vector.x * step;
        actor.node.y += vector.y * step;
      } else if (time >= actor.nextAttackAt) {
        actor.nextAttackAt = time + 850;
        useGameStore
          .getState()
          .dispatch({ type: "TAKE_DAMAGE", amount: actor.wanderer ? 9 : 6 });
        this.cameras.main.shake(90, 0.0035);
      }
    }
  }

  private updateAlly(time: number, delta: number): void {
    const ally = this.ally;
    if (!ally?.node.active) return;
    const target = this.closestEnemy(ally.node.x, ally.node.y);
    const targetX = target?.node.x ?? this.player.x - 46;
    const targetY = target?.node.y ?? this.player.y + 38;
    const vector = new Phaser.Math.Vector2(
      targetX - ally.node.x,
      targetY - ally.node.y,
    );
    const distance = vector.length();

    if (distance > (target ? 68 : 46)) {
      vector.normalize();
      const step = (ally.speed * delta) / 1000;
      ally.node.x += vector.x * step;
      ally.node.y += vector.y * step;
    } else if (target && time >= this.nextAllyAttackAt) {
      this.nextAllyAttackAt = time + 720;
      target.hp = Math.max(0, target.hp - 10);
      this.flashAttack(target.node.x, target.node.y, 38, 0x6fd5c3);
      this.showDamage(target.node.x, target.node.y - 35, 10);
      if (target.hp === 0) this.defeatEnemy(target);
    }
  }

  private updateActorUi(): void {
    for (const actor of [...this.enemies, ...(this.ally ? [this.ally] : [])]) {
      if (!actor.node.active) continue;
      actor.barBack.setPosition(actor.node.x, actor.node.y + 35);
      actor.barFill.setPosition(actor.node.x - 25, actor.node.y + 35);
      actor.barFill.width = 50 * (actor.hp / actor.maxHp);
      actor.name.setPosition(actor.node.x, actor.node.y - 42);
    }
  }

  private closestEnemy(x: number, y: number): EnemyActor | undefined {
    let closest: EnemyActor | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const actor of this.enemies) {
      const distance = Phaser.Math.Distance.Between(
        x,
        y,
        actor.node.x,
        actor.node.y,
      );
      if (distance < closestDistance) {
        closest = actor;
        closestDistance = distance;
      }
    }
    return closest;
  }

  private spawnEnemy(
    x: number,
    y: number,
    color: number,
    label: string,
    hp: number,
    speed: number,
    wanderer: boolean,
  ): EnemyActor {
    const actor = this.spawnActor(x, y, color, label, hp, speed, wanderer);
    this.enemies.push(actor);
    return actor;
  }

  private spawnActor(
    x: number,
    y: number,
    color: number,
    label: string,
    hp: number,
    speed: number,
    wanderer: boolean,
  ): EnemyActor {
    const node = this.add
      .circle(x, y, wanderer ? 24 : 20, color)
      .setStrokeStyle(4, wanderer ? 0xffdc99 : 0x48282d);
    const barBack = this.add
      .rectangle(x, y + 35, 54, 8, 0x101417)
      .setStrokeStyle(2, 0x07090a);
    const barFill = this.add
      .rectangle(x - 25, y + 35, 50, 5, wanderer ? 0xf0ad5d : 0xe75b67)
      .setOrigin(0, 0.5);
    const name = this.add
      .text(x, y - 42, label, {
        color: wanderer ? "#ffe0a6" : "#f6c5c9",
        fontSize: "12px",
        backgroundColor: "#0b1117aa",
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5);
    return {
      node,
      barBack,
      barFill,
      name,
      hp,
      maxHp: hp,
      speed,
      nextAttackAt: 0,
      wanderer,
    };
  }

  private defeatEnemy(actor: EnemyActor): void {
    const index = this.enemies.indexOf(actor);
    if (index >= 0) this.enemies.splice(index, 1);
    const { x, y } = actor.node;
    actor.node.destroy();
    actor.barBack.destroy();
    actor.barFill.destroy();
    actor.name.destroy();
    this.spawnDrop(x, y, actor.wanderer ? 18 : 10);
  }

  private spawnDrop(x: number, y: number, amount: number): void {
    const glow = this.add.circle(x, y, 20, 0xffd56a, 0.12);
    const node = this.add.circle(x, y, 8, 0xffd56a).setStrokeStyle(3, 0xfff0ac);
    this.tweens.add({
      targets: node,
      y: y - 7,
      yoyo: true,
      repeat: -1,
      duration: 520,
    });
    this.drops.push({ node, glow, amount });
  }

  private collectDrops(): void {
    for (const drop of [...this.drops]) {
      if (
        Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          drop.node.x,
          drop.node.y,
        ) > 95
      )
        continue;
      useGameStore
        .getState()
        .dispatch({ type: "COLLECT_GOLD", amount: drop.amount });
      drop.node.destroy();
      drop.glow.destroy();
      this.drops.splice(this.drops.indexOf(drop), 1);
    }
  }

  private maybeCreateReturnPortal(): void {
    if (this.enemies.length > 0 || this.returnPortalCreated) return;
    this.returnPortalCreated = true;
    this.createPortal(640, 175, "rest", "휴식처 귀환");
    this.addInstruction(640, 225, "1층 정리 완료 · 귀환 포탈에서 W");
  }

  private createPortal(
    x: number,
    y: number,
    target: ZoneId,
    labelText: string,
  ): void {
    const color =
      target === "battle" ? 0xd87366 : target === "shop" ? 0xd5b96c : 0x77d9c7;
    const node = this.add
      .circle(x, y, 52, color, 0.1)
      .setStrokeStyle(7, color, 0.85);
    const rune = this.add
      .text(
        x,
        y - 2,
        target === "battle" ? "Ⅰ" : target === "shop" ? "◆" : "⌂",
        {
          color: "#f5f1df",
          fontFamily: "serif",
          fontSize: "34px",
        },
      )
      .setOrigin(0.5);
    const label = this.add
      .text(x, y + 75, labelText, {
        color: "#f2ead2",
        fontSize: "14px",
        backgroundColor: "#101923cc",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: node,
      scale: 1.1,
      alpha: 0.45,
      yoyo: true,
      repeat: -1,
      duration: 900,
    });
    this.portals.push({ node, rune, label, target });
  }

  private tryPortal(): boolean {
    for (const portal of this.portals) {
      if (
        Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          portal.node.x,
          portal.node.y,
        ) > 72
      )
        continue;
      useGameStore
        .getState()
        .dispatch({ type: "ENTER_ZONE", zone: portal.target });
      return true;
    }
    return false;
  }

  private addInstruction(x: number, y: number, text: string): void {
    this.add
      .text(x, y, text, {
        color: "#cfddd6",
        fontSize: "14px",
        backgroundColor: "#0b1117bb",
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5);
  }

  private showDamage(x: number, y: number, amount: number): void {
    const text = this.add
      .text(x, y, String(amount), {
        color: "#fff2b3",
        fontFamily: "Georgia, serif",
        fontSize: "24px",
        fontStyle: "bold",
        stroke: "#552c28",
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: text,
      y: y - 34,
      alpha: 0,
      duration: 580,
      onComplete: () => text.destroy(),
    });
  }

  private cleanUp(): void {
    this.input.off("pointerdown", this.onPointerDown, this);
  }
}

function zoneBackground(zone: ZoneId): number {
  if (zone === "battle") return 0x0e141a;
  if (zone === "shop") return 0x211b1a;
  return 0x14231f;
}

export function relationLabel(role: WandererRole): string {
  return role === "ally" ? "아군" : "적군";
}
