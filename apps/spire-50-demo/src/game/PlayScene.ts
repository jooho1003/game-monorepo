import Phaser from "phaser";
import { playCombatVoice, playSfx } from "../audio/audio-manager.js";
import type { WandererRole, WeaponId, ZoneId } from "../domain/model.js";
import {
  advanceFifthFloorMission,
  chooseFifthFloorStrategy,
  commandFifthFloorSacrificeCharge,
  completeFifthFloorSacrifice,
  createFifthFloorMission,
  escapeFifthFloorMission,
  failFifthFloorMission,
  hitCyclopsWithBasicAttack,
  hitCyclopsWithSkill,
  isCyclopsAwake,
  isCyclopsVisionActive,
  loseFifthFloorSoldiers,
  reachFifthFloorBeach,
  revokeFifthFloorStrategy,
  toggleFifthFloorSacrifice,
  updateFifthFloorAlliesAtBeach,
  updateFifthFloorSheepAtBeach,
  type FifthFloorFailureReason,
  type FifthFloorMissionEvent,
  type FifthFloorMissionState,
} from "../domain/fifth-floor-mission.js";
import { useGameStore } from "../store/game-store.js";
import {
  getBattleLayout,
  getFloorDifficulty,
  type BattleLayout,
  type BattleBoundarySpec,
  type BattleObstacleSpec,
} from "./battle-layout.js";
import {
  PLAYER_DIRECTIONS,
  directionFromAngle,
  directionFromAxes,
  playerActionTextureFrame,
  playerLocomotionTextureFrame,
  playerStanceTextureFrame,
  type PlayerDirection,
  type PlayerTextureFrame,
} from "./player-animation.js";
import {
  ALLY_SPAWNS,
  BEACH_REGION,
  BEACH_REST_GATE_POSITION,
  CAVE_GATE_COLLIDER,
  CAVE_GATE_POSITION,
  CAVE_MOVEMENT_BOUNDS,
  CAVE_OBSTACLES,
  CAVE_PLAYER_SPAWN,
  CAVE_STRUCTURE_COLLIDERS,
  CAVE_WORLD_HEIGHT,
  CAVE_WORLD_WIDTH,
  CYCLOPS_DISPLAY_SIZE,
  CYCLOPS_FACING_ANGLE,
  CYCLOPS_POSITION,
  CYCLOPS_SLEEP_POSITION,
  CYCLOPS_VIEW_DISTANCE,
  CYCLOPS_VIEW_HALF_ANGLE,
  FIFTH_FLOOR_NUMBER,
  SHEEP_INSIDE_SPAWNS,
  SHEEP_OUTSIDE_SPAWNS,
  cyclopsGuardAttackProfile,
  doCaveBodiesOverlap,
  isPointInCaveExit,
  isPointInCyclopsGuardRange,
  isPointInCyclopsStrike,
  isPointInCyclopsVision,
  missionShoveTarget,
  movementAvoidanceCandidates,
  sheepTransitTarget,
  sheepYieldTarget,
  type CavePoint,
} from "./fifth-floor-layout.js";
import {
  REST_MOVEMENT_BOUNDS,
  REST_PORTAL_POSITIONS,
  REST_STRUCTURE_COLLIDERS,
} from "./rest-layout.js";

interface EnemyActor {
  node: Phaser.GameObjects.Image;
  barBack: Phaser.GameObjects.Rectangle;
  barFill: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  hp: number;
  maxHp: number;
  speed: number;
  nextAttackAt: number;
  attackStartedAt: number;
  attackEndsAt: number;
  attackDamage: number;
  attackCooldown: number;
  wanderer: boolean;
  textureBase: ActorKind;
  direction: ActorDirection;
  xpReward: number;
}

interface DropActor {
  node: Phaser.GameObjects.Arc;
  glow: Phaser.GameObjects.Arc;
  amount: number;
}

interface PortalActor {
  node: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Ellipse;
  core: Phaser.GameObjects.Rectangle;
  door?: Phaser.GameObjects.Container;
  rune: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  target: ZoneId;
}

interface WeaponCombatProfile {
  cooldown: number;
  range: number;
  damage: number;
  color: number;
}

interface MissionSheep {
  node: Phaser.GameObjects.Sprite;
  inside: CavePoint;
  outside: CavePoint;
  target: CavePoint;
  index: number;
  direction: PlayerDirection;
}

interface MissionSoldier {
  node: Phaser.GameObjects.Sprite;
  barBack: Phaser.GameObjects.Rectangle;
  barFill: Phaser.GameObjects.Rectangle;
  home: CavePoint;
  index: number;
  direction: PlayerDirection;
  hp: number;
  nextAttackAt: number;
  attackStartedAt: number;
  attackEndsAt: number;
}

interface CyclopsActorView {
  node: Phaser.GameObjects.Sprite;
  name: Phaser.GameObjects.Text;
}

interface CyclopsStrike {
  marker: Phaser.GameObjects.Container;
  x: number;
  y: number;
  resolvesAt: number;
  radius: number;
  cooldownMs: number;
}

type CyclopsAction =
  | "idle"
  | "walk"
  | "attack"
  | "rock"
  | "sleep"
  | "roar"
  | "sweep-windup"
  | "sweep-impact"
  | "gate-open"
  | "gate-close"
  | "blind-guard";

type MinimapMarkerKind = "player" | "ally" | "enemy" | "npc";

interface MinimapMarker {
  node: Phaser.GameObjects.Arc;
  source: () => { x: number; y: number; active?: boolean };
}

type MoveKeys = Record<
  "up" | "down" | "left" | "right",
  Phaser.Input.Keyboard.Key
>;

type ActorDirection = "north" | "east" | "south" | "west";
type ActorKind = "rat" | "beetle" | "wraith" | "wanderer";

const WIDTH = 1280;
const HEIGHT = 720;
const PLAYER_SPEED = 235;
const PLAYER_ACTION_DISPLAY_SIZE = 84;
const PLAYER_WORLD_SCALE = 0.75;
const PLAYER_FEET_WIDTH = 19;
const PLAYER_FEET_HEIGHT = 10;
const WEAPON_ATTACK_DURATION = 290;
const WALK_FRAME_DURATION = 112;
const DASH_FRAME_DURATION = 85;
const ACTOR_WALK_FRAME_DURATION = 180;
const MISSION_WALK_FRAME_DURATION = 170;
const CYCLOPS_WALK_FRAME_DURATION = 245;
const DASH_DOUBLE_TAP_WINDOW = 260;
const DASH_DURATION = 170;
const DASH_SPEED_MULTIPLIER = 3.15;
const CYCLOPS_PATROL_SPEED = 104;
const CYCLOPS_CHASE_SPEED = 168;
const CYCLOPS_FIGHT_SPEED = 205;
const CYCLOPS_CONTACT_AGGRO_DISTANCE = 176;
const CYCLOPS_DEAGGRO_DISTANCE = 520;
const CYCLOPS_BODY_RADIUS = 94;
const CYCLOPS_LABEL_OFFSET = 250;
const MISSION_SOLDIER_RADIUS = 25;
const MISSION_SHEEP_RADIUS = 22;
const CYCLOPS_STRIKE_RADIUS = 82;
const CYCLOPS_STRIKE_WARNING_MS = 850;
const CYCLOPS_STRIKE_COOLDOWN_MS = 1_700;
const CYCLOPS_MELEE_GUARD_RANGE = 300;
const MISSION_SHEEP_SPEED = 138;
const MISSION_SHEEP_YIELD_SPEED = 104;
const MISSION_SHEEP_FRAME_DURATION = 250;
const MISSION_SHOVE_RANGE = 118;
const MISSION_SHOVE_DISTANCE = 112;
const MISSION_SHOVE_COOLDOWN_MS = 360;
/** How long before the rock drops the stall watchdog starts nudging sheep. */
const SHEEP_TRANSIT_WATCHDOG_WINDOW_MS = 8_000;
/**
 * A pierced eye buys the squad ten seconds: the Cyclops reels in place and
 * nobody on the field throws a punch until the hold expires.
 */
const CYCLOPS_EYE_HIT_HOLD_MS = 10_000;
const GAME_FONT = '"Pretendard UI", "Noto Sans KR", sans-serif';

const EIGHT_DIRECTION_SHEET_ORDER: readonly PlayerDirection[] = [
  "south",
  "south-west",
  "west",
  "north-west",
  "north",
  "north-east",
  "east",
  "south-east",
];

const CYCLOPS_PATROL_POINTS: readonly CavePoint[] = [
  { x: 2140, y: 800 },
  { x: 1910, y: 500 },
  { x: 1680, y: 840 },
  { x: 1970, y: 1120 },
  { x: 2260, y: 980 },
];

const ACTOR_KINDS: readonly ActorKind[] = [
  "rat",
  "beetle",
  "wraith",
  "wanderer",
];

const ACTOR_DIRECTIONS: readonly ActorDirection[] = [
  "north",
  "east",
  "south",
  "west",
];

const WEAPON_IDS: readonly WeaponId[] = [
  "longsword",
  "dagger",
  "shield",
  "bow",
  "staff",
];

const SKILL_POSE_DURATIONS: Record<WeaponId, number> = {
  longsword: 520,
  dagger: 360,
  shield: 520,
  bow: 480,
  staff: 720,
};

const WEAPON_COMBAT: Record<WeaponId, WeaponCombatProfile> = {
  longsword: {
    cooldown: 410,
    range: 118,
    damage: 29,
    color: 0xe9f4ee,
  },
  dagger: {
    cooldown: 230,
    range: 92,
    damage: 18,
    color: 0xe2a5f4,
  },
  shield: {
    cooldown: 560,
    range: 72,
    damage: 22,
    color: 0xf2cb76,
  },
  bow: {
    cooldown: 510,
    range: 390,
    damage: 26,
    color: 0xa8df78,
  },
  staff: {
    cooldown: 640,
    range: 300,
    damage: 31,
    color: 0x84baff,
  },
};

export class PlayScene extends Phaser.Scene {
  private zone: ZoneId = "rest";
  private renderedZone?: ZoneId;
  private player!: Phaser.GameObjects.Image;
  private heldWeapon!: Phaser.GameObjects.Image;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private playerDirection: PlayerDirection = "south";
  private aimCursor!: Phaser.GameObjects.Graphics;
  private moveKeys!: MoveKeys;
  private skillKey!: Phaser.Input.Keyboard.Key;
  private pickupKey!: Phaser.Input.Keyboard.Key;
  private shoveKey!: Phaser.Input.Keyboard.Key;
  private enemies: EnemyActor[] = [];
  private drops: DropActor[] = [];
  private portals: PortalActor[] = [];
  private ally?: EnemyActor;
  private nextBasicAttackAt = 0;
  private nextSkillAt = 0;
  private nextAllyAttackAt = 0;
  private nextPortalAt = 0;
  private weaponAttackStartedAt = Number.NEGATIVE_INFINITY;
  private weaponAttackDirection: PlayerDirection = "south";
  private skillPoseStartedAt = Number.NEGATIVE_INFINITY;
  private skillPoseWeapon?: WeaponId;
  private skillPoseDirection: PlayerDirection = "south";
  private returnPortalCreated = false;
  private transitioning = false;
  private dashEndsAt = Number.NEGATIVE_INFINITY;
  private nextDashAt = 0;
  private nextDashTrailAt = 0;
  private dashDirection = new Phaser.Math.Vector2(0, 1);
  private lastMoveTapAt: Record<"up" | "down" | "left" | "right", number> = {
    up: Number.NEGATIVE_INFINITY,
    down: Number.NEGATIVE_INFINITY,
    left: Number.NEGATIVE_INFINITY,
    right: Number.NEGATIVE_INFINITY,
  };
  private movementBounds = new Phaser.Geom.Rectangle(0, 0, WIDTH, HEIGHT);
  private collisionRects: Phaser.Geom.Rectangle[] = [];
  private collisionPolygons: Phaser.Geom.Polygon[] = [];
  private battleLayout?: BattleLayout;
  private minimapMarkers: MinimapMarker[] = [];
  private minimapNpcs: { x: number; y: number }[] = [];
  private minimapWorldSize = { width: WIDTH, height: HEIGHT };
  private fifthFloorMission?: FifthFloorMissionState;
  private fifthFloorLastPublishedSecond = Number.NaN;
  private fifthFloorLastCommandRequestId = 0;
  private cyclopsActor?: CyclopsActorView;
  private cyclopsVision?: Phaser.GameObjects.Graphics;
  private cyclopsDirection: PlayerDirection = "west";
  private cyclopsFacingAngle = CYCLOPS_FACING_ANGLE;
  private cyclopsPatrolIndex = 1;
  private cyclopsStrike?: CyclopsStrike;
  private cyclopsNextStrikeAt = 0;
  private missionAttackHoldUntil = Number.NEGATIVE_INFINITY;
  private cyclopsAggroActive = false;
  private cyclopsAction: CyclopsAction = "idle";
  private caveGate?: Phaser.GameObjects.Container;
  private caveGateCollider?: Phaser.Geom.Rectangle;
  private caveGateStateLabel?: Phaser.GameObjects.Text;
  private caveGateWalkable = false;
  private missionAllies: MissionSoldier[] = [];
  private missionSheep: MissionSheep[] = [];
  private stealthSacrificeInProgress = false;
  private bossPoseToken = 0;
  private bossGateActionEndsAt = Number.NEGATIVE_INFINITY;
  private nextFootstepAt = 0;
  private nextMissionAnimalSoundAt = 0;
  private nextImpactSoundAt = 0;
  private nextMissionShoveAt = 0;
  private caveCollisionGuide?: Phaser.GameObjects.Graphics;

  private get cyclopsBoss(): Phaser.GameObjects.Sprite | undefined {
    return this.cyclopsActor?.node;
  }

  private get cyclopsName(): Phaser.GameObjects.Text | undefined {
    return this.cyclopsActor?.name;
  }

  constructor() {
    super("play");
  }

  preload(): void {
    this.load.image(
      "first-floor-map",
      "/assets/game/world/maps/first-floor-center.png",
    );
    this.load.image(
      "fifth-floor-map",
      "/assets/game/world/maps/fifth-floor-cyclops-cave-v1.webp",
    );
    this.load.image(
      "cyclops-rock-gate",
      "/assets/game/world/boss/cyclops/cyclops-rock-gate-pixel-v1.webp",
    );
    for (const biome of ["forest", "lava", "glacier", "ruins"] as const) {
      this.load.image(
        `battle-floor-${biome}`,
        `/assets/game/world/maps/battle/${biome}.png`,
      );
    }
    this.load.image("orban", "/assets/game/world/npc/orban.png");
    this.load.image(
      "cyclops-walk-8d",
      "/assets/game/world/boss/cyclops/cyclops-walk-8d-pixel-v2.png",
    );
    this.load.image(
      "cyclops-actions-pixel",
      "/assets/game/world/boss/cyclops/cyclops-actions-pixel-v2.png",
    );
    this.load.image(
      "soldier-walk-8d",
      "/assets/game/world/actors/soldier/soldier-walk-8d-v1.png",
    );
    this.load.image(
      "sheep-walk-8d",
      "/assets/game/world/actors/sheep/sheep-walk-8d-v1.png",
    );
    for (const direction of PLAYER_DIRECTIONS) {
      for (const frame of [0, 1] as const) {
        this.load.image(
          `cyclops-attack-v3-${direction}-${frame}`,
          `/assets/game/world/boss/cyclops/attack-v3/${direction}-${frame}.png`,
        );
        this.load.image(
          `cyclops-gate-v3-${direction}-${frame}`,
          `/assets/game/world/boss/cyclops/gate-v3/${direction}-${frame}.png`,
        );
        this.load.image(
          `soldier-attack-${direction}-${frame}`,
          `/assets/game/world/actors/soldier/attack/${direction}-${frame}.png`,
        );
      }
    }
    for (const weaponId of WEAPON_IDS) {
      this.load.image(
        `world-weapon-${weaponId}`,
        `/assets/game/world/weapons/${weaponId}.png`,
      );
    }
    for (const actor of ACTOR_KINDS) {
      for (const direction of ACTOR_DIRECTIONS) {
        for (const frame of [0, 1] as const) {
          this.load.image(
            `actor-${actor}-${direction}-${frame}`,
            `/assets/game/world/actors/${actor}/${direction}-${frame}.png`,
          );
          this.load.image(
            `actor-${actor}-attack-${direction}-${frame}`,
            `/assets/game/world/actors/${actor}/attack/${direction}-${frame}.png`,
          );
        }
      }
    }
    for (const direction of PLAYER_DIRECTIONS) {
      this.load.image(
        `player-${direction}`,
        `/assets/game/world/player-v2/${direction}.png`,
      );
      for (const frame of [0, 1] as const) {
        this.load.image(
          `player-walk-${direction}-${frame}`,
          `/assets/game/world/player-v2/walk/${direction}-${frame}.png`,
        );
        this.load.image(
          `player-dash-${direction}-${frame}`,
          `/assets/game/world/player-v2/dash/${direction}-${frame}.png`,
        );
        for (const skillWeaponId of WEAPON_IDS) {
          this.load.image(
            `player-stance-${skillWeaponId}-${direction}-${frame}`,
            `/assets/game/world/player-v2/stance/${skillWeaponId}/${direction}-${frame}.png`,
          );
          this.load.image(
            `player-attack-${skillWeaponId}-${direction}-${frame}`,
            `/assets/game/world/player-v2/attack/${skillWeaponId}/${direction}-${frame}.png`,
          );
          this.load.image(
            `player-skill-${skillWeaponId}-${direction}-${frame}`,
            `/assets/game/world/player-v2/skill/${skillWeaponId}/${direction}-${frame}.png`,
          );
        }
      }
    }
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
    this.shoveKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.G,
    );
    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.setDefaultCursor("none");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanUp, this);

    this.zone = useGameStore.getState().snapshot.zone;
    for (const direction of PLAYER_DIRECTIONS) {
      for (const key of [
        `player-${direction}`,
        `player-walk-${direction}-0`,
        `player-walk-${direction}-1`,
        `player-dash-${direction}-0`,
        `player-dash-${direction}-1`,
        ...WEAPON_IDS.flatMap((skillWeaponId) => [
          `player-stance-${skillWeaponId}-${direction}-0`,
          `player-stance-${skillWeaponId}-${direction}-1`,
          `player-attack-${skillWeaponId}-${direction}-0`,
          `player-attack-${skillWeaponId}-${direction}-1`,
          `player-skill-${skillWeaponId}-${direction}-0`,
          `player-skill-${skillWeaponId}-${direction}-1`,
        ]),
      ]) {
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    this.textures
      .get("first-floor-map")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures
      .get("fifth-floor-map")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures
      .get("cyclops-rock-gate")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (const biome of ["forest", "lava", "glacier", "ruins"] as const) {
      this.textures
        .get(`battle-floor-${biome}`)
        .setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.textures.get("orban").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.registerCyclopsActionFrames();
    this.textures
      .get("cyclops-actions-pixel")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (const textureKey of [
      "cyclops-walk-8d",
      "soldier-walk-8d",
      "sheep-walk-8d",
    ]) {
      this.registerEightDirectionFrames(textureKey);
      this.textures
        .get(textureKey)
        .setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    for (const direction of PLAYER_DIRECTIONS) {
      for (const frame of [0, 1] as const) {
        this.textures
          .get(`cyclops-attack-v3-${direction}-${frame}`)
          .setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures
          .get(`cyclops-gate-v3-${direction}-${frame}`)
          .setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures
          .get(`soldier-attack-${direction}-${frame}`)
          .setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    for (const actor of ACTOR_KINDS) {
      for (const direction of ACTOR_DIRECTIONS) {
        for (const frame of [0, 1] as const) {
          this.textures
            .get(`actor-${actor}-${direction}-${frame}`)
            .setFilter(Phaser.Textures.FilterMode.NEAREST);
          this.textures
            .get(`actor-${actor}-attack-${direction}-${frame}`)
            .setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
      }
    }
    this.buildZone();
  }

  private registerEightDirectionFrames(textureKey: string): void {
    const texture = this.textures.get(textureKey);
    const source = texture.getSourceImage() as {
      width: number;
      height: number;
    };
    EIGHT_DIRECTION_SHEET_ORDER.forEach((direction, directionIndex) => {
      for (const frame of [0, 1] as const) {
        const cell = directionIndex * 2 + frame;
        const column = cell % 4;
        const row = Math.floor(cell / 4);
        const left = Math.round((column * source.width) / 4);
        const top = Math.round((row * source.height) / 4);
        const right = Math.round(((column + 1) * source.width) / 4);
        const bottom = Math.round(((row + 1) * source.height) / 4);
        texture.add(
          `${direction}-${frame}`,
          0,
          left,
          top,
          right - left,
          bottom - top,
        );
      }
    });
  }

  private registerCyclopsActionFrames(): void {
    const texture = this.textures.get("cyclops-actions-pixel");
    const source = texture.getSourceImage() as {
      width: number;
      height: number;
    };
    const actions = ["idle", "attack", "sleep", "rock"] as const;
    actions.forEach((action, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const left = Math.round((column * source.width) / 2);
      const top = Math.round((row * source.height) / 2);
      const right = Math.round(((column + 1) * source.width) / 2);
      const bottom = Math.round(((row + 1) * source.height) / 2);
      texture.add(action, 0, left, top, right - left, bottom - top);
    });
  }

  update(time: number, delta: number): void {
    const snapshot = useGameStore.getState().snapshot;
    if (snapshot.zone !== this.renderedZone) {
      this.zone = snapshot.zone;
      this.scene.restart();
      return;
    }
    if (snapshot.dialogueOpen) {
      this.aimCursor.setVisible(false);
      return;
    }

    if (this.transitioning) {
      this.aimCursor.setVisible(false);
      return;
    }

    this.updatePlayer(time, delta);
    this.updateDashTrail(time);
    this.updateAim();
    this.updateMinimapMarkers();

    if (this.zone === "battle" && snapshot.floor === FIFTH_FLOOR_NUMBER) {
      if (Phaser.Input.Keyboard.JustDown(this.shoveKey)) {
        this.handleMissionShove(time);
      }
      this.updateFifthFloorMission(time, delta);
    } else if (this.zone === "battle") {
      this.updateEnemies(time, delta);
      this.updateAlly(time, delta);
      this.updateActorUi();
      if (this.pickupKey.isDown) this.collectDrops();
      this.maybeCreateReturnPortal();
    }
    if (this.zone === "battle" && this.skillKey.isDown) this.useSkill(time);

    if (
      this.moveKeys.up.isDown &&
      time >= this.nextPortalAt &&
      this.tryPortal()
    ) {
      this.nextPortalAt = time + 700;
    }
  }

  showZone(zone: ZoneId): void {
    if (!this.scene.isActive() || this.renderedZone === zone) return;
    this.zone = zone;
    this.scene.restart();
  }

  private buildZone(): void {
    this.renderedZone = this.zone;
    this.enemies = [];
    this.drops = [];
    this.portals = [];
    this.ally = undefined;
    this.collisionRects = [];
    this.collisionPolygons = [];
    this.battleLayout = undefined;
    this.minimapMarkers = [];
    this.minimapNpcs = [];
    this.minimapWorldSize = { width: WIDTH, height: HEIGHT };
    this.fifthFloorMission = undefined;
    this.fifthFloorLastPublishedSecond = Number.NaN;
    this.fifthFloorLastCommandRequestId = 0;
    this.cyclopsActor = undefined;
    this.cyclopsVision = undefined;
    this.cyclopsDirection = "west";
    this.cyclopsFacingAngle = CYCLOPS_FACING_ANGLE;
    this.cyclopsPatrolIndex = 1;
    this.cyclopsStrike = undefined;
    this.cyclopsNextStrikeAt = 0;
    this.missionAttackHoldUntil = Number.NEGATIVE_INFINITY;
    this.cyclopsAggroActive = false;
    this.cyclopsAction = "idle";
    this.caveGate = undefined;
    this.caveGateCollider = undefined;
    this.caveGateStateLabel = undefined;
    this.caveGateWalkable = false;
    this.missionAllies = [];
    this.missionSheep = [];
    this.stealthSacrificeInProgress = false;
    this.bossPoseToken = 0;
    this.bossGateActionEndsAt = Number.NEGATIVE_INFINITY;
    this.nextFootstepAt = 0;
    this.nextMissionAnimalSoundAt = 0;
    this.nextImpactSoundAt = 0;
    this.nextMissionShoveAt = 0;
    this.caveCollisionGuide = undefined;
    this.transitioning = false;
    this.returnPortalCreated = false;
    this.cameras.main.setBackgroundColor(zoneBackground(this.zone));
    this.drawFloor();
    this.drawZoneDecoration();

    const spawn = this.playerSpawnPoint();
    this.playerShadow = this.add.ellipse(
      spawn.x,
      spawn.y + 15,
      42,
      15,
      0x071014,
      0.42,
    );
    this.player = this.add
      .image(
        spawn.x,
        spawn.y,
        `player-stance-${useGameStore.getState().snapshot.weapon}-south-0`,
      )
      .setScale(PLAYER_WORLD_SCALE)
      .setOrigin(0.5, 0.78)
      .setDepth(5);
    this.heldWeapon = this.add
      .image(
        spawn.x,
        spawn.y,
        `world-weapon-${useGameStore.getState().snapshot.weapon}`,
      )
      .setDisplaySize(34, 46)
      .setVisible(false)
      .setDepth(5.2);
    this.aimCursor = this.add.graphics().setDepth(30);

    if (this.zone === "rest") this.buildRestZone();
    if (this.zone === "battle") this.buildBattleZone();
    if (this.zone === "shop") this.buildShopZone();
    if (
      this.zone !== "battle" ||
      useGameStore.getState().snapshot.floor !== FIFTH_FLOOR_NUMBER
    ) {
      useGameStore.getState().setFifthFloorMission(null);
      useGameStore.getState().clearFifthFloorCommandRequest();
    }
    this.configureCamera();
    this.cameras.main.fadeIn(180, 10, 14, 18);
  }

  private playerSpawnPoint(): { x: number; y: number } {
    if (this.zone === "rest") return { x: 640, y: 560 };
    if (this.zone === "shop") return { x: 640, y: 580 };
    if (useGameStore.getState().snapshot.floor === FIFTH_FLOOR_NUMBER) {
      if (
        import.meta.env.DEV &&
        new URLSearchParams(window.location.search).get("debugSpawn") ===
          "cyclops"
      ) {
        return { x: 1950, y: 800 };
      }
      if (
        import.meta.env.DEV &&
        new URLSearchParams(window.location.search).get("debugSpawn") ===
          "beach"
      ) {
        return { x: 3380, y: 800 };
      }
      return CAVE_PLAYER_SPAWN;
    }
    return this.findOpenBattlePoint(
      this.movementBounds.left + this.movementBounds.width * 0.22,
      this.movementBounds.bottom - 150,
    );
  }

  private configureCamera(): void {
    const camera = this.cameras.main;
    camera.stopFollow();
    camera.setZoom(1);
    if (this.zone === "battle" && (this.battleLayout || this.isFifthFloor())) {
      camera.setBounds(
        0,
        0,
        this.battleLayout?.worldWidth ?? CAVE_WORLD_WIDTH,
        this.battleLayout?.worldHeight ?? CAVE_WORLD_HEIGHT,
      );
      camera.startFollow(this.player, true, 0.12, 0.12);
      camera.setDeadzone(220, 140);
      camera.centerOn(this.player.x, this.player.y);
      this.createMinimap();
      return;
    }
    camera.setBounds(0, 0, WIDTH, HEIGHT);
    camera.setScroll(0, 0);
    this.createMinimap();
  }

  private drawFloor(): void {
    if (this.zone === "rest") {
      this.add
        .image(WIDTH / 2, HEIGHT / 2, "first-floor-map")
        .setDisplaySize(WIDTH, HEIGHT)
        .setDepth(-4);
      this.add
        .rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x071014, 0.16)
        .setDepth(-3);
      this.configureRestCollision();
      return;
    }

    const floor = useGameStore.getState().snapshot.floor;
    if (this.zone === "battle") {
      this.drawBattleFloor(floor);
      return;
    }

    const arenaWidth = 1100;
    const arenaHeight = 570;
    const arenaX = (WIDTH - arenaWidth) / 2;
    const arenaY = (HEIGHT - arenaHeight) / 2 + 6;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x263932, 1);
    graphics.fillRoundedRect(arenaX, arenaY, arenaWidth, arenaHeight, 36);
    graphics.lineStyle(2, 0x54715f, 0.72);
    const tileSize = 54 + (floor % 4) * 9;
    for (let x = arenaX + 35; x < arenaX + arenaWidth; x += tileSize) {
      graphics.lineBetween(x, arenaY + 15, x - 18, arenaY + arenaHeight - 15);
    }
    for (let y = arenaY + 28; y < arenaY + arenaHeight; y += tileSize - 8) {
      graphics.lineBetween(arenaX + 16, y, arenaX + arenaWidth - 16, y);
    }
    graphics.lineStyle(5, 0x91b797, 0.32);
    graphics.strokeRoundedRect(arenaX, arenaY, arenaWidth, arenaHeight, 36);

    this.movementBounds = new Phaser.Geom.Rectangle(
      arenaX + 15,
      arenaY + 15,
      arenaWidth - 30,
      arenaHeight - 30,
    );
    this.addPixelObstacle(248, 330, 112, 180, 0x31483e, 0x769278);
    this.addPixelObstacle(1032, 330, 112, 180, 0x31483e, 0x769278);
  }

  private drawBattleFloor(floor: number): void {
    if (floor === FIFTH_FLOOR_NUMBER) {
      this.drawCyclopsCaveFloor();
      return;
    }
    const layout = getBattleLayout(floor);
    this.battleLayout = layout;
    const { palette, worldWidth, worldHeight } = layout;
    this.add
      .tileSprite(
        worldWidth / 2,
        worldHeight / 2,
        worldWidth,
        worldHeight,
        `battle-floor-${layout.biome}`,
      )
      .setTileScale(0.52)
      .setDepth(-4);

    const graphics = this.add.graphics().setDepth(-3);
    graphics.fillStyle(0x0b1014, 1);
    graphics.fillRect(0, 0, worldWidth, 76);
    graphics.fillRect(0, worldHeight - 76, worldWidth, 76);
    graphics.fillRect(0, 76, 76, worldHeight - 152);
    graphics.fillRect(worldWidth - 76, 76, 76, worldHeight - 152);
    graphics.fillStyle(palette.ground, 0.13);
    graphics.fillRect(76, 76, worldWidth - 152, worldHeight - 152);

    for (const region of layout.terrain) {
      const fill =
        region.kind === "secondary"
          ? palette.secondaryGround
          : region.kind === "path"
            ? palette.path
            : region.kind === "water"
              ? palette.water
              : palette.stone;
      const regionAlpha =
        region.kind === "water"
          ? 0.82
          : region.kind === "secondary"
            ? 0.58
            : region.kind === "path"
              ? 0.44
              : 0.56;
      graphics.fillStyle(fill, regionAlpha);
      const points = region.points.map((point) => ({ ...point }));
      graphics.fillPoints(points, true);
      graphics.lineStyle(9, 0x05090b, region.kind === "water" ? 0.44 : 0.2);
      graphics.strokePoints(points, true);
      graphics.lineStyle(
        region.kind === "water" ? 4 : 2,
        region.kind === "water" ? palette.waterLight : palette.edge,
        region.kind === "water" ? 0.72 : 0.42,
      );
      graphics.strokePoints(points, true);
      if (region.kind === "water") {
        this.collisionPolygons.push(new Phaser.Geom.Polygon(points));
      }
    }

    this.drawBiomeDetails(layout);
    this.drawWorldWalls(layout);
    this.movementBounds = new Phaser.Geom.Rectangle(
      98,
      98,
      worldWidth - 196,
      worldHeight - 196,
    );
    for (const boundary of layout.boundaries) {
      this.addBattleBoundary(boundary, layout);
    }
    for (const obstacle of layout.obstacles)
      this.addBattleObstacle(obstacle, layout);
  }

  private drawCyclopsCaveFloor(): void {
    this.minimapWorldSize = {
      width: CAVE_WORLD_WIDTH,
      height: CAVE_WORLD_HEIGHT,
    };
    this.movementBounds = new Phaser.Geom.Rectangle(
      CAVE_MOVEMENT_BOUNDS.x,
      CAVE_MOVEMENT_BOUNDS.y,
      CAVE_MOVEMENT_BOUNDS.width,
      CAVE_MOVEMENT_BOUNDS.height,
    );

    this.add
      .image(CAVE_WORLD_WIDTH / 2, CAVE_WORLD_HEIGHT / 2, "fifth-floor-map")
      .setDisplaySize(CAVE_WORLD_WIDTH, 2_345)
      .setDepth(-5);

    const floor = this.add.graphics().setDepth(-4);
    floor.fillStyle(0x060504, 0.16);
    floor.fillRect(0, 0, CAVE_WORLD_WIDTH, CAVE_WORLD_HEIGHT);
    floor.fillStyle(0x120d0a, 0.2);
    floor.fillRoundedRect(
      76,
      72,
      CAVE_WORLD_WIDTH - 142,
      CAVE_WORLD_HEIGHT - 144,
      110,
    );
    floor.lineStyle(4, 0x9dded2, 0.24);
    floor.strokeRoundedRect(
      BEACH_REGION.x,
      BEACH_REGION.y,
      BEACH_REGION.width,
      BEACH_REGION.height,
      86,
    );
    this.collisionRects.push(
      new Phaser.Geom.Rectangle(3970, BEACH_REGION.y, 110, BEACH_REGION.height),
    );

    const walls = this.add.graphics().setDepth(-1);
    walls.fillStyle(0x070605, 1);
    walls.fillRect(0, 0, CAVE_WORLD_WIDTH, 112);
    walls.fillRect(0, CAVE_WORLD_HEIGHT - 112, CAVE_WORLD_WIDTH, 112);
    walls.fillRect(0, 0, 112, CAVE_WORLD_HEIGHT);
    walls.fillRect(CAVE_WORLD_WIDTH - 68, 0, 68, CAVE_WORLD_HEIGHT);
    walls.fillStyle(0x18110e, 1);
    walls.fillRect(18, 32, CAVE_WORLD_WIDTH - 36, 54);
    walls.fillRect(18, CAVE_WORLD_HEIGHT - 86, CAVE_WORLD_WIDTH - 36, 54);

    for (const obstacle of CAVE_OBSTACLES) {
      const x = obstacle.x + obstacle.width / 2;
      const y = obstacle.y + obstacle.height / 2;
      const shadow = this.add
        .ellipse(
          x + 12,
          y + obstacle.height * 0.34,
          obstacle.width,
          obstacle.height * 0.5,
          0x050403,
          0.55,
        )
        .setDepth(-0.5);
      const rock = this.add.graphics().setDepth(1);
      rock.fillStyle(0x211814, 1);
      rock.fillRoundedRect(
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height,
        42,
      );
      rock.lineStyle(5, 0x5a3c29, 0.68);
      rock.strokeRoundedRect(
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height,
        42,
      );
      rock.lineStyle(2, 0x8b5b37, 0.32);
      rock.lineBetween(
        obstacle.x + 28,
        obstacle.y + 24,
        obstacle.x + obstacle.width - 24,
        obstacle.y + obstacle.height - 26,
      );
      shadow.setAngle((obstacle.x + obstacle.y) % 13);
    }

    this.collisionRects.push(
      ...CAVE_STRUCTURE_COLLIDERS.map(
        ({ x, y, width, height }) =>
          new Phaser.Geom.Rectangle(x, y, width, height),
      ),
    );

    for (const [x, y] of [
      [420, 330],
      [420, 1260],
      [1150, 190],
      [2050, 250],
    ] as const) {
      this.add.circle(x, y, 92, 0xff7a31, 0.05).setDepth(0);
      this.add.circle(x, y, 14, 0xff9a42, 0.34).setDepth(1);
      this.add.circle(x, y - 3, 6, 0xffe09a, 0.9).setDepth(2);
    }
    this.caveCollisionGuide = this.add
      .graphics()
      .setDepth(10.5)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.updateCaveCollisionGuide();
  }

  private updateCaveCollisionGuide(): void {
    if (!this.caveCollisionGuide) return;
    this.caveCollisionGuide.clear();
    this.caveCollisionGuide.fillStyle(0xff0000, 0.1);
    this.caveCollisionGuide.lineStyle(8, 0xff1010, 1);
    for (const collider of CAVE_STRUCTURE_COLLIDERS) {
      this.caveCollisionGuide.fillRect(
        collider.x,
        collider.y,
        collider.width,
        collider.height,
      );
      this.caveCollisionGuide.strokeRect(
        collider.x,
        collider.y,
        collider.width,
        collider.height,
      );
    }
    if (
      this.caveGateCollider &&
      this.collisionRects.includes(this.caveGateCollider)
    ) {
      this.caveCollisionGuide.fillRect(
        this.caveGateCollider.x,
        this.caveGateCollider.y,
        this.caveGateCollider.width,
        this.caveGateCollider.height,
      );
      this.caveCollisionGuide.strokeRect(
        this.caveGateCollider.x,
        this.caveGateCollider.y,
        this.caveGateCollider.width,
        this.caveGateCollider.height,
      );
    }
  }

  private drawWorldWalls(layout: BattleLayout): void {
    const { worldWidth, worldHeight, palette } = layout;
    const walls = this.add.graphics().setDepth(-1);
    walls.fillStyle(0x05080a, 0.68);
    walls.fillRect(32, 48, worldWidth - 64, 64);
    walls.fillRect(32, worldHeight - 104, worldWidth - 64, 64);
    walls.fillStyle(palette.wall, 0.94);
    walls.fillRect(42, 42, worldWidth - 84, 56);
    walls.fillRect(42, worldHeight - 98, worldWidth - 84, 56);
    walls.fillRect(42, 98, 56, worldHeight - 196);
    walls.fillRect(worldWidth - 98, 98, 56, worldHeight - 196);
    walls.lineStyle(8, palette.wallEdge, 0.9);
    walls.strokeRect(76, 76, worldWidth - 152, worldHeight - 152);
    walls.lineStyle(3, palette.edge, 0.72);
    walls.strokeRect(96, 96, worldWidth - 192, worldHeight - 192);
    walls.lineStyle(2, 0x050708, 0.46);
    for (let x = 54; x < worldWidth - 54; x += 46) {
      walls.lineBetween(x, 52, x + 12, 96);
      walls.lineBetween(x, worldHeight - 96, x + 12, worldHeight - 52);
    }
    for (let y = 112; y < worldHeight - 112; y += 38) {
      walls.lineBetween(48, y, 96, y + 11);
      walls.lineBetween(worldWidth - 96, y, worldWidth - 48, y + 11);
    }
  }

  private drawBiomeDetails(layout: BattleLayout): void {
    const { worldWidth, worldHeight, palette } = layout;
    const details = this.add.graphics().setDepth(-2);
    for (let index = 0; index < 58; index += 1) {
      const x = 150 + ((index * 317 + worldWidth) % (worldWidth - 300));
      const y = 150 + ((index * 191 + worldHeight) % (worldHeight - 300));
      if (x < worldWidth * 0.57) {
        details.fillStyle(
          index % 3 === 0 ? palette.accent : palette.groundAlt,
          0.42,
        );
        details.fillCircle(x, y, 4 + (index % 3) * 2);
        details.lineStyle(2, palette.edge, 0.32);
        details.lineBetween(x - 6, y + 4, x + 7, y - 4);
      } else {
        details.fillStyle(
          index % 2 === 0 ? palette.hazard : palette.wallEdge,
          0.34,
        );
        details.fillCircle(x, y, 3 + (index % 4));
        if (index % 3 === 0) {
          details.lineStyle(2, palette.wall, 0.38);
          details.lineBetween(x - 7, y + 2, x + 8, y - 3);
        }
      }
    }
    for (const region of layout.terrain.filter(
      (item) => item.kind === "water",
    )) {
      const centerX =
        region.points.reduce((sum, point) => sum + point.x, 0) /
        region.points.length;
      const centerY =
        region.points.reduce((sum, point) => sum + point.y, 0) /
        region.points.length;
      const polygon = new Phaser.Geom.Polygon(
        region.points.map((point) => ({ ...point })),
      );
      for (let index = 0; index < 24; index += 1) {
        const x = centerX - 150 + ((index * 67) % 300);
        const y = centerY - 92 + ((index * 43) % 184);
        if (!Phaser.Geom.Polygon.Contains(polygon, x, y)) continue;
        details.lineStyle(index % 3 === 0 ? 3 : 2, palette.waterLight, 0.46);
        details.lineBetween(x - 13, y, x + 13 + (index % 4) * 4, y);
        details.lineStyle(1, 0xffffff, 0.18);
        details.lineBetween(x - 8, y - 3, x + 6, y - 3);
      }
    }
  }

  private addBattleBoundary(
    boundary: BattleBoundarySpec,
    layout: BattleLayout,
  ): void {
    const graphics = this.add.graphics().setDepth(1);
    if (boundary.kind === "cliff") {
      graphics.fillStyle(0x050709, 0.5);
      graphics.fillRect(
        boundary.x - boundary.width / 2 + 8,
        boundary.y - boundary.height / 2 + 10,
        boundary.width,
        boundary.height,
      );
      graphics.fillStyle(layout.palette.wall, 1);
      graphics.fillRect(
        boundary.x - boundary.width / 2,
        boundary.y - boundary.height / 2,
        boundary.width,
        boundary.height,
      );
      graphics.fillStyle(layout.palette.wallEdge, 0.9);
      graphics.fillRect(
        boundary.x - boundary.width / 2 - 5,
        boundary.y - boundary.height / 2,
        boundary.width + 10,
        13,
      );
      for (
        let y = boundary.y - boundary.height / 2 + 27;
        y < boundary.y + boundary.height / 2;
        y += 34
      ) {
        graphics.lineStyle(3, layout.palette.wallEdge, 0.38);
        graphics.lineBetween(
          boundary.x - boundary.width / 2 + 8,
          y,
          boundary.x + boundary.width / 2 - 8,
          y + 7,
        );
      }
    } else {
      graphics.fillStyle(0x050709, 0.46);
      graphics.fillRect(
        boundary.x - boundary.width / 2 + 7,
        boundary.y - boundary.height / 2 + 8,
        boundary.width,
        boundary.height,
      );
      graphics.fillStyle(layout.palette.wall, 1);
      graphics.fillRect(
        boundary.x - boundary.width / 2,
        boundary.y - boundary.height / 2,
        boundary.width,
        boundary.height,
      );
      graphics.fillStyle(layout.palette.stone, 0.54);
      graphics.fillRect(
        boundary.x - boundary.width / 2 + 5,
        boundary.y - boundary.height / 2 + 5,
        boundary.width - 10,
        10,
      );
      graphics.lineStyle(3, layout.palette.edge, 0.48);
      graphics.strokeRect(
        boundary.x - boundary.width / 2,
        boundary.y - boundary.height / 2,
        boundary.width,
        boundary.height,
      );
    }
    this.collisionRects.push(
      new Phaser.Geom.Rectangle(
        boundary.x - boundary.width / 2,
        boundary.y - boundary.height / 2,
        boundary.width,
        boundary.height,
      ),
    );
  }

  private addBattleObstacle(
    obstacle: BattleObstacleSpec,
    layout: BattleLayout,
  ): void {
    this.collisionRects.push(
      new Phaser.Geom.Rectangle(
        obstacle.x - obstacle.width / 2,
        obstacle.y - obstacle.height / 2,
        obstacle.width,
        obstacle.height,
      ),
    );
    this.add
      .ellipse(
        obstacle.x + 7,
        obstacle.y + obstacle.height * 0.08,
        obstacle.width * 0.86,
        obstacle.height * 0.28,
        0x050709,
        0.46,
      )
      .setDepth(0);
    const crown = this.add.graphics().setDepth(2);
    if (obstacle.kind === "tree") {
      crown.fillStyle(0x37271d, 1);
      crown.fillRoundedRect(
        obstacle.x - 13,
        obstacle.y - obstacle.height * 0.56,
        26,
        obstacle.height * 0.64,
        8,
      );
      crown.fillStyle(0x65442c, 0.72);
      crown.fillRect(
        obstacle.x - 7,
        obstacle.y - obstacle.height * 0.5,
        5,
        obstacle.height * 0.52,
      );
      crown.fillStyle(0x315d36, 1);
      crown.fillCircle(
        obstacle.x,
        obstacle.y - obstacle.height * 0.42,
        obstacle.width * 0.34,
      );
      crown.fillStyle(0x4f8247, 0.9);
      crown.fillCircle(
        obstacle.x - 22,
        obstacle.y - obstacle.height * 0.5,
        obstacle.width * 0.22,
      );
      crown.fillCircle(
        obstacle.x + 24,
        obstacle.y - obstacle.height * 0.48,
        obstacle.width * 0.24,
      );
      crown.fillStyle(layout.palette.accent, 0.34);
      crown.fillCircle(
        obstacle.x - obstacle.width * 0.12,
        obstacle.y - obstacle.height * 0.6,
        obstacle.width * 0.14,
      );
    } else if (obstacle.kind === "cactus") {
      crown.fillStyle(0x39744b, 1);
      crown.fillRoundedRect(
        obstacle.x - 13,
        obstacle.y - obstacle.height * 0.72,
        26,
        obstacle.height * 0.68,
        10,
      );
      crown.fillRoundedRect(
        obstacle.x - 34,
        obstacle.y - obstacle.height * 0.48,
        24,
        18,
        8,
      );
      crown.fillRoundedRect(
        obstacle.x + 10,
        obstacle.y - obstacle.height * 0.6,
        28,
        18,
        8,
      );
      crown.lineStyle(3, 0x8bb76b, 0.65);
      crown.lineBetween(
        obstacle.x,
        obstacle.y - obstacle.height * 0.66,
        obstacle.x,
        obstacle.y - 12,
      );
    } else if (obstacle.kind === "dead-tree") {
      crown.lineStyle(13, 0x38271f, 1);
      crown.lineBetween(
        obstacle.x,
        obstacle.y - 8,
        obstacle.x,
        obstacle.y - obstacle.height * 0.72,
      );
      crown.lineBetween(
        obstacle.x,
        obstacle.y - obstacle.height * 0.52,
        obstacle.x - 38,
        obstacle.y - obstacle.height * 0.8,
      );
      crown.lineBetween(
        obstacle.x + 2,
        obstacle.y - obstacle.height * 0.44,
        obstacle.x + 42,
        obstacle.y - obstacle.height * 0.7,
      );
      crown.lineStyle(6, 0x60402d, 0.9);
      crown.lineBetween(
        obstacle.x - 38,
        obstacle.y - obstacle.height * 0.8,
        obstacle.x - 50,
        obstacle.y - obstacle.height * 0.92,
      );
      crown.lineBetween(
        obstacle.x + 42,
        obstacle.y - obstacle.height * 0.7,
        obstacle.x + 55,
        obstacle.y - obstacle.height * 0.82,
      );
    } else if (obstacle.kind === "ruin") {
      crown.fillStyle(layout.palette.stone, 1);
      crown.fillRect(
        obstacle.x - obstacle.width * 0.42,
        obstacle.y - obstacle.height * 0.7,
        obstacle.width * 0.22,
        obstacle.height * 0.66,
      );
      crown.fillRect(
        obstacle.x + obstacle.width * 0.2,
        obstacle.y - obstacle.height * 0.62,
        obstacle.width * 0.22,
        obstacle.height * 0.58,
      );
      crown.fillRect(
        obstacle.x - obstacle.width * 0.35,
        obstacle.y - obstacle.height * 0.72,
        obstacle.width * 0.58,
        17,
      );
      crown.lineStyle(4, layout.palette.edge, 0.52);
      crown.lineBetween(
        obstacle.x - 25,
        obstacle.y - obstacle.height * 0.54,
        obstacle.x + 18,
        obstacle.y - obstacle.height * 0.43,
      );
    } else if (obstacle.kind === "basalt") {
      crown.fillStyle(0x20181a, 1);
      crown.fillTriangle(
        obstacle.x - obstacle.width * 0.42,
        obstacle.y,
        obstacle.x - obstacle.width * 0.08,
        obstacle.y - obstacle.height * 0.74,
        obstacle.x + obstacle.width * 0.18,
        obstacle.y,
      );
      crown.lineStyle(4, layout.palette.accent, 0.65);
      crown.lineBetween(
        obstacle.x - 8,
        obstacle.y - 12,
        obstacle.x + 9,
        obstacle.y - 48,
      );
    } else if (obstacle.kind === "ice") {
      crown.fillStyle(0x72c7db, 0.72);
      crown.fillTriangle(
        obstacle.x - obstacle.width * 0.4,
        obstacle.y,
        obstacle.x,
        obstacle.y - obstacle.height * 0.85,
        obstacle.x + obstacle.width * 0.42,
        obstacle.y,
      );
      crown.lineStyle(3, 0xd8fbff, 0.7);
      crown.lineBetween(
        obstacle.x,
        obstacle.y - obstacle.height * 0.75,
        obstacle.x - 12,
        obstacle.y - 6,
      );
    } else {
      crown.fillStyle(0x51445f, 1);
      crown.fillRect(
        obstacle.x - obstacle.width * 0.38,
        obstacle.y - obstacle.height * 0.62,
        obstacle.width * 0.76,
        obstacle.height * 0.58,
      );
      crown.lineStyle(3, layout.palette.accent, 0.58);
      crown.strokeRect(
        obstacle.x - obstacle.width * 0.3,
        obstacle.y - obstacle.height * 0.54,
        obstacle.width * 0.6,
        obstacle.height * 0.42,
      );
    }
  }

  private configureRestCollision(): void {
    // The walkable floor begins inside the visible inner wall cap. Player
    // collision uses the feet rectangle, so these insets keep the sprite from
    // visually crossing the masonry while still allowing close wall movement.
    this.movementBounds = new Phaser.Geom.Rectangle(
      REST_MOVEMENT_BOUNDS.x,
      REST_MOVEMENT_BOUNDS.y,
      REST_MOVEMENT_BOUNDS.width,
      REST_MOVEMENT_BOUNDS.height,
    );
    const colliders = REST_STRUCTURE_COLLIDERS.map(
      ({ x, y, width, height }) =>
        new Phaser.Geom.Rectangle(x, y, width, height),
    );
    this.collisionRects.push(...colliders);
    const contact = this.add.graphics().setDepth(2);
    contact.lineStyle(3, 0xc8b98e, 0.28);
    for (const rect of colliders) {
      contact.lineBetween(
        rect.left + 4,
        rect.bottom,
        rect.right - 4,
        rect.bottom,
      );
    }
    const wallShade = this.add.graphics().setDepth(1);
    wallShade.fillStyle(0x05090b, 0.3);
    wallShade.fillRect(140, 204, 652, 14);
    wallShade.fillRect(126, 214, 14, 506);
    wallShade.fillRect(792, 214, 14, 506);
  }

  private addPixelObstacle(
    x: number,
    y: number,
    width: number,
    height: number,
    fill: number,
    edge: number,
  ): void {
    const shadow = this.add
      .rectangle(x + 7, y + 9, width, height, 0x05090b, 0.5)
      .setDepth(-1);
    const body = this.add
      .rectangle(x, y, width, height, fill)
      .setStrokeStyle(5, edge, 0.82)
      .setDepth(0);
    const cap = this.add
      .rectangle(x, y - height / 2 + 8, width - 12, 9, edge, 0.52)
      .setDepth(1);
    shadow.setOrigin(0.5);
    body.setOrigin(0.5);
    cap.setOrigin(0.5);
    this.collisionRects.push(
      new Phaser.Geom.Rectangle(x - width / 2, y - height / 2, width, height),
    );
  }

  private drawZoneDecoration(): void {
    const floor = useGameStore.getState().snapshot.floor;
    const title =
      this.zone === "rest"
        ? `${floor}층 · 탑 휴식처`
        : this.zone === "battle"
          ? floor === FIFTH_FLOOR_NUMBER
            ? "5층 · 외눈박이의 큰 동굴"
            : `${floor}층 · ${getBattleLayout(floor).name}`
          : "뿌리와 룬 · 아이템 상점";
    this.add
      .text(640, this.zone === "battle" ? 54 : 126, title, {
        color: "#e1d4b8",
        fontFamily: GAME_FONT,
        fontSize: "18px",
        letterSpacing: 2,
        backgroundColor: "#071014b8",
        padding: { x: 14, y: 6 },
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setScrollFactor(this.zone === "battle" ? 0 : 1)
      .setDepth(40)
      .setAlpha(0.88);

    if (this.zone === "rest") return;
    const areaWidth =
      this.battleLayout?.worldWidth ?? this.minimapWorldSize.width;
    const areaHeight =
      this.battleLayout?.worldHeight ?? this.minimapWorldSize.height;
    for (let index = 0; index < 32; index += 1) {
      const x = 120 + ((index * 167) % (areaWidth - 240));
      const y = 115 + ((index * 197) % (areaHeight - 230));
      this.add.circle(x, y, index % 3 === 0 ? 3 : 2, 0x8ce6d0, 0.2);
    }
  }

  private createMinimap(): void {
    const layout = this.battleLayout;
    const mapWidth = 184;
    const mapHeight = 116;
    const originX = WIDTH - mapWidth - 26;
    const originY = 132;
    this.minimapWorldSize = {
      width:
        layout?.worldWidth ?? (this.isFifthFloor() ? CAVE_WORLD_WIDTH : WIDTH),
      height:
        layout?.worldHeight ??
        (this.isFifthFloor() ? CAVE_WORLD_HEIGHT : HEIGHT),
    };
    const scaleX = mapWidth / this.minimapWorldSize.width;
    const scaleY = mapHeight / this.minimapWorldSize.height;
    const map = this.add.graphics().setScrollFactor(0).setDepth(42);
    map.fillStyle(0x071014, 0.82);
    map.fillRoundedRect(
      originX - 8,
      originY - 8,
      mapWidth + 16,
      mapHeight + 42,
      10,
    );
    map.fillStyle(layout?.palette.ground ?? zoneBackground(this.zone), 0.92);
    map.fillRect(originX, originY, mapWidth, mapHeight);
    if (layout) {
      for (const region of layout.terrain) {
        const fill =
          region.kind === "secondary"
            ? layout.palette.secondaryGround
            : region.kind === "path"
              ? layout.palette.path
              : region.kind === "water"
                ? layout.palette.water
                : layout.palette.stone;
        map.fillStyle(fill, 0.96);
        map.fillPoints(
          region.points.map((point) => ({
            x: originX + point.x * scaleX,
            y: originY + point.y * scaleY,
          })),
          true,
        );
      }
    }
    map.lineStyle(2, layout?.palette.edge ?? 0x7a8e85, 0.82);
    map.strokeRect(originX, originY, mapWidth, mapHeight);
    map.fillStyle(layout?.palette.wallEdge ?? 0x41534d, 0.9);
    const geometry = layout
      ? [...layout.boundaries, ...layout.obstacles]
      : this.collisionRects.map((rect) => ({
          x: rect.centerX,
          y: rect.centerY,
          width: rect.width,
          height: rect.height,
        }));
    for (const obstacle of geometry) {
      map.fillRect(
        originX + (obstacle.x - obstacle.width / 2) * scaleX,
        originY + (obstacle.y - obstacle.height / 2) * scaleY,
        Math.max(3, obstacle.width * scaleX),
        Math.max(3, obstacle.height * scaleY),
      );
    }

    this.addMinimapMarker("player", () => ({
      x: this.player.x,
      y: this.player.y,
      active: this.player.active,
    }));
    for (const actor of this.enemies) {
      this.addMinimapMarker("enemy", () => ({
        x: actor.node.x,
        y: actor.node.y,
        active: actor.node.active,
      }));
    }
    if (this.ally) {
      const ally = this.ally;
      this.addMinimapMarker("ally", () => ({
        x: ally.node.x,
        y: ally.node.y,
        active: ally.node.active,
      }));
    }
    if (this.cyclopsBoss) {
      const boss = this.cyclopsBoss;
      this.addMinimapMarker("enemy", () => ({
        x: boss.x,
        y: boss.y,
        active: boss.active,
      }));
    }
    for (const npc of this.minimapNpcs) {
      this.addMinimapMarker("npc", () => npc);
    }
    this.createMinimapLegend(originX, originY + mapHeight + 12);
    this.updateMinimapMarkers();
  }

  private addMinimapMarker(
    kind: MinimapMarkerKind,
    source: MinimapMarker["source"],
  ): void {
    const colors: Record<MinimapMarkerKind, number> = {
      player: 0xffffff,
      ally: 0x58dfaa,
      enemy: 0xf05e66,
      npc: 0xf2c86f,
    };
    const marker = this.add
      .circle(0, 0, kind === "enemy" ? 3 : 4, colors[kind])
      .setStrokeStyle(1.5, kind === "player" ? 0x65e6d0 : 0x071014)
      .setScrollFactor(0)
      .setDepth(43);
    this.minimapMarkers.push({ node: marker, source });
  }

  private createMinimapLegend(originX: number, y: number): void {
    const entries: readonly [MinimapMarkerKind, string, number][] = [
      ["player", "나", 0xffffff],
      ["ally", "아군", 0x58dfaa],
      ["enemy", "적", 0xf05e66],
      ["npc", "NPC", 0xf2c86f],
    ];
    let x = originX + 4;
    for (const [, label, color] of entries) {
      this.add.circle(x, y, 3, color).setScrollFactor(0).setDepth(43);
      this.add
        .text(x + 6, y, label, {
          color: "#c4d2cd",
          fontFamily: GAME_FONT,
          fontSize: "9px",
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(43)
        .setResolution(2);
      x += label === "NPC" ? 43 : label === "아군" ? 48 : 38;
    }
  }

  private updateMinimapMarkers(): void {
    const mapWidth = 184;
    const mapHeight = 116;
    const originX = WIDTH - mapWidth - 26;
    const originY = 132;
    for (const marker of this.minimapMarkers) {
      const source = marker.source();
      marker.node.setVisible(source.active !== false);
      if (source.active === false) continue;
      marker.node.setPosition(
        originX + (source.x / this.minimapWorldSize.width) * mapWidth,
        originY + (source.y / this.minimapWorldSize.height) * mapHeight,
      );
    }
  }

  private buildRestZone(): void {
    const floor = useGameStore.getState().snapshot.floor;
    this.minimapNpcs.push({ x: 640, y: 267 });
    this.add.ellipse(640, 305, 50, 14, 0x050708, 0.48).setDepth(3);
    this.add.image(640, 267, "orban").setDisplaySize(54, 80).setDepth(4);
    this.collisionRects.push(new Phaser.Geom.Rectangle(622, 248, 36, 54));
    this.add
      .text(640, 326, "탑 관리자 · 오르반", {
        color: "#ead9b4",
        fontFamily: GAME_FONT,
        fontSize: "16px",
        backgroundColor: "#0a0f12d4",
        padding: { x: 9, y: 4 },
      })
      .setOrigin(0.5)
      .setResolution(2);

    this.createPortal(
      REST_PORTAL_POSITIONS.battle.x,
      REST_PORTAL_POSITIONS.battle.y,
      "battle",
      `${floor}층 공략`,
    );
    this.createPortal(
      REST_PORTAL_POSITIONS.shop.x,
      REST_PORTAL_POSITIONS.shop.y,
      "shop",
      "아이템 상점",
    );
    this.addInstruction(640, 652, "빛나는 게이트 앞에서 W를 누르면 이동합니다");
  }

  private buildBattleZone(): void {
    const floor = useGameStore.getState().snapshot.floor;
    if (floor === FIFTH_FLOOR_NUMBER) {
      this.buildCyclopsZone();
      return;
    }
    const difficulty = getFloorDifficulty(floor);
    const left = this.movementBounds.left;
    const top = this.movementBounds.top;
    const width = this.movementBounds.width;
    const height = this.movementBounds.height;
    const kinds: readonly ActorKind[] = ["rat", "beetle", "wraith"];
    const names = ["회랑 쥐", "불씨 벌레", "탑의 잔영"] as const;
    const baseHp = [45, 55, 65] as const;
    const baseSpeed = [70, 62, 78] as const;
    const anchors = [
      [0.18, 0.2],
      [0.78, 0.18],
      [0.72, 0.46],
      [0.26, 0.5],
      [0.5, 0.28],
      [0.84, 0.68],
      [0.16, 0.72],
      [0.5, 0.58],
      [0.38, 0.16],
    ] as const;
    for (let index = 0; index < difficulty.enemyCount; index += 1) {
      const kindIndex = index % kinds.length;
      const anchor = anchors[index % anchors.length]!;
      const point = this.findOpenBattlePoint(
        left + width * anchor[0],
        top + height * anchor[1],
      );
      this.spawnEnemy(
        point.x,
        point.y,
        kinds[kindIndex]!,
        `${floor}층 ${names[kindIndex]}`,
        Math.round(baseHp[kindIndex]! * difficulty.vitality),
        baseSpeed[kindIndex]! * difficulty.speed,
        false,
        28 + kindIndex * 7 + floor * 6,
      );
    }

    const role = useGameStore.getState().snapshot.wandererRole;
    const allyPoint = this.findOpenBattlePoint(
      this.player.x - 130,
      this.player.y - 120,
    );
    const hostilePoint = this.findOpenBattlePoint(
      left + width * 0.42,
      top + height * 0.38,
    );
    if (role === "ally") {
      this.ally = this.spawnActor(
        allyPoint.x,
        allyPoint.y,
        "wanderer",
        "방랑자 · 아군",
        Math.round(80 * difficulty.vitality),
        118,
        true,
        0,
      );
    } else {
      const enemyWanderer = this.spawnEnemy(
        hostilePoint.x,
        hostilePoint.y,
        "wanderer",
        "방랑자 · 적군",
        Math.round(85 * difficulty.vitality),
        96 * difficulty.speed,
        true,
        56 + floor * 8,
      );
      enemyWanderer.node.setTint(0xffa85c);
    }

    this.addInstruction(
      this.player.x,
      this.player.y + 78,
      role === "ally"
        ? "청록 방랑자는 아군입니다 · 함께 적을 쓰러뜨리세요"
        : "주황 방랑자는 적군입니다 · 몬스터와 함께 공격합니다",
    );
  }

  private buildCyclopsZone(): void {
    const store = useGameStore.getState();
    store.clearFifthFloorCommandRequest();
    this.fifthFloorMission = createFifthFloorMission();
    if (import.meta.env.DEV) {
      const debugSeconds = Number(
        new URLSearchParams(window.location.search).get("missionSeconds"),
      );
      if (Number.isFinite(debugSeconds) && debugSeconds > 0) {
        this.fifthFloorMission = {
          ...this.fifthFloorMission,
          remainingMs: debugSeconds * 1_000,
        };
      }
    }

    this.cyclopsVision = this.add.graphics().setDepth(2);
    const cyclopsNode = this.add
      .sprite(
        CYCLOPS_POSITION.x,
        CYCLOPS_POSITION.y,
        "cyclops-walk-8d",
        "west-0",
      )
      .setDisplaySize(CYCLOPS_DISPLAY_SIZE, CYCLOPS_DISPLAY_SIZE)
      .setOrigin(0.5, 0.72)
      .setDepth(4);

    const gate = this.add
      .container(CAVE_GATE_POSITION.x, CAVE_GATE_POSITION.y)
      .setDepth(3);
    const gateShadow = this.add.ellipse(16, 118, 270, 92, 0x030302, 0.62);
    const slab = this.add
      .image(0, -6, "cyclops-rock-gate")
      .setDisplaySize(292, 372)
      .setOrigin(0.5, 0.5);
    gate.add([gateShadow, slab]);
    this.caveGate = gate;
    this.caveGateCollider = new Phaser.Geom.Rectangle(
      CAVE_GATE_COLLIDER.x,
      CAVE_GATE_COLLIDER.y,
      CAVE_GATE_COLLIDER.width,
      CAVE_GATE_COLLIDER.height,
    );
    this.collisionRects.push(this.caveGateCollider);

    this.missionAllies = ALLY_SPAWNS.map((point, index) => {
      const ally = this.add
        .sprite(point.x, point.y, "soldier-walk-8d", "east-0")
        .setDisplaySize(68, 68)
        .setOrigin(0.5, 0.78)
        .setTint(index % 2 === 0 ? 0x88d8c6 : 0x9bc9ba)
        .setDepth(3.4);
      ally.setData("walkPhase", index * 73);
      ally.setData("missionKind", "soldier");
      const barBack = this.add
        .rectangle(point.x, point.y + 30, 44, 6, 0x0b1112, 0.9)
        .setDepth(4.1);
      const barFill = this.add
        .rectangle(point.x - 20, point.y + 30, 40, 3, 0x63d6ba, 1)
        .setOrigin(0, 0.5)
        .setDepth(4.2);
      return {
        node: ally,
        barBack,
        barFill,
        home: point,
        index,
        direction: "east" as PlayerDirection,
        hp: 100,
        nextAttackAt: index * 95,
        attackStartedAt: Number.NEGATIVE_INFINITY,
        attackEndsAt: Number.NEGATIVE_INFINITY,
      };
    });
    this.missionSheep = SHEEP_INSIDE_SPAWNS.map((inside, index) => {
      const node = this.add
        .sprite(inside.x, inside.y, "sheep-walk-8d", "east-0")
        .setDisplaySize(58, 58)
        .setOrigin(0.5, 0.72)
        .setDepth(3.1);
      node.setData("walkPhase", index * 61);
      node.setData("missionKind", "sheep");
      return {
        node,
        inside,
        outside: SHEEP_OUTSIDE_SPAWNS[index]!,
        target: inside,
        index,
        direction: "east" as PlayerDirection,
      };
    });

    const cyclopsName = this.add
      .text(
        CYCLOPS_POSITION.x,
        CYCLOPS_POSITION.y - CYCLOPS_LABEL_OFFSET,
        "폴리페모스 · 외눈박이",
        {
          color: "#ffd2a3",
          fontFamily: GAME_FONT,
          fontSize: "25px",
          backgroundColor: "#160b07d9",
          padding: { x: 14, y: 7 },
        },
      )
      .setOrigin(0.5)
      .setDepth(6)
      .setResolution(2);
    this.cyclopsActor = { node: cyclopsNode, name: cyclopsName };
    this.caveGateStateLabel = this.add
      .text(
        CAVE_GATE_POSITION.x - 34,
        CAVE_GATE_POSITION.y + 230,
        "닫힘 · 통과 불가",
        {
          color: "#ff9e80",
          fontFamily: GAME_FONT,
          fontSize: "18px",
          fontStyle: "bold",
          backgroundColor: "#2a0d08e8",
          padding: { x: 14, y: 8 },
        },
      )
      .setOrigin(0.5)
      .setDepth(5)
      .setResolution(2);
    this.addInstruction(
      CAVE_PLAYER_SPAWN.x + 190,
      CAVE_PLAYER_SPAWN.y + 104,
      "G: 병사·양 밀치기 / 잠든 눈 타격 · 빨간선: 이미지에서 인식한 충돌 구조물",
    );
    this.createPortal(
      BEACH_REST_GATE_POSITION.x,
      BEACH_REST_GATE_POSITION.y,
      "rest",
      "바닷가 휴식처 게이트",
    );
    this.returnPortalCreated = true;
    this.addInstruction(
      BEACH_REST_GATE_POSITION.x,
      BEACH_REST_GATE_POSITION.y + 92,
      "바위문을 지나 바닷가에 도달한 뒤 W로 휴식처 귀환",
    );
    this.publishFifthFloorMission(true);
    this.updateCyclopsVision();
  }

  private updateFifthFloorMission(time: number, delta: number): void {
    if (!this.fifthFloorMission || this.fifthFloorMission.status !== "active") {
      return;
    }

    const store = useGameStore.getState();
    const request = store.fifthFloorCommandRequest;
    if (request && request.id !== this.fifthFloorLastCommandRequestId) {
      this.fifthFloorLastCommandRequestId = request.id;
      const result =
        request.type === "strategy"
          ? chooseFifthFloorStrategy(this.fifthFloorMission, request.stealth)
          : request.type === "toggle-sacrifice"
            ? toggleFifthFloorSacrifice(
                this.fifthFloorMission,
                request.soldierId,
              )
            : request.type === "revoke-strategy"
              ? revokeFifthFloorStrategy(this.fifthFloorMission)
              : commandFifthFloorSacrificeCharge(this.fifthFloorMission);
      this.fifthFloorMission = result.state;
      this.handleFifthFloorEvents(result.events);
      this.publishFifthFloorMission(true);
    }

    if (this.fifthFloorMission.status !== "active") return;
    const advanced = advanceFifthFloorMission(this.fifthFloorMission, delta, {
      holdPhaseTimer: this.isCyclopsAttacking(),
    });
    this.fifthFloorMission = advanced.state;
    this.handleFifthFloorEvents(advanced.events);
    if (this.fifthFloorMission.status !== "active") return;

    this.updateMissionWalkers(time, delta);
    const sheepAtBeach = this.missionSheep.filter(
      (sheep) => sheep.node.active && sheep.node.x >= BEACH_REGION.x,
    ).length;
    const sheepProgress = updateFifthFloorSheepAtBeach(
      this.fifthFloorMission,
      sheepAtBeach,
    );
    this.fifthFloorMission = sheepProgress.state;
    // The rock is on a flat thirty-second timer now: neither a finished flock
    // nor a running fight moves the closing time.
    this.updateCyclopsActor(time, delta);
    this.updateCyclopsStrike(time);
    this.updateCyclopsVision();
    if (time >= this.nextMissionAnimalSoundAt && this.missionSheep.length > 0) {
      this.nextMissionAnimalSoundAt = time + 7_600;
      playSfx("sheepBaa", { volume: 0.16 });
    }
    if (isCyclopsAwake(this.fifthFloorMission) && this.cyclopsBoss) {
      const playerDistance = Phaser.Math.Distance.Between(
        this.cyclopsBoss.x,
        this.cyclopsBoss.y,
        this.player.x,
        this.player.y,
      );
      if (playerDistance <= CYCLOPS_CONTACT_AGGRO_DISTANCE) {
        this.triggerCyclopsAggro();
      } else if (
        this.cyclopsAggroActive &&
        !this.cyclopsStrike &&
        playerDistance > CYCLOPS_DEAGGRO_DISTANCE
      ) {
        // The chase must be able to end, or the frozen gate timetable would
        // never resume and the run would soft-lock.
        this.cyclopsAggroActive = false;
      }
    }
    if (
      this.fifthFloorMission.phase === "gate-open" &&
      isPointInCaveExit({ x: this.player.x, y: this.player.y })
    ) {
      const reached = reachFifthFloorBeach(this.fifthFloorMission);
      this.fifthFloorMission = reached.state;
      this.handleFifthFloorEvents(reached.events);
    }

    const alliesAtBeach = this.missionAllies.filter(
      (soldier) => soldier.node.active && soldier.node.x >= BEACH_REGION.x,
    ).length;
    const gathered = updateFifthFloorAlliesAtBeach(
      this.fifthFloorMission,
      alliesAtBeach,
    );
    this.fifthFloorMission = gathered.state;
    this.updateCaveCollisionGuide();

    this.publishFifthFloorMission();
  }

  private updateCyclopsActor(time: number, delta: number): void {
    if (!this.cyclopsBoss || !this.fifthFloorMission) return;
    if (this.cyclopsStrike) {
      this.cyclopsAction =
        this.cyclopsStrike.resolvesAt - time <= 240
          ? "sweep-impact"
          : "sweep-windup";
      this.renderCyclopsAction(time);
      return;
    }
    if (time < this.bossGateActionEndsAt) {
      this.renderCyclopsAction(time);
      return;
    }
    if (this.fifthFloorMission.phase === "sleeping") {
      this.cyclopsAction = "sleep";
      this.renderCyclopsAction(time);
      return;
    }
    if (this.fifthFloorMission.phase === "gate-open") {
      this.cyclopsAction =
        this.fifthFloorMission.bossHp <= 0
          ? "sleep"
          : this.fifthFloorMission.weakPoint === "blinded"
            ? "blind-guard"
            : "idle";
      this.renderCyclopsAction(time);
      return;
    }

    if (time < this.missionAttackHoldUntil) {
      // Blinded and reeling: the Cyclops holds its ground for the whole hold.
      this.cyclopsAction = "idle";
      this.renderCyclopsAction(time);
      return;
    }

    const fighting = this.fifthFloorMission.strategy === "fighting";
    const sacrificeCharging =
      this.fifthFloorMission.strategy === "stealth-charging";
    const seesPlayer =
      isCyclopsVisionActive(this.fifthFloorMission) &&
      isPointInCyclopsVision(
        { x: this.player.x, y: this.player.y },
        this.fifthFloorMission.phase,
        { x: this.cyclopsBoss.x, y: this.cyclopsBoss.y },
        this.cyclopsFacingAngle,
      );
    let target = CYCLOPS_PATROL_POINTS[this.cyclopsPatrolIndex]!;
    const markedSoldiers = this.missionAllies.filter(
      (soldier) =>
        soldier.node.active &&
        this.fifthFloorMission!.selectedSacrificeIds.includes(soldier.index),
    );
    if (markedSoldiers.length > 0) {
      // Marked meat outranks everything: the boss walks down the nearest of
      // the two chosen soldiers even while the player is in plain sight.
      let nearest = markedSoldiers[0]!;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const soldier of markedSoldiers) {
        const distance = Phaser.Math.Distance.Between(
          this.cyclopsBoss.x,
          this.cyclopsBoss.y,
          soldier.node.x,
          soldier.node.y,
        );
        if (distance >= nearestDistance) continue;
        nearest = soldier;
        nearestDistance = distance;
      }
      target = { x: nearest.node.x, y: nearest.node.y };
    } else if (fighting || seesPlayer || this.cyclopsAggroActive) {
      target = { x: this.player.x, y: this.player.y };
    } else if (
      Phaser.Math.Distance.Between(
        this.cyclopsBoss.x,
        this.cyclopsBoss.y,
        target.x,
        target.y,
      ) < 72
    ) {
      this.cyclopsPatrolIndex =
        (this.cyclopsPatrolIndex + 1) % CYCLOPS_PATROL_POINTS.length;
      target = CYCLOPS_PATROL_POINTS[this.cyclopsPatrolIndex]!;
    }

    const vector = new Phaser.Math.Vector2(
      target.x - this.cyclopsBoss.x,
      target.y - this.cyclopsBoss.y,
    );
    if (vector.lengthSq() > 1) {
      vector.normalize();
      const speed = fighting
        ? CYCLOPS_FIGHT_SPEED
        : sacrificeCharging ||
            markedSoldiers.length > 0 ||
            seesPlayer ||
            this.cyclopsAggroActive
          ? CYCLOPS_CHASE_SPEED
          : CYCLOPS_PATROL_SPEED;
      const distance = (speed * delta) / 1_000;
      this.moveCyclopsWithCollisions(vector.x * distance, vector.y * distance);
      this.cyclopsDirection = directionFromAxes(
        vector.x,
        vector.y,
        this.cyclopsDirection,
      );
      this.cyclopsFacingAngle = Math.atan2(vector.y, vector.x);
      this.cyclopsAction = "walk";
    } else {
      this.cyclopsAction = "idle";
    }

    this.renderCyclopsAction(time);
    this.cyclopsName?.setPosition(
      this.cyclopsBoss.x,
      this.cyclopsBoss.y - CYCLOPS_LABEL_OFFSET,
    );
  }

  private renderCyclopsAction(time: number): void {
    if (!this.cyclopsBoss) return;
    const duration =
      this.cyclopsAction === "walk" ? CYCLOPS_WALK_FRAME_DURATION : 330;
    const frame = Math.floor(time / duration) % 2;
    if (this.cyclopsAction === "walk" || this.cyclopsAction === "idle") {
      this.cyclopsBoss.setTexture(
        "cyclops-walk-8d",
        `${this.cyclopsDirection}-${
          this.cyclopsAction === "idle" ? 0 : frame
        }`,
      );
    } else if (
      this.cyclopsAction === "gate-open" ||
      this.cyclopsAction === "gate-close" ||
      this.cyclopsAction === "rock"
    ) {
      this.cyclopsBoss.setTexture(
        `cyclops-gate-v3-${this.cyclopsDirection}-${
          this.cyclopsAction === "gate-close" ? 0 : 1
        }`,
      );
    } else if (this.cyclopsAction === "sleep") {
      this.cyclopsBoss.setTexture("cyclops-actions-pixel", "sleep");
    } else {
      const attackFrame =
        this.cyclopsAction === "sweep-windup" ||
        this.cyclopsAction === "blind-guard"
          ? 0
          : 1;
      this.cyclopsBoss.setTexture(
        `cyclops-attack-v3-${this.cyclopsDirection}-${attackFrame}`,
      );
    }
    this.cyclopsBoss
      .setDisplaySize(CYCLOPS_DISPLAY_SIZE, CYCLOPS_DISPLAY_SIZE)
      .setFlipX(false)
      .setDepth(3.8 + this.cyclopsBoss.y / 10_000);
  }

  private moveCyclopsWithCollisions(deltaX: number, deltaY: number): void {
    if (!this.cyclopsBoss) return;
    const nextX = Phaser.Math.Clamp(
      this.cyclopsBoss.x + deltaX,
      CAVE_MOVEMENT_BOUNDS.x + 190,
      CAVE_GATE_POSITION.x - 175,
    );
    if (this.canCyclopsOccupy(nextX, this.cyclopsBoss.y)) {
      this.cyclopsBoss.x = nextX;
    }
    const nextY = Phaser.Math.Clamp(
      this.cyclopsBoss.y + deltaY,
      CAVE_MOVEMENT_BOUNDS.y + 170,
      CAVE_MOVEMENT_BOUNDS.y + CAVE_MOVEMENT_BOUNDS.height - 120,
    );
    if (this.canCyclopsOccupy(this.cyclopsBoss.x, nextY)) {
      this.cyclopsBoss.y = nextY;
    }
  }

  private canCyclopsOccupy(x: number, y: number): boolean {
    const feet = new Phaser.Geom.Rectangle(x - 82, y - 12, 164, 64);
    if (this.intersectsWorldCollision(feet)) return false;
    if (doCaveBodiesOverlap({ x, y }, CYCLOPS_BODY_RADIUS, this.player, 17)) {
      this.triggerCyclopsAggro();
      return false;
    }
    return !this.missionCollisionBodies().some(
      (body) =>
        body.node.active &&
        doCaveBodiesOverlap(
          { x, y },
          CYCLOPS_BODY_RADIUS,
          body.node,
          body.radius,
        ),
    );
  }

  private triggerCyclopsAggro(): void {
    if (this.cyclopsAggroActive) return;
    this.cyclopsAggroActive = true;
    playSfx("giantAlert");
    this.cameras.main.shake(120, 0.0024);
  }

  private updateMissionWalkers(time: number, delta: number): void {
    const bossPoint = this.cyclopsBoss
      ? { x: this.cyclopsBoss.x, y: this.cyclopsBoss.y }
      : CYCLOPS_POSITION;
    const movingTraffic: CavePoint[] = [];
    if (
      this.moveKeys.up.isDown ||
      this.moveKeys.down.isDown ||
      this.moveKeys.left.isDown ||
      this.moveKeys.right.isDown ||
      time < this.dashEndsAt
    ) {
      movingTraffic.push({ x: this.player.x, y: this.player.y });
    }
    const selectedSacrifices = new Set(
      this.fifthFloorMission?.selectedSacrificeIds ?? [],
    );

    for (const soldier of this.missionAllies) {
      const previousX = soldier.node.x;
      const previousY = soldier.node.y;
      if (time < (Number(soldier.node.getData("shoveRecoverAt")) || 0)) {
        soldier.node.setTexture("soldier-walk-8d", `${soldier.direction}-0`);
        soldier.barBack.setPosition(soldier.node.x, soldier.node.y + 30);
        soldier.barFill
          .setPosition(soldier.node.x - 20, soldier.node.y + 30)
          .setDisplaySize(40 * (soldier.hp / 100), 3);
        continue;
      }
      const formation = this.missionFormationPoint(soldier.index);
      let targetX = formation.x;
      let targetY = formation.y;
      const bossDistance = Phaser.Math.Distance.Between(
        soldier.node.x,
        soldier.node.y,
        bossPoint.x,
        bossPoint.y,
      );
      const fighting =
        this.fifthFloorMission?.strategy === "fighting" &&
        this.fifthFloorMission.phase === "watching";
      const sacrificing =
        this.fifthFloorMission?.strategy === "stealth-charging" &&
        selectedSacrifices.has(soldier.index);
      if ((fighting || sacrificing) && bossDistance > 225) {
        targetX = bossPoint.x;
        targetY = bossPoint.y;
      } else if (fighting && bossDistance <= 225) {
        targetX = soldier.node.x;
        targetY = soldier.node.y;
        if (time >= soldier.nextAttackAt && time >= this.missionAttackHoldUntil) {
          soldier.nextAttackAt = time + 1_350 + (soldier.index % 4) * 90;
          this.playMissionSoldierAttack(soldier, bossPoint);
        }
      }
      if (time < soldier.attackEndsAt) {
        const frame = time - soldier.attackStartedAt < 145 ? 0 : 1;
        soldier.node.setTexture(
          `soldier-attack-${soldier.direction}-${frame}`,
        );
      } else {
        soldier.direction = this.moveMissionWalker(
          soldier.node,
          targetX,
          targetY,
          sacrificing ? 198 : fighting ? 260 : 128,
          soldier.direction,
          time,
          delta,
          MISSION_SOLDIER_RADIUS,
          soldier.index % 2 === 0,
          fighting || sacrificing,
        );
      }
      const selected = selectedSacrifices.has(soldier.index);
      soldier.node.setTint(
        selected ? 0xffd070 : soldier.index % 2 === 0 ? 0x88d8c6 : 0x9bc9ba,
      );
      if (
        Phaser.Math.Distance.Between(
          previousX,
          previousY,
          soldier.node.x,
          soldier.node.y,
        ) > 0.25
      ) {
        movingTraffic.push({ x: soldier.node.x, y: soldier.node.y });
      }
      soldier.barBack.setPosition(soldier.node.x, soldier.node.y + 30);
      soldier.barFill
        .setPosition(soldier.node.x - 20, soldier.node.y + 30)
        .setDisplaySize(40 * (soldier.hp / 100), 3);
    }

    this.tryBeginCyclopsSacrifice();

    const flockTransit =
      this.fifthFloorMission?.phase === "gate-open" &&
      this.fifthFloorMission.bossHp > 0 &&
      this.caveGateWalkable;
    for (const sheep of this.missionSheep) {
      if (time < (Number(sheep.node.getData("shoveRecoverAt")) || 0)) {
        sheep.node.setTexture("sheep-walk-8d", `${sheep.direction}-0`);
        continue;
      }
      // Stall watchdog: the rock now comes down on a fixed timer, so a sheep
      // wedged against an actor would simply be left behind. In the closing
      // stretch of the window a sheep that has made no progress for five
      // seconds is nudged straight to its side of the door.
      if (
        flockTransit &&
        (this.fifthFloorMission?.phaseRemainingMs ?? Number.POSITIVE_INFINITY) <=
          SHEEP_TRANSIT_WATCHDOG_WINDOW_MS
      ) {
        const destination =
          this.fifthFloorMission?.flockDirection === "in"
            ? sheep.inside
            : sheep.outside;
        const remaining = Phaser.Math.Distance.Between(
          sheep.node.x,
          sheep.node.y,
          destination.x,
          destination.y,
        );
        // Progress is measured as distance-to-destination, not raw movement:
        // a wedged sheep that wiggles in place forever would otherwise keep
        // resetting the stall timer and hold the gate open for the whole run.
        const bestRemaining = Number(
          sheep.node.getData("transitWatchRemaining"),
        );
        const since = Number(sheep.node.getData("transitWatchSince")) || 0;
        const progressed =
          !Number.isFinite(bestRemaining) || remaining < bestRemaining - 6;
        if (progressed || remaining <= 60) {
          sheep.node.setData(
            "transitWatchRemaining",
            Math.min(remaining, Number.isFinite(bestRemaining) ? bestRemaining : remaining),
          );
          sheep.node.setData("transitWatchSince", time);
        } else if (time - since > 5_000) {
          sheep.node.setPosition(destination.x, destination.y);
          sheep.node.setData("transitWatchRemaining", 0);
          sheep.node.setData("transitWatchSince", time);
          continue;
        }
      } else {
        sheep.node.setData("transitWatchRemaining", Number.NaN);
      }
      const transitTarget = flockTransit
        ? sheepTransitTarget(
            sheep.node,
            this.fifthFloorMission?.flockDirection === "in"
              ? sheep.inside
              : sheep.outside,
            sheep.index,
            this.fifthFloorMission?.flockDirection ?? "out",
          )
        : sheep.target;
      let targetX = transitTarget.x;
      let targetY = transitTarget.y;
      let nearestTraffic: CavePoint | undefined;
      let nearestTrafficDistance = 104;
      for (const actor of movingTraffic) {
        const distance = Phaser.Math.Distance.Between(
          sheep.node.x,
          sheep.node.y,
          actor.x,
          actor.y,
        );
        if (distance >= nearestTrafficDistance) continue;
        nearestTraffic = actor;
        nearestTrafficDistance = distance;
      }
      if (nearestTraffic) {
        const yieldTarget = sheepYieldTarget(
          sheep.node,
          nearestTraffic,
          sheep.index % 2 === 0,
        );
        targetX = yieldTarget.x;
        targetY = yieldTarget.y;
      }
      const away = new Phaser.Math.Vector2(
        sheep.node.x - bossPoint.x,
        sheep.node.y - bossPoint.y,
      );
      const bossDistance = away.length();
      if (!flockTransit && bossDistance < 610 && bossDistance > 0) {
        away.normalize();
        targetX += away.x * 300;
        targetY += away.y * 300;
      }
      sheep.direction = this.moveMissionWalker(
        sheep.node,
        targetX,
        targetY,
        (nearestTraffic ? MISSION_SHEEP_YIELD_SPEED : MISSION_SHEEP_SPEED) *
          (0.88 + (sheep.index % 5) * 0.06),
        sheep.direction,
        time,
        delta,
        MISSION_SHEEP_RADIUS,
        sheep.index % 2 === 0,
        flockTransit,
        flockTransit,
      );
    }
  }

  private missionFormationPoint(index: number): CavePoint {
    const angle = playerDirectionAngle(this.playerDirection);
    const backDistance = 92 + Math.floor(index / 5) * 60;
    const lateral = ((index % 5) - 2) * 56;
    return {
      x:
        this.player.x -
        Math.cos(angle) * backDistance +
        Math.cos(angle + Math.PI / 2) * lateral,
      y:
        this.player.y -
        Math.sin(angle) * backDistance +
        Math.sin(angle + Math.PI / 2) * lateral,
    };
  }

  private handleMissionShove(time: number): void {
    if (
      !this.fifthFloorMission ||
      this.fifthFloorMission.status !== "active" ||
      time < this.nextMissionShoveAt
    ) {
      return;
    }
    this.nextMissionShoveAt = time + MISSION_SHOVE_COOLDOWN_MS;
    const facingAngle = playerDirectionAngle(this.playerDirection);

    if (
      this.cyclopsBoss &&
      this.fifthFloorMission.phase === "sleeping" &&
      this.fifthFloorMission.weakPoint === "primed"
    ) {
      const bossAngle = Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        this.cyclopsBoss.x,
        this.cyclopsBoss.y - 92,
      );
      const bossDistance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.cyclopsBoss.x,
        this.cyclopsBoss.y,
      );
      if (
        bossDistance <= CYCLOPS_BODY_RADIUS + 170 &&
        Math.abs(Phaser.Math.Angle.Wrap(bossAngle - facingAngle)) <= 0.95
      ) {
        this.playerDirection = directionFromAngle(bossAngle);
        this.weaponAttackDirection = this.playerDirection;
        this.weaponAttackStartedAt = time;
        this.playThrustEffect(bossAngle, 126, 0xffe2a6, 11);
        playSfx("weaponHit", { volume: 0.62, rate: 0.9 });
        const hit = hitCyclopsWithBasicAttack(
          this.fifthFloorMission,
          20,
          true,
        );
        this.fifthFloorMission = hit.state;
        this.handleFifthFloorEvents(hit.events);
        return;
      }
    }

    const candidates = [
      ...this.missionAllies.map((soldier) => ({
        node: soldier.node,
        radius: MISSION_SOLDIER_RADIUS,
      })),
      ...this.missionSheep.map((sheep) => ({
        node: sheep.node,
        radius: MISSION_SHEEP_RADIUS,
      })),
    ];
    let target: (typeof candidates)[number] | undefined;
    let nearest = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      if (!candidate.node.active) continue;
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        candidate.node.x,
        candidate.node.y,
      );
      if (distance > MISSION_SHOVE_RANGE || distance >= nearest) continue;
      const angle = Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        candidate.node.x,
        candidate.node.y,
      );
      if (Math.abs(Phaser.Math.Angle.Wrap(angle - facingAngle)) > 0.9) continue;
      target = candidate;
      nearest = distance;
    }
    if (!target) return;

    const destination = missionShoveTarget(
      this.player,
      target.node,
      facingAngle,
      MISSION_SHOVE_DISTANCE,
    );
    const startX = target.node.x;
    const startY = target.node.y;
    let resolved = { x: startX, y: startY };
    for (let step = 8; step >= 1; step -= 1) {
      const progress = step / 8;
      const x = Phaser.Math.Linear(startX, destination.x, progress);
      const y = Phaser.Math.Linear(startY, destination.y, progress);
      if (!this.canPushedMissionActorOccupy(target.node, x, y, target.radius)) {
        continue;
      }
      resolved = { x, y };
      break;
    }
    if (resolved.x === startX && resolved.y === startY) return;
    target.node.setPosition(resolved.x, resolved.y);
    target.node.setData("shoveRecoverAt", time + 460);
    target.node.setTintFill(0xffffff);
    this.time.delayedCall(90, () => target?.node.clearTint());
    const ring = this.add
      .ellipse(resolved.x, resolved.y + 12, 66, 24, 0xffd27a, 0.12)
      .setStrokeStyle(3, 0xffd27a, 0.85)
      .setDepth(6.8);
    this.tweens.add({
      targets: ring,
      scale: 1.7,
      alpha: 0,
      duration: 260,
      onComplete: () => ring.destroy(),
    });
    playSfx("weaponSwing", { volume: 0.26, rate: 0.78 });
  }

  private canPushedMissionActorOccupy(
    node: Phaser.GameObjects.Sprite,
    x: number,
    y: number,
    radius: number,
  ): boolean {
    const feet = new Phaser.Geom.Rectangle(
      x - radius * 0.72,
      y - radius * 0.22,
      radius * 1.44,
      radius * 0.7,
    );
    if (!Phaser.Geom.Rectangle.ContainsRect(this.movementBounds, feet)) {
      return false;
    }
    if (this.intersectsWorldCollision(feet)) return false;
    if (
      this.cyclopsBoss?.active &&
      doCaveBodiesOverlap(
        { x, y },
        radius,
        this.cyclopsBoss,
        CYCLOPS_BODY_RADIUS,
      )
    ) {
      return false;
    }
    return !this.missionCollisionBodies().some(
      (body) =>
        body.node !== node &&
        body.node.active &&
        doCaveBodiesOverlap({ x, y }, radius, body.node, body.radius),
    );
  }

  private moveMissionWalker(
    node: Phaser.GameObjects.Sprite,
    targetX: number,
    targetY: number,
    speed: number,
    currentDirection: PlayerDirection,
    time: number,
    delta: number,
    radius: number,
    preferClockwise: boolean,
    hasCrowdPriority: boolean,
    ignoreMajorActors = false,
  ): PlayerDirection {
    const vector = new Phaser.Math.Vector2(targetX - node.x, targetY - node.y);
    let direction = currentDirection;
    let moved = false;
    const arrivalRadius = radius === MISSION_SHEEP_RADIUS ? 10 : 8;
    if (vector.length() > arrivalRadius) {
      vector.normalize();
      const remainingDistance = Math.max(
        0,
        Phaser.Math.Distance.Between(node.x, node.y, targetX, targetY) -
          arrivalRadius,
      );
      const distance = Math.min(
        (speed * delta) / 1_000,
        4.5,
        remainingDistance,
      );
      for (const candidate of movementAvoidanceCandidates(
        vector.x,
        vector.y,
        preferClockwise,
      )) {
        const nextX = Phaser.Math.Clamp(
          node.x + candidate.x * distance,
          CAVE_MOVEMENT_BOUNDS.x + 24,
          CAVE_MOVEMENT_BOUNDS.x + CAVE_MOVEMENT_BOUNDS.width - 24,
        );
        const nextY = Phaser.Math.Clamp(
          node.y + candidate.y * distance,
          CAVE_MOVEMENT_BOUNDS.y + 24,
          CAVE_MOVEMENT_BOUNDS.y + CAVE_MOVEMENT_BOUNDS.height - 24,
        );
        if (
          !this.canMissionWalkerOccupy(
            node,
            nextX,
            nextY,
            radius,
            hasCrowdPriority,
            ignoreMajorActors,
          )
        ) {
          continue;
        }
        node.setPosition(nextX, nextY);
        moved = true;
        direction = directionFromAxes(candidate.x, candidate.y, direction);
        break;
      }
      // Cornered against a wall: slide along one axis instead of freezing.
      if (!moved) {
        for (const slide of [
          { x: Math.sign(vector.x), y: 0 },
          { x: 0, y: Math.sign(vector.y) },
        ]) {
          if (slide.x === 0 && slide.y === 0) continue;
          const slideX = Phaser.Math.Clamp(
            node.x + slide.x * distance,
            CAVE_MOVEMENT_BOUNDS.x + 24,
            CAVE_MOVEMENT_BOUNDS.x + CAVE_MOVEMENT_BOUNDS.width - 24,
          );
          const slideY = Phaser.Math.Clamp(
            node.y + slide.y * distance,
            CAVE_MOVEMENT_BOUNDS.y + 24,
            CAVE_MOVEMENT_BOUNDS.y + CAVE_MOVEMENT_BOUNDS.height - 24,
          );
          if (slideX === node.x && slideY === node.y) continue;
          if (
            !this.canMissionWalkerOccupy(
              node,
              slideX,
              slideY,
              radius,
              hasCrowdPriority,
              ignoreMajorActors,
            )
          ) {
            continue;
          }
          node.setPosition(slideX, slideY);
          moved = true;
          direction = directionFromAxes(slide.x, slide.y, direction);
          break;
        }
      }
    }
    const isSheep = node.getData("missionKind") !== "soldier";
    const walkPhase = Number(node.getData("walkPhase")) || 0;
    const frame = moved
      ? Math.floor(
          (time + walkPhase) /
            (isSheep ? MISSION_SHEEP_FRAME_DURATION : MISSION_WALK_FRAME_DURATION),
        ) % 2
      : 0;
    const textureKey = isSheep ? "sheep-walk-8d" : "soldier-walk-8d";
    node.setTexture(textureKey, `${direction}-${frame}`).setFlipX(false);
    // A grazing animal never glides — a light body sway sells the trot.
    if (isSheep) {
      node.setAngle(moved ? Math.sin((time + walkPhase) / 150) * 3.2 : 0);
    }
    return direction;
  }

  private playMissionSoldierAttack(
    soldier: MissionSoldier,
    bossPoint: CavePoint,
  ): void {
    if (!this.fifthFloorMission || !this.cyclopsBoss) return;
    const angle = Phaser.Math.Angle.Between(
      soldier.node.x,
      soldier.node.y,
      bossPoint.x,
      bossPoint.y,
    );
    soldier.direction = directionFromAngle(angle);
    soldier.attackStartedAt = this.time.now;
    soldier.attackEndsAt = this.time.now + 330;
    soldier.node.setTexture(`soldier-attack-${soldier.direction}-0`);
    this.playCombatSwipe(
      soldier.node.x + Math.cos(angle) * 30,
      soldier.node.y + Math.sin(angle) * 30,
      angle,
      0x79e5ca,
    );
    playSfx("weaponSwing", { volume: 0.18, rate: 1.08 });
    const hit = hitCyclopsWithSkill(this.fifthFloorMission, 3);
    this.fifthFloorMission = hit.state;
    this.handleFifthFloorEvents(hit.events);
  }

  private tryBeginCyclopsSacrifice(): void {
    if (
      !this.fifthFloorMission ||
      !this.cyclopsBoss ||
      this.stealthSacrificeInProgress ||
      this.fifthFloorMission.strategy !== "stealth-charging"
    ) {
      return;
    }
    const selectedIds = new Set(this.fifthFloorMission.selectedSacrificeIds);
    const selected = this.missionAllies.filter((soldier) =>
      selectedIds.has(soldier.index),
    );
    if (
      selected.length !== 2 ||
      selected.some(
        (soldier) =>
          Phaser.Math.Distance.Between(
            soldier.node.x,
            soldier.node.y,
            this.cyclopsBoss!.x,
            this.cyclopsBoss!.y,
          ) > 216,
      )
    ) {
      return;
    }

    this.stealthSacrificeInProgress = true;
    this.cancelCyclopsStrike();
    this.bossGateActionEndsAt = this.time.now + 2_100;
    const selectedSet = new Set(selected);
    this.missionAllies = this.missionAllies.filter(
      (soldier) => !selectedSet.has(soldier),
    );

    selected.forEach((soldier, order) => {
      this.time.delayedCall(order * 620, () => {
        const boss = this.cyclopsBoss;
        if (!boss?.active || !soldier.node.active) return;
        const angle = Phaser.Math.Angle.Between(
          boss.x,
          boss.y,
          soldier.node.x,
          soldier.node.y,
        );
        this.cyclopsDirection = directionFromAngle(angle);
        this.cyclopsAction = "attack";
        this.renderCyclopsAction(this.time.now);
        playSfx("giantAttack", { volume: 0.52, rate: 0.9 + order * 0.08 });
        this.tweens.add({
          targets: soldier.node,
          x: boss.x + Math.cos(angle) * 62,
          y: boss.y - 108 - order * 18,
          scaleX: 0.3,
          scaleY: 0.3,
          angle: order === 0 ? -20 : 20,
          alpha: 0,
          duration: 520,
          ease: "Back.In",
          onComplete: () => soldier.node.destroy(),
        });
        this.tweens.add({
          targets: [soldier.barBack, soldier.barFill],
          alpha: 0,
          duration: 180,
          onComplete: () => {
            soldier.barBack.destroy();
            soldier.barFill.destroy();
          },
        });
        this.showDamage(soldier.node.x, soldier.node.y - 28, 100);
        this.playBossImpact(soldier.node.x, soldier.node.y);
      });
    });

    const sacrificeIds = selected.map((soldier) => soldier.index);
    this.time.delayedCall(1_450, () => {
      if (!this.fifthFloorMission) return;
      const completed = completeFifthFloorSacrifice(this.fifthFloorMission);
      this.stealthSacrificeInProgress = false;
      if (completed.state === this.fifthFloorMission) {
        // The meal script was interrupted (the boss dozed off after eating
        // other soldiers mid-grab). The two grabbed soldiers are gone either
        // way, so book their loss through the regular casualty path.
        const fallback = loseFifthFloorSoldiers(
          this.fifthFloorMission,
          sacrificeIds,
        );
        this.fifthFloorMission = fallback.state;
        this.handleFifthFloorEvents(fallback.events);
        return;
      }
      this.fifthFloorMission = completed.state;
      this.handleFifthFloorEvents(completed.events);
    });
  }

  private canMissionWalkerOccupy(
    node: Phaser.GameObjects.Sprite,
    x: number,
    y: number,
    radius: number,
    hasCrowdPriority: boolean,
    ignoreMajorActors: boolean,
  ): boolean {
    const feet = new Phaser.Geom.Rectangle(
      x - radius * 0.72,
      y - radius * 0.22,
      radius * 1.44,
      radius * 0.7,
    );
    if (this.intersectsWorldCollision(feet)) return false;
    // The Cyclops deliberately clears a lane while operating the door. Sheep
    // in that transit lane must not deadlock against the player or the boss.
    if (ignoreMajorActors) return true;
    if (doCaveBodiesOverlap({ x, y }, radius, this.player, 17)) {
      return false;
    }
    if (
      this.cyclopsBoss?.active &&
      doCaveBodiesOverlap(
        { x, y },
        radius,
        this.cyclopsBoss,
        CYCLOPS_BODY_RADIUS,
      )
    ) {
      return false;
    }
    if (hasCrowdPriority) return true;
    return !this.missionCollisionBodies().some(
      (body) =>
        body.node !== node &&
        body.node.active &&
        doCaveBodiesOverlap({ x, y }, radius, body.node, body.radius),
    );
  }

  private missionCollisionBodies(): {
    node: Phaser.GameObjects.Sprite;
    radius: number;
  }[] {
    return [
      ...this.missionAllies.map(({ node }) => ({
        node,
        radius: MISSION_SOLDIER_RADIUS,
      })),
      ...this.missionSheep.map(({ node }) => ({
        node,
        radius: MISSION_SHEEP_RADIUS,
      })),
    ];
  }

  private handleFifthFloorEvents(events: FifthFloorMissionEvent[]): void {
    for (const event of events) {
      if (event.type === "allies-lost") {
        this.showBossCallout(`타격에 병사 ${event.count}명 전사`, "#ff9b7a");
        continue;
      }
      if (event.type === "allies-sacrificed") {
        this.showBossCallout("선택한 병사 2명 희생 · 외눈박이 수면", "#ffbd78");
        continue;
      }
      if (event.type === "sacrifice-reset") {
        this.showBossCallout(
          "다른 병사가 잡아먹혀 희생 지명이 해제되었습니다",
          "#ffbd78",
        );
        continue;
      }
      if (event.type === "strategy-revoked") {
        this.showBossCallout("명령 철회 · 병사들이 물러납니다", "#b7f1e6");
        playSfx("uiConfirm", { volume: 0.42, rate: 0.78 });
        continue;
      }
      if (event.type === "flock-moved") {
        this.showBossCallout(
          event.location === "outside"
            ? "30초 경과 · 바위문이 닫힙니다 · 잠시 후 양을 다시 들여보냅니다"
            : "30초 경과 · 바위문이 닫힙니다 · 잠시 후 양을 다시 내보냅니다",
          "#ffd27a",
        );
        continue;
      }
      if (event.type === "sacrifice-charge-commanded") {
        this.showBossCallout(
          `병사 ${event.soldierIds.map((id) => id + 1).join("·")} 돌진`,
          "#ffd27a",
        );
        playSfx("uiConfirm", { volume: 0.48, rate: 1.05 });
        continue;
      }
      if (event.type === "charge-commanded") {
        this.showBossCallout("전원 진격!", "#8ce6d0");
        playSfx("uiConfirm", { volume: 0.52, rate: 0.9 });
        continue;
      }
      if (event.type === "phase-changed") {
        if (event.phase === "gate-open") {
          this.cancelCyclopsStrike();
          this.openCaveGate();
        } else {
          // Grace after waking or shutting the gate, so soldiers standing next
          // to the boss can retreat before it swings again — otherwise a
          // crowded squad is devoured two by two in an endless sleep chain.
          this.cyclopsNextStrikeAt = Math.max(
            this.cyclopsNextStrikeAt,
            this.time.now + 2_400,
          );
          const gateIsOpen =
            !!this.caveGate && this.caveGate.x > CAVE_GATE_POSITION.x + 40;
          if (gateIsOpen) this.closeCaveGate();
          if (event.phase === "sleeping") {
            this.cyclopsAggroActive = false;
            this.cancelCyclopsStrike();
            // The Cyclops never dozes off in a doorway: shut the rock first,
            // then trudge to the arena centre and curl up there.
            this.walkCyclopsToSleepSpot(gateIsOpen ? 1_550 : 0);
          }
        }
        continue;
      }
      if (event.type === "boss-damaged") {
        if (this.cyclopsBoss?.active) {
          this.cyclopsBoss.setTintFill(0xffffff);
          this.time.delayedCall(68, () => this.cyclopsBoss?.clearTint());
          this.showDamage(
            this.cyclopsBoss.x,
            this.cyclopsBoss.y - 180,
            event.amount,
          );
          if (this.time.now >= this.nextImpactSoundAt) {
            this.nextImpactSoundAt = this.time.now + 85;
            this.playBossImpact(this.cyclopsBoss.x, this.cyclopsBoss.y - 82);
          }
        }
        continue;
      }
      if (event.type === "vision-obscured") {
        this.cancelCyclopsStrike();
        this.cyclopsAggroActive = false;
        this.missionAttackHoldUntil = this.time.now + CYCLOPS_EYE_HIT_HOLD_MS;
        this.cyclopsNextStrikeAt = Math.max(
          this.cyclopsNextStrikeAt,
          this.missionAttackHoldUntil,
        );
        this.showBossCallout(
          "눈 타격 성공 · 10초간 전투 정지 · 시야와 공격 범위가 영구히 줄어듭니다",
          "#8ce6d0",
        );
        this.cameras.main.flash(130, 115, 225, 205, false);
        continue;
      }
      if (event.type === "boss-sated") {
        this.showBossCallout("병사 2명을 삼키고 포만감에 잠듭니다", "#ffbd78");
        continue;
      }
      if (event.type === "boss-roared") {
        this.cyclopsAction = "roar";
        this.renderCyclopsAction(this.time.now);
        playSfx("giantAlert", { volume: 0.72, rate: 0.72 });
        this.cameras.main.shake(520, 0.0062);
        continue;
      }
      if (event.type === "boss-staggered") {
        this.cyclopsAction = "sleep";
        this.renderCyclopsAction(this.time.now);
        // With the gate shut the collapse seals the cave — the mission-failed
        // event that follows owns the messaging.
        if (this.fifthFloorMission?.status === "active") {
          this.showBossCallout("외눈박이 무력화 · 바위문 개방 유지", "#ffe5a6");
        }
        continue;
      }
      if (event.type === "beach-reached") {
        this.showBossCallout(
          "바닷가 도달 · 휴식처 게이트를 찾으세요",
          "#b7f1e6",
        );
        continue;
      }
      if (event.type === "mission-failed") {
        this.finishFifthFloorFailure(event.reason);
        continue;
      }
      if (event.type === "mission-escaped") {
        this.finishFifthFloorEscape();
      }
    }
    this.publishFifthFloorMission(true);
  }

  private playBossImpact(x: number, y: number): void {
    playSfx("weaponHit", { volume: 0.52, rate: 0.82 });
    this.cameras.main.shake(92, 0.0034);
    for (let index = 0; index < 7; index += 1) {
      const angle = (index / 7) * Math.PI * 2;
      const spark = this.add
        .rectangle(x, y, 11, 4, index % 2 === 0 ? 0xffe2a6 : 0xffffff)
        .setRotation(angle)
        .setDepth(9);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * 48,
        y: y + Math.sin(angle) * 48,
        alpha: 0,
        scaleX: 0.2,
        duration: 180,
        onComplete: () => spark.destroy(),
      });
    }
  }

  private showBossCallout(text: string, color: string): void {
    if (!this.cyclopsBoss) return;
    const callout = this.add
      .text(this.cyclopsBoss.x, this.cyclopsBoss.y - 300, text, {
        color,
        fontFamily: GAME_FONT,
        fontSize: "18px",
        backgroundColor: "#090b0de8",
        padding: { x: 13, y: 7 },
      })
      .setOrigin(0.5)
      .setDepth(12)
      .setResolution(2);
    this.tweens.add({
      targets: callout,
      y: callout.y - 28,
      alpha: 0,
      delay: 850,
      duration: 520,
      onComplete: () => callout.destroy(),
    });
  }

  private updateCyclopsStrike(time: number): void {
    if (!this.cyclopsBoss || !this.fifthFloorMission) return;
    if (this.cyclopsStrike) {
      if (time >= this.cyclopsStrike.resolvesAt) this.resolveCyclopsStrike();
      return;
    }
    const guardingGate =
      this.fifthFloorMission.phase === "gate-open" &&
      this.fifthFloorMission.bossHp > 0;
    const guardingCave = isCyclopsVisionActive(this.fifthFloorMission);
    // Awake means dangerous: anyone who wanders close gets swatted, even while
    // the two chosen sacrifices are still marching in.
    const guardingBody = isCyclopsAwake(this.fifthFloorMission);
    if (
      time < this.cyclopsNextStrikeAt ||
      time < this.bossGateActionEndsAt ||
      time < this.missionAttackHoldUntil ||
      (!guardingGate && !guardingCave && !guardingBody)
    ) {
      return;
    }

    const guardProfile = guardingGate
      ? cyclopsGuardAttackProfile(
          this.fifthFloorMission.weakPoint === "blinded",
        )
      : {
          detectionRange: CYCLOPS_VIEW_DISTANCE,
          strikeRadius: CYCLOPS_STRIKE_RADIUS,
          warningMs: CYCLOPS_STRIKE_WARNING_MS,
          cooldownMs: CYCLOPS_STRIKE_COOLDOWN_MS,
        };

    // Once two soldiers are marked for sacrifice the Cyclops wants those two
    // above anyone else — they are hunted first and only a fully out-of-reach
    // pair lets it fall back on the rest of the squad.
    const sacrificeIds = new Set(this.fifthFloorMission.selectedSacrificeIds);
    const candidates: (CavePoint & { sacrifice: boolean })[] = [
      { x: this.player.x, y: this.player.y, sacrifice: false },
      ...this.missionAllies
        .filter((soldier) => soldier.node.active)
        .map((soldier) => ({
          x: soldier.node.x,
          y: soldier.node.y,
          sacrifice: sacrificeIds.has(soldier.index),
        })),
    ].filter((point) => {
      if (guardingGate) {
        return isPointInCyclopsGuardRange(
          point,
          this.cyclopsBoss!,
          this.fifthFloorMission!.weakPoint === "blinded",
        );
      }
      const nearBody =
        Phaser.Math.Distance.Between(
          point.x,
          point.y,
          this.cyclopsBoss!.x,
          this.cyclopsBoss!.y,
        ) <= CYCLOPS_MELEE_GUARD_RANGE;
      if (nearBody) return true;
      return (
        guardingCave &&
        isPointInCyclopsVision(
          point,
          this.fifthFloorMission!.phase,
          this.cyclopsBoss!,
          this.cyclopsFacingAngle,
        )
      );
    });
    const priorityCandidates = candidates.some(
      (candidate) => candidate.sacrifice,
    )
      ? candidates.filter((candidate) => candidate.sacrifice)
      : candidates;
    let target: CavePoint | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of priorityCandidates) {
      const distance = Phaser.Math.Distance.Between(
        this.cyclopsBoss.x,
        this.cyclopsBoss.y,
        candidate.x,
        candidate.y,
      );
      if (distance >= nearestDistance) continue;
      target = candidate;
      nearestDistance = distance;
    }
    if (!target) return;
    this.beginCyclopsStrike(
      target,
      time,
      guardProfile.strikeRadius,
      guardProfile.warningMs,
      guardProfile.cooldownMs,
    );
  }

  // Only an actual swing freezes the phase countdown: while the boss winds up
  // or lands a sweep the timetable pauses, but chasing or a standing fight
  // lets the clock keep running. The open gate is the one exception — its
  // thirty seconds are exact, so nothing at all stretches them.
  private isCyclopsAttacking(): boolean {
    if (!this.fifthFloorMission || !isCyclopsAwake(this.fifthFloorMission)) {
      return false;
    }
    if (this.fifthFloorMission.phase === "gate-open") return false;
    return this.cyclopsStrike !== undefined;
  }

  private cancelCyclopsStrike(): void {
    if (!this.cyclopsStrike) return;
    this.cyclopsStrike.marker.destroy(true);
    this.cyclopsStrike = undefined;
    this.cyclopsNextStrikeAt = this.time.now + 650;
  }

  private beginCyclopsStrike(
    target: CavePoint,
    time: number,
    radius: number,
    warningMs: number,
    cooldownMs: number,
  ): void {
    if (!this.cyclopsBoss) return;
    const fill = this.add.circle(0, 0, radius, 0xd92f28, 0.18);
    const ring = this.add
      .circle(0, 0, radius, 0x000000, 0)
      .setStrokeStyle(7, 0xff4b36, 0.92);
    const inner = this.add
      .circle(0, 0, 18, 0xffd2a3, 0.24)
      .setStrokeStyle(3, 0xffd2a3, 0.85);
    const marker = this.add
      .container(target.x, target.y, [fill, ring, inner])
      .setDepth(8.4);
    this.tweens.add({
      targets: ring,
      scale: 0.28,
      duration: warningMs,
      ease: "Sine.In",
    });
    this.tweens.add({
      targets: fill,
      alpha: 0.42,
      yoyo: true,
      repeat: 3,
      duration: 110,
    });
    this.cyclopsDirection = directionFromAxes(
      target.x - this.cyclopsBoss.x,
      target.y - this.cyclopsBoss.y,
      this.cyclopsDirection,
    );
    this.cyclopsAction = "sweep-windup";
    this.renderCyclopsAction(time);
    playSfx("giantAlert", { volume: 0.46, rate: 1.12 });
    this.cyclopsStrike = {
      marker,
      x: target.x,
      y: target.y,
      resolvesAt: time + warningMs,
      radius,
      cooldownMs,
    };
  }

  private resolveCyclopsStrike(): void {
    const strike = this.cyclopsStrike;
    if (!strike || !this.fifthFloorMission) return;
    this.cyclopsStrike = undefined;
    strike.marker.destroy(true);
    this.cyclopsNextStrikeAt = this.time.now + strike.cooldownMs;
    playSfx("giantAttack", { volume: 0.58, rate: 0.88 });
    this.playBossImpact(strike.x, strike.y);
    this.cameras.main.shake(230, 0.008);

    const strikeTarget = { x: strike.x, y: strike.y };
    const playerCaught = isPointInCyclopsStrike(
      this.player,
      strikeTarget,
      strike.radius,
    );
    // The chosen sacrifices belong to the meal script, not the sweep — losing
    // one here would leave a ritual that can never complete.
    // Nobody is shielded any more: a soldier marked for sacrifice is exactly
    // who the boss was aiming at.
    const caught = this.missionAllies.filter(
      (soldier) =>
        soldier.node.active &&
        isPointInCyclopsStrike(soldier.node, strikeTarget, strike.radius),
    );

    if (caught.length > 0) this.defeatMissionSoldiers(caught);
    const debugInvulnerable =
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get(
        "debugMissionInvulnerable",
      ) === "1";
    if (playerCaught && !debugInvulnerable) {
      const failed = failFifthFloorMission(this.fifthFloorMission, "spotted");
      this.fifthFloorMission = failed.state;
      this.handleFifthFloorEvents(failed.events);
      return;
    }
    if (caught.length === 0) {
      this.showBossCallout("공격 회피", "#b7f1e6");
    }
  }

  private defeatMissionSoldiers(caught: readonly MissionSoldier[]): void {
    if (!this.fifthFloorMission || caught.length === 0) return;
    const caughtSet = new Set(caught);
    this.missionAllies = this.missionAllies.filter(
      (soldier) => !caughtSet.has(soldier),
    );
    for (const soldier of caught) {
      soldier.hp = 0;
      soldier.barFill.setDisplaySize(0, 3);
      this.showDamage(soldier.node.x, soldier.node.y - 28, 100);
      this.tweens.add({
        targets: soldier.node,
        alpha: 0,
        angle: soldier.index % 2 === 0 ? -82 : 82,
        scaleX: 0.42,
        scaleY: 0.42,
        duration: 420,
        ease: "Quad.In",
        onComplete: () => {
          soldier.node.destroy();
          soldier.barBack.destroy();
          soldier.barFill.destroy();
        },
      });
    }
    const result = loseFifthFloorSoldiers(
      this.fifthFloorMission,
      caught.map((soldier) => soldier.index),
    );
    this.fifthFloorMission = result.state;
    this.handleFifthFloorEvents(result.events);
  }

  private openCaveGate(): void {
    if (!this.caveGate || !this.fifthFloorMission) return;
    const poseToken = ++this.bossPoseToken;
    const bossCanOpen = this.fifthFloorMission.bossHp > 0;
    const roarFirst =
      bossCanOpen && this.fifthFloorMission.weakPoint === "blinded";
    const approachDelay = roarFirst ? 850 : 0;
    this.bossGateActionEndsAt = this.time.now + approachDelay + 2_650;
    this.caveGateStateLabel
      ?.setText("열리는 중 · 보스가 바위를 들어 올립니다")
      .setColor("#ffd27a")
      .setBackgroundColor("#241306e8");
    const boss = this.cyclopsBoss;
    if (boss && bossCanOpen) {
      this.cyclopsDirection = directionFromAxes(
        CAVE_GATE_POSITION.x - boss.x,
        CAVE_GATE_POSITION.y - boss.y,
        this.cyclopsDirection,
      );
      this.cyclopsAction = roarFirst ? "roar" : "walk";
      this.renderCyclopsAction(this.time.now);
      this.tweens.killTweensOf(boss);
      this.time.delayedCall(approachDelay, () => {
        if (this.bossPoseToken !== poseToken || !boss.active) return;
        this.cyclopsAction = "walk";
        this.renderCyclopsAction(this.time.now);
        this.tweens.add({
          targets: boss,
          x: CAVE_GATE_POSITION.x - 230,
          y: CAVE_GATE_POSITION.y + 18,
          duration: 900,
          ease: "Sine.InOut",
          onUpdate: () =>
            this.cyclopsName?.setPosition(
              boss.x,
              boss.y - CYCLOPS_LABEL_OFFSET,
            ),
        });
      });
    } else if (boss) {
      this.cyclopsAction = "sleep";
      this.renderCyclopsAction(this.time.now);
    }
    this.time.delayedCall(approachDelay + 900, () => {
      if (!this.caveGate || this.bossPoseToken !== poseToken) return;
      if (bossCanOpen) {
        this.cyclopsDirection = "east";
        this.cyclopsAction = "gate-open";
        this.renderCyclopsAction(this.time.now);
        this.caveGate.setAlpha(0);
      }
      if (this.caveGateCollider) {
        const index = this.collisionRects.indexOf(this.caveGateCollider);
        if (index >= 0) this.collisionRects.splice(index, 1);
      }
      this.caveGateWalkable = true;
      this.tweens.killTweensOf(this.caveGate);
      this.tweens.add({
        targets: this.caveGate,
        x: CAVE_GATE_POSITION.x + 165,
        y: CAVE_GATE_POSITION.y - 300,
        angle: 22,
        scale: 0.82,
        duration: 1_250,
        ease: "Cubic.InOut",
        onUpdate: () => {
          if (boss && bossCanOpen) {
            boss.setPosition(
              CAVE_GATE_POSITION.x -
                230 +
                Math.max(0, this.caveGate!.x - CAVE_GATE_POSITION.x) * 0.1,
              CAVE_GATE_POSITION.y + 18 -
                Math.max(0, CAVE_GATE_POSITION.y - this.caveGate!.y) * 0.44,
            );
            this.cyclopsName?.setPosition(
              boss.x,
              boss.y - CYCLOPS_LABEL_OFFSET,
            );
          }
        },
        onComplete: () => {
          this.caveGate?.setAlpha(1);
          if (boss && bossCanOpen) {
            this.cyclopsAction = "idle";
            this.renderCyclopsAction(this.time.now);
          }
          this.caveGateStateLabel
            ?.setText("열림 · 지금 통과 가능")
            .setColor("#8ff2d2")
            .setBackgroundColor("#06231de8");
        },
      });
      const targetOutside = this.fifthFloorMission?.flockDirection === "out";
      this.moveMissionSheep(targetOutside ? "outside" : "inside");
      playSfx("rockGate");
      playSfx("stoneDoor", { volume: 0.34, rate: 0.84 });
      this.cameras.main.shake(620, 0.0035);
    });
  }

  private closeCaveGate(): void {
    if (!this.caveGate) return;
    const poseToken = ++this.bossPoseToken;
    this.caveGateWalkable = false;
    this.bossGateActionEndsAt = this.time.now + 1_650;
    this.cyclopsAggroActive = false;
    this.caveGateStateLabel
      ?.setText("닫히는 중 · 통로에서 벗어나세요")
      .setColor("#ffb08f")
      .setBackgroundColor("#2a0d08e8");
    this.cyclopsAction = "walk";
    this.cyclopsDirection = "east";
    this.renderCyclopsAction(this.time.now);
    const boss = this.cyclopsBoss;
    if (boss) {
      this.tweens.killTweensOf(boss);
      boss.setPosition(
        CAVE_GATE_POSITION.x - 214,
        CAVE_GATE_POSITION.y - 114,
      );
      this.tweens.add({
        targets: boss,
        x: CAVE_GATE_POSITION.x - 230,
        y: CAVE_GATE_POSITION.y + 18,
        duration: 520,
        ease: "Sine.InOut",
        onUpdate: () =>
          this.cyclopsName?.setPosition(boss.x, boss.y - CYCLOPS_LABEL_OFFSET),
      });
    }
    this.time.delayedCall(500, () => {
      if (!this.caveGate || this.bossPoseToken !== poseToken) return;
      this.tweens.killTweensOf(this.caveGate);
      this.cyclopsAction = "gate-close";
      this.renderCyclopsAction(this.time.now);
      this.caveGate.setAlpha(0);
      this.tweens.add({
        targets: this.caveGate,
        x: CAVE_GATE_POSITION.x,
        y: CAVE_GATE_POSITION.y,
        angle: 0,
        scale: 1,
        duration: 900,
        ease: "Cubic.InOut",
        onComplete: () => {
          this.caveGate?.setAlpha(1);
          if (
            this.caveGateCollider &&
            !this.collisionRects.includes(this.caveGateCollider)
          ) {
            this.collisionRects.push(this.caveGateCollider);
          }
          this.caveGateStateLabel
            ?.setText("닫힘 · 통과 불가")
            .setColor("#ff9e80")
            .setBackgroundColor("#2a0d08e8");
        },
      });
      playSfx("stoneDoor", { volume: 0.4, rate: 0.76 });
      this.cameras.main.shake(480, 0.003);
    });
  }

  private walkCyclopsToSleepSpot(delayMs: number): void {
    this.time.delayedCall(delayMs, () => {
      const boss = this.cyclopsBoss;
      if (!boss?.active || this.fifthFloorMission?.phase !== "sleeping") {
        return;
      }
      this.tweens.killTweensOf(boss);
      const distance = Phaser.Math.Distance.Between(
        boss.x,
        boss.y,
        CYCLOPS_SLEEP_POSITION.x,
        CYCLOPS_SLEEP_POSITION.y,
      );
      const duration = Math.min(
        4_200,
        (distance / CYCLOPS_CHASE_SPEED) * 1_000,
      );
      if (duration < 60) {
        this.cyclopsAction = "sleep";
        this.renderCyclopsAction(this.time.now);
        return;
      }
      this.bossGateActionEndsAt = this.time.now + duration + 200;
      this.cyclopsDirection = directionFromAxes(
        CYCLOPS_SLEEP_POSITION.x - boss.x,
        CYCLOPS_SLEEP_POSITION.y - boss.y,
        this.cyclopsDirection,
      );
      this.cyclopsAction = "walk";
      this.renderCyclopsAction(this.time.now);
      this.tweens.add({
        targets: boss,
        x: CYCLOPS_SLEEP_POSITION.x,
        y: CYCLOPS_SLEEP_POSITION.y,
        duration,
        ease: "Sine.InOut",
        onUpdate: () =>
          this.cyclopsName?.setPosition(
            boss.x,
            boss.y - CYCLOPS_LABEL_OFFSET,
          ),
        onComplete: () => {
          if (this.fifthFloorMission?.phase !== "sleeping") return;
          this.bossGateActionEndsAt = Number.NEGATIVE_INFINITY;
          this.cyclopsAction = "sleep";
          this.renderCyclopsAction(this.time.now);
        },
      });
    });
  }

  private moveMissionSheep(location: "inside" | "outside"): void {
    for (const sheep of this.missionSheep) {
      sheep.target = location === "inside" ? sheep.inside : sheep.outside;
    }
  }

  private updateCyclopsVision(): void {
    if (!this.cyclopsVision || !this.fifthFloorMission || !this.cyclopsBoss) {
      return;
    }
    this.cyclopsVision.clear();
    // The attack reach is always drawn while the boss is awake, and strikes
    // are only ever aimed inside it — what the ring shows is what can hit.
    if (isCyclopsAwake(this.fifthFloorMission)) {
      const guardRange =
        this.fifthFloorMission.phase === "gate-open"
          ? cyclopsGuardAttackProfile(
              this.fifthFloorMission.weakPoint === "blinded",
            ).detectionRange
          : CYCLOPS_MELEE_GUARD_RANGE;
      this.cyclopsVision.fillStyle(0xd9422e, 0.045);
      this.cyclopsVision.fillCircle(
        this.cyclopsBoss.x,
        this.cyclopsBoss.y,
        guardRange,
      );
      this.cyclopsVision.lineStyle(3, 0xff7a4d, 0.42);
      this.cyclopsVision.strokeCircle(
        this.cyclopsBoss.x,
        this.cyclopsBoss.y,
        guardRange,
      );
    }
    if (!isCyclopsVisionActive(this.fifthFloorMission)) return;
    const start = this.cyclopsFacingAngle - CYCLOPS_VIEW_HALF_ANGLE;
    const end = this.cyclopsFacingAngle + CYCLOPS_VIEW_HALF_ANGLE;
    this.cyclopsVision.fillStyle(0xd9422e, 0.105);
    this.cyclopsVision.lineStyle(4, 0xff5a3d, 0.34);
    this.cyclopsVision.beginPath();
    this.cyclopsVision.moveTo(this.cyclopsBoss.x, this.cyclopsBoss.y);
    this.cyclopsVision.arc(
      this.cyclopsBoss.x,
      this.cyclopsBoss.y,
      CYCLOPS_VIEW_DISTANCE,
      start,
      end,
      false,
    );
    this.cyclopsVision.closePath();
    this.cyclopsVision.fillPath();
    this.cyclopsVision.strokePath();
  }

  private publishFifthFloorMission(force = false): void {
    if (!this.fifthFloorMission) return;
    const second = Math.ceil(this.fifthFloorMission.remainingMs / 1000);
    if (!force && second === this.fifthFloorLastPublishedSecond) return;
    this.fifthFloorLastPublishedSecond = second;
    useGameStore.getState().setFifthFloorMission({ ...this.fifthFloorMission });
  }

  private finishFifthFloorFailure(reason: FifthFloorFailureReason): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.aimCursor.setVisible(false);
    this.publishFifthFloorMission(true);
    useGameStore.getState().dispatch({ type: "FAIL_FIFTH_FLOOR", reason });
  }

  private finishFifthFloorEscape(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.aimCursor.setVisible(false);
    this.publishFifthFloorMission(true);
    this.cameras.main.flash(280, 232, 198, 126, false);
    this.cameras.main.fadeOut(420, 12, 8, 5);
    this.time.delayedCall(430, () => {
      useGameStore.getState().dispatch({ type: "COMPLETE_FLOOR" });
    });
  }

  private isFifthFloor(): boolean {
    const snapshot = useGameStore.getState().snapshot;
    return this.zone === "battle" && snapshot.floor === FIFTH_FLOOR_NUMBER;
  }

  private findOpenBattlePoint(x: number, y: number): { x: number; y: number } {
    const candidates = [
      [x, y],
      [x + 150, y],
      [x - 150, y],
      [x, y + 150],
      [x, y - 150],
    ] as const;
    for (const [candidateX, candidateY] of candidates) {
      const feet = new Phaser.Geom.Rectangle(
        candidateX - 18,
        candidateY,
        36,
        18,
      );
      if (
        Phaser.Geom.Rectangle.ContainsRect(this.movementBounds, feet) &&
        !this.intersectsWorldCollision(feet)
      ) {
        return { x: candidateX, y: candidateY };
      }
    }
    return { x: this.movementBounds.centerX, y: this.movementBounds.centerY };
  }

  private buildShopZone(): void {
    this.minimapNpcs.push({ x: 640, y: 232 });
    this.add
      .rectangle(640, 260, 290, 130, 0x3c2f2a)
      .setStrokeStyle(4, 0xc39261);
    this.collisionRects.push(new Phaser.Geom.Rectangle(495, 195, 290, 130));
    this.add.circle(640, 232, 34, 0xc79262).setStrokeStyle(4, 0xf1d39b);
    this.add
      .text(640, 318, "상인 · 마라", {
        color: "#f2d7a0",
        fontFamily: GAME_FONT,
        fontSize: "16px",
      })
      .setOrigin(0.5);
    this.createPortal(640, 540, "rest", "휴식처 귀환");
  }

  private updatePlayer(time: number, delta: number): void {
    this.maybeStartDash(time);
    const xAxis =
      Number(this.moveKeys.right.isDown) - Number(this.moveKeys.left.isDown);
    const yAxis =
      Number(this.moveKeys.down.isDown) - Number(this.moveKeys.up.isDown);
    const dashActive = time < this.dashEndsAt;
    const vector = dashActive
      ? this.dashDirection.clone()
      : new Phaser.Math.Vector2(xAxis, yAxis);
    const moving = dashActive || vector.lengthSq() > 0;
    const skillActive = this.isSkillPoseActive(time);
    const attackElapsed = time - this.weaponAttackStartedAt;
    const attacking =
      !skillActive &&
      attackElapsed >= 0 &&
      attackElapsed <= WEAPON_ATTACK_DURATION;
    if (moving && !attacking && !skillActive) {
      vector.normalize();
      this.playerDirection = directionFromAxes(
        dashActive ? this.dashDirection.x : xAxis,
        dashActive ? this.dashDirection.y : yAxis,
        this.playerDirection,
      );
    } else if (moving) {
      vector.normalize();
    }

    const speed = PLAYER_SPEED * (dashActive ? DASH_SPEED_MULTIPLIER : 1);
    const distance = (speed * delta) / 1000;
    const previousX = this.player.x;
    const previousY = this.player.y;
    this.movePlayerWithCollisions(vector.x * distance, vector.y * distance);
    if (
      time >= this.nextFootstepAt &&
      Phaser.Math.Distance.Between(
        previousX,
        previousY,
        this.player.x,
        this.player.y,
      ) > 0.4
    ) {
      this.nextFootstepAt = time + (dashActive ? 170 : 310);
      playSfx("footstep", {
        volume: dashActive ? 0.2 : 0.14,
        rate: dashActive ? 1.12 : 0.96,
      });
    }
    this.playerShadow.setPosition(this.player.x, this.player.y + 17);
    this.updatePlayerTexture(time, moving);
    this.updateHeldWeapon();
    this.player.setAngle(0);
  }

  private maybeStartDash(time: number): void {
    const taps: readonly [
      "up" | "down" | "left" | "right",
      Phaser.Input.Keyboard.Key,
      number,
      number,
      PlayerDirection,
    ][] = [
      ["up", this.moveKeys.up, 0, -1, "north"],
      ["down", this.moveKeys.down, 0, 1, "south"],
      ["left", this.moveKeys.left, -1, 0, "west"],
      ["right", this.moveKeys.right, 1, 0, "east"],
    ];
    for (const [name, key, x, y, direction] of taps) {
      if (!Phaser.Input.Keyboard.JustDown(key)) continue;
      const wasDoubleTap =
        time - this.lastMoveTapAt[name] <= DASH_DOUBLE_TAP_WINDOW;
      this.lastMoveTapAt[name] = time;
      if (!wasDoubleTap || time < this.nextDashAt) continue;
      this.dashDirection.set(x, y);
      this.playerDirection = direction;
      this.dashEndsAt = time + DASH_DURATION;
      this.nextDashAt = time + 430;
      this.nextDashTrailAt = time;
      this.playDashBurst();
      break;
    }
  }

  private playDashBurst(): void {
    const color = 0x8ce6d0;
    const ring = this.add
      .ellipse(this.player.x, this.player.y + 10, 52, 18, color, 0.18)
      .setStrokeStyle(3, color, 0.8)
      .setDepth(3);
    this.tweens.add({
      targets: ring,
      scaleX: 1.8,
      scaleY: 1.45,
      alpha: 0,
      duration: 220,
      ease: "Quad.Out",
      onComplete: () => ring.destroy(),
    });
    this.cameras.main.shake(70, 0.0016);
  }

  private updateDashTrail(time: number): void {
    if (time >= this.dashEndsAt || time < this.nextDashTrailAt) return;
    this.nextDashTrailAt = time + 42;
    const afterimage = this.add
      .image(this.player.x, this.player.y, this.player.texture.key)
      .setDisplaySize(this.player.displayWidth, this.player.displayHeight)
      .setOrigin(this.player.originX, this.player.originY)
      .setFlipX(this.player.flipX)
      .setTint(0x78e4db)
      .setAlpha(0.46)
      .setDepth(3);
    this.tweens.add({
      targets: afterimage,
      alpha: 0,
      scaleX: 0.88,
      scaleY: 1.08,
      duration: 190,
      ease: "Quad.Out",
      onComplete: () => afterimage.destroy(),
    });
  }

  private updatePlayerTexture(time: number, moving: boolean): void {
    if (this.isSkillPoseActive(time) && this.skillPoseWeapon) {
      const elapsed = time - this.skillPoseStartedAt;
      const duration = SKILL_POSE_DURATIONS[this.skillPoseWeapon];
      const frame = elapsed < duration * 0.48 ? 0 : 1;
      this.setPlayerTexture(
        this.directionalActionTexture(
          "skill",
          this.skillPoseWeapon,
          this.skillPoseDirection,
          frame,
        ),
      );
      return;
    }

    const attackElapsed = time - this.weaponAttackStartedAt;
    if (attackElapsed >= 0 && attackElapsed <= WEAPON_ATTACK_DURATION) {
      const frame = attackElapsed < WEAPON_ATTACK_DURATION * 0.43 ? 0 : 1;
      const weaponId = useGameStore.getState().snapshot.weapon;
      this.setPlayerTexture(
        this.directionalActionTexture(
          "attack",
          weaponId,
          this.weaponAttackDirection,
          frame,
        ),
      );
      return;
    }

    if (time < this.dashEndsAt) {
      const dashStartedAt = this.dashEndsAt - DASH_DURATION;
      const frame = Math.min(
        1,
        Math.floor((time - dashStartedAt) / DASH_FRAME_DURATION),
      );
      this.setPlayerTexture(`player-dash-${this.playerDirection}-${frame}`);
      return;
    }

    if (moving) {
      const frame = Math.floor(time / WALK_FRAME_DURATION) % 2;
      const weaponId = useGameStore.getState().snapshot.weapon;
      this.setPlayerTexture(
        playerLocomotionTextureFrame(weaponId, this.playerDirection, frame),
      );
      return;
    }

    const weaponId = useGameStore.getState().snapshot.weapon;
    this.setPlayerTexture(
      playerStanceTextureFrame(weaponId, this.playerDirection, 0),
    );
  }

  private setPlayerTexture(texture: string | PlayerTextureFrame): void {
    const frame =
      typeof texture === "string" ? { key: texture, flipX: false } : texture;
    this.player.setTexture(frame.key);
    this.player.setFlipX(frame.flipX);
    this.player.setDisplaySize(
      PLAYER_ACTION_DISPLAY_SIZE,
      PLAYER_ACTION_DISPLAY_SIZE,
    );
  }

  private updateHeldWeapon(): void {
    // Armed locomotion frames already include the selected weapon. Keeping the
    // old overlay would duplicate it and hide the authored leg motion.
    this.heldWeapon.setVisible(false);
  }

  private directionalActionTexture(
    action: "attack" | "skill",
    weaponId: WeaponId,
    direction: PlayerDirection,
    frame: number,
  ): PlayerTextureFrame {
    return playerActionTextureFrame(action, weaponId, direction, frame);
  }

  private movePlayerWithCollisions(deltaX: number, deltaY: number): void {
    const nextX = this.player.x + deltaX;
    if (this.canPlayerOccupy(nextX, this.player.y)) this.player.x = nextX;

    const nextY = this.player.y + deltaY;
    if (this.canPlayerOccupy(this.player.x, nextY)) this.player.y = nextY;
  }

  private canPlayerOccupy(x: number, y: number): boolean {
    const feet = new Phaser.Geom.Rectangle(
      x - PLAYER_FEET_WIDTH / 2,
      y + 12,
      PLAYER_FEET_WIDTH,
      PLAYER_FEET_HEIGHT,
    );
    if (!Phaser.Geom.Rectangle.ContainsRect(this.movementBounds, feet)) {
      return false;
    }
    if (this.intersectsWorldCollision(feet)) return false;
    if (!this.isFifthFloor()) return true;
    if (this.cyclopsBoss?.active) {
      const bossDistance = Phaser.Math.Distance.Between(
        x,
        y,
        this.cyclopsBoss.x,
        this.cyclopsBoss.y,
      );
      if (bossDistance <= CYCLOPS_CONTACT_AGGRO_DISTANCE) {
        this.triggerCyclopsAggro();
      }
      if (bossDistance < CYCLOPS_BODY_RADIUS + 17) return false;
    }
    return !this.missionCollisionBodies().some(
      (body) =>
        body.node.active &&
        doCaveBodiesOverlap({ x, y }, 17, body.node, body.radius),
    );
  }

  private intersectsWorldCollision(rectangle: Phaser.Geom.Rectangle): boolean {
    if (
      this.collisionRects.some((rect) =>
        Phaser.Geom.Intersects.RectangleToRectangle(rectangle, rect),
      )
    ) {
      return true;
    }
    const feetPoints = [
      { x: rectangle.left, y: rectangle.top },
      { x: rectangle.right, y: rectangle.top },
      { x: rectangle.left, y: rectangle.bottom },
      { x: rectangle.right, y: rectangle.bottom },
      { x: rectangle.centerX, y: rectangle.centerY },
    ];
    return this.collisionPolygons.some((polygon) =>
      feetPoints.some((point) =>
        Phaser.Geom.Polygon.Contains(polygon, point.x, point.y),
      ),
    );
  }

  private isSkillPoseActive(time: number): boolean {
    if (!this.skillPoseWeapon) return false;
    const elapsed = time - this.skillPoseStartedAt;
    return (
      elapsed >= 0 && elapsed <= SKILL_POSE_DURATIONS[this.skillPoseWeapon]
    );
  }

  private updateAim(): void {
    const pointer = this.pointerWorldPoint();
    const weaponId = useGameStore.getState().snapshot.weapon;
    const profile = WEAPON_COMBAT[weaponId];
    const angle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      pointer.x,
      pointer.y,
    );
    this.aimCursor
      .setVisible(true)
      .setPosition(pointer.x, pointer.y)
      .setRotation(angle);
    this.aimCursor.clear();
    this.aimCursor.lineStyle(2, profile.color, 0.88);
    this.aimCursor.strokeCircle(0, 0, 8);
    this.aimCursor.lineBetween(-14, 0, -9, 0);
    this.aimCursor.lineBetween(9, 0, 14, 0);
    this.aimCursor.fillStyle(profile.color, 0.92);
    this.aimCursor.fillTriangle(3, -4, 11, 0, 3, 4);
    this.aimCursor.fillStyle(0xffffff, 0.9);
    this.aimCursor.fillCircle(0, 0, 2);
  }

  private pointerWorldPoint(): Phaser.Math.Vector2 {
    const pointer = this.input.activePointer;
    return this.cameras.main.getWorldPoint(pointer.x, pointer.y);
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
    const weaponId = useGameStore.getState().snapshot.weapon;
    const profile = WEAPON_COMBAT[weaponId];
    if (now < this.nextBasicAttackAt || this.isSkillPoseActive(now)) return;
    this.nextBasicAttackAt = now + profile.cooldown;

    const target = this.pointerWorldPoint();
    const angle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      target.x,
      target.y,
    );
    this.playerDirection = directionFromAngle(angle);
    this.weaponAttackDirection = this.playerDirection;
    this.setPlayerTexture(
      this.directionalActionTexture(
        "attack",
        weaponId,
        this.playerDirection,
        0,
      ),
    );
    this.weaponAttackStartedAt = now;
    playCombatVoice("attack", weaponId);
    playSfx(weaponId === "staff" ? "magicCast" : "weaponSwing", {
      volume: weaponId === "bow" ? 0.26 : 0.36,
      rate: weaponId === "shield" ? 0.82 : 1,
    });
    if (this.isFifthFloor()) {
      this.handleCyclopsBasicAttack(angle, profile.range, profile.damage);
    }

    if (weaponId === "longsword") {
      this.playSlashEffect(angle, profile.range, profile.color, 0.68);
      this.damageEnemiesInCone(
        this.player.x,
        this.player.y,
        angle,
        profile.range,
        0.68,
        profile.damage,
      );
      return;
    }

    if (weaponId === "dagger") {
      this.playThrustEffect(angle, profile.range, profile.color, 8);
      this.damageEnemiesAlongLine(
        this.player.x,
        this.player.y,
        angle,
        profile.range,
        18,
        profile.damage,
      );
      return;
    }

    if (weaponId === "shield") {
      const hitX = this.player.x + Math.cos(angle) * 48;
      const hitY = this.player.y + Math.sin(angle) * 48;
      this.playShieldImpact(hitX, hitY, 52, profile.color);
      this.damageEnemies(hitX, hitY, 56, profile.damage, 34);
      return;
    }

    if (weaponId === "bow") {
      this.launchArrow(angle, profile.range, profile.damage, profile.color, 18);
      return;
    }

    const targetDistance = Phaser.Math.Clamp(
      Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        target.x,
        target.y,
      ),
      52,
      profile.range,
    );
    this.launchMagicOrb(
      angle,
      targetDistance,
      profile.damage,
      58,
      profile.color,
    );
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

    const pointer = this.pointerWorldPoint();
    const angle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      pointer.x,
      pointer.y,
    );
    const weaponId = snapshot.weapon;
    this.playerDirection = directionFromAngle(angle);
    this.skillPoseDirection = this.playerDirection;
    this.setPlayerTexture(
      this.directionalActionTexture("skill", weaponId, this.playerDirection, 0),
    );
    this.skillPoseWeapon = weaponId;
    this.skillPoseStartedAt = time;
    this.weaponAttackStartedAt = Number.NEGATIVE_INFINITY;
    const profile = WEAPON_COMBAT[weaponId];
    playSfx(
      weaponId === "staff" || weaponId === "bow" ? "magicCast" : "weaponSwing",
      { volume: 0.46, rate: weaponId === "shield" ? 0.78 : 0.92 },
    );
    playCombatVoice("skill", weaponId);
    if (this.isFifthFloor()) {
      this.handleCyclopsSkillAttack(angle, profile.range, profile.damage);
    }

    if (weaponId === "longsword") {
      this.playLongswordSkillEffect(angle, 0x8ce6d0);
      this.damageEnemiesInCone(
        this.player.x,
        this.player.y,
        angle,
        178,
        0.98,
        49,
        28,
      );
      return;
    }

    if (weaponId === "dagger") {
      this.playShadowDashEffect(angle, 225, 0xdf9df3);
      this.damageEnemiesAlongLine(
        this.player.x,
        this.player.y,
        angle,
        225,
        30,
        54,
      );
      this.dashPlayer(angle, 92);
      return;
    }

    if (weaponId === "shield") {
      this.playGuardianImpactEffect(angle, 145, 0xf0c97b);
      this.damageEnemies(this.player.x, this.player.y, 145, 39, 72);
      this.cameras.main.shake(180, 0.006);
      return;
    }

    if (weaponId === "bow") {
      this.playBowVolleyCharge(angle, 0xa9db7e);
      for (const [index, offset] of [-0.18, 0, 0.18].entries()) {
        this.time.delayedCall(205 + index * 34, () =>
          this.launchArrow(angle + offset, 440, 30, 0xa9db7e, 15, true),
        );
      }
      return;
    }

    const targetDistance = Phaser.Math.Clamp(
      Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        pointer.x,
        pointer.y,
      ),
      80,
      340,
    );
    this.castStarfall(angle, targetDistance, profile.color);
  }

  private handleCyclopsBasicAttack(
    angle: number,
    range: number,
    damage: number,
  ): void {
    if (!this.fifthFloorMission || !this.cyclopsBoss) return;
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.cyclopsBoss.x,
      this.cyclopsBoss.y,
    );
    const bossAngle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      this.cyclopsBoss.x,
      this.cyclopsBoss.y - 90,
    );
    const aimDifference = Math.abs(Phaser.Math.Angle.Wrap(bossAngle - angle));
    if (distance > range + CYCLOPS_BODY_RADIUS || aimDifference > 0.5) return;
    const hit = hitCyclopsWithBasicAttack(
      this.fifthFloorMission,
      damage,
      false,
    );
    this.fifthFloorMission = hit.state;
    this.handleFifthFloorEvents(hit.events);
  }

  private handleCyclopsSkillAttack(
    angle: number,
    range: number,
    damage: number,
  ): void {
    if (!this.fifthFloorMission || !this.cyclopsBoss) return;
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.cyclopsBoss.x,
      this.cyclopsBoss.y,
    );
    const bossAngle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      this.cyclopsBoss.x,
      this.cyclopsBoss.y,
    );
    if (
      distance > Math.max(180, range * 1.45) + CYCLOPS_BODY_RADIUS ||
      Math.abs(Phaser.Math.Angle.Wrap(bossAngle - angle)) > 0.72
    ) {
      return;
    }
    const hit = hitCyclopsWithSkill(
      this.fifthFloorMission,
      Math.max(8, Math.round(damage * 0.72)),
    );
    this.fifthFloorMission = hit.state;
    this.handleFifthFloorEvents(hit.events);
  }

  private playLongswordSkillEffect(angle: number, color: number): void {
    this.playSlashEffect(angle, 178, color, 0.98, 16);
    this.time.delayedCall(90, () =>
      this.playSlashEffect(angle + 0.12, 164, 0xf2c38c, 0.82, 10),
    );

    const crescent = this.add
      .graphics()
      .setPosition(this.player.x, this.player.y)
      .setDepth(9);
    crescent.lineStyle(8, color, 0.32);
    crescent.beginPath();
    crescent.arc(0, 0, 112, angle - 0.92, angle + 0.92, false);
    crescent.strokePath();
    crescent.lineStyle(2, 0xffffff, 0.88);
    crescent.beginPath();
    crescent.arc(0, 0, 106, angle - 0.82, angle + 0.82, false);
    crescent.strokePath();
    this.tweens.add({
      targets: crescent,
      scale: 1.24,
      alpha: 0,
      duration: 340,
      ease: "Quad.Out",
      onComplete: () => crescent.destroy(),
    });

    for (let index = 0; index < 9; index += 1) {
      const sparkAngle = angle - 0.85 + (index / 8) * 1.7;
      const spark = this.add
        .rectangle(
          this.player.x + Math.cos(sparkAngle) * 94,
          this.player.y + Math.sin(sparkAngle) * 94,
          11,
          3,
          index % 2 === 0 ? color : 0xffe2ad,
          0.9,
        )
        .setRotation(sparkAngle)
        .setDepth(10);
      this.tweens.add({
        targets: spark,
        x: spark.x + Math.cos(sparkAngle) * (36 + index * 2),
        y: spark.y + Math.sin(sparkAngle) * (36 + index * 2),
        scaleX: 0.25,
        alpha: 0,
        duration: 250 + index * 12,
        onComplete: () => spark.destroy(),
      });
    }
    this.cameras.main.shake(120, 0.004);
  }

  private playShadowDashEffect(
    angle: number,
    range: number,
    color: number,
  ): void {
    const originX = this.player.x;
    const originY = this.player.y;
    const texture = this.directionalActionTexture(
      "skill",
      "dagger",
      this.playerDirection,
      0,
    );
    for (let index = 0; index < 4; index += 1) {
      const echo = this.add
        .image(
          originX - Math.cos(angle) * index * 14,
          originY - Math.sin(angle) * index * 14,
          texture.key,
        )
        .setDisplaySize(PLAYER_ACTION_DISPLAY_SIZE, PLAYER_ACTION_DISPLAY_SIZE)
        .setOrigin(0.5, 0.78)
        .setFlipX(texture.flipX)
        .setTint(color)
        .setAlpha(0.32 - index * 0.055)
        .setDepth(4 - index * 0.01);
      this.tweens.add({
        targets: echo,
        x: echo.x - Math.cos(angle) * 28,
        y: echo.y - Math.sin(angle) * 28,
        alpha: 0,
        scale: 0.82,
        duration: 210 + index * 34,
        onComplete: () => echo.destroy(),
      });
    }

    const streaks = this.add.graphics().setDepth(8);
    for (const offset of [-13, 0, 13]) {
      const perpendicularX = Math.cos(angle + Math.PI / 2) * offset;
      const perpendicularY = Math.sin(angle + Math.PI / 2) * offset;
      streaks.lineStyle(offset === 0 ? 7 : 3, color, offset === 0 ? 0.75 : 0.4);
      streaks.lineBetween(
        originX + perpendicularX,
        originY + perpendicularY,
        originX + Math.cos(angle) * range + perpendicularX,
        originY + Math.sin(angle) * range + perpendicularY,
      );
    }
    streaks.lineStyle(2, 0xffffff, 0.9);
    streaks.lineBetween(
      originX,
      originY,
      originX + Math.cos(angle) * range,
      originY + Math.sin(angle) * range,
    );
    this.tweens.add({
      targets: streaks,
      alpha: 0,
      duration: 190,
      ease: "Quad.Out",
      onComplete: () => streaks.destroy(),
    });
    this.cameras.main.shake(80, 0.003);
  }

  private playGuardianImpactEffect(
    angle: number,
    radius: number,
    color: number,
  ): void {
    const x = this.player.x;
    const y = this.player.y;
    this.playShieldImpact(x, y, radius, color);
    this.playRuneCircle(x, y, radius * 0.72, color, 420);

    const ward = this.add
      .polygon(
        x + Math.cos(angle) * 38,
        y + Math.sin(angle) * 38,
        [-28, 0, -15, -29, 15, -29, 28, 0, 15, 29, -15, 29],
        color,
        0.2,
      )
      .setStrokeStyle(6, 0xffe4a6, 0.9)
      .setRotation(angle + Math.PI / 2)
      .setDepth(9);
    this.tweens.add({
      targets: ward,
      scale: 1.8,
      alpha: 0,
      duration: 360,
      ease: "Back.Out",
      onComplete: () => ward.destroy(),
    });

    for (let index = 0; index < 10; index += 1) {
      const shardAngle = (index / 10) * Math.PI * 2;
      const shard = this.add
        .rectangle(x, y, 7, 15, index % 2 === 0 ? color : 0xffefbd, 0.86)
        .setRotation(shardAngle)
        .setDepth(9);
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(shardAngle) * radius * 0.86,
        y: y + Math.sin(shardAngle) * radius * 0.86,
        angle: Phaser.Math.RadToDeg(shardAngle) + 120,
        alpha: 0,
        duration: 330 + index * 10,
        ease: "Quad.Out",
        onComplete: () => shard.destroy(),
      });
    }
  }

  private playBowVolleyCharge(angle: number, color: number): void {
    const charge = this.add
      .graphics()
      .setPosition(this.player.x, this.player.y)
      .setRotation(angle)
      .setDepth(8);
    charge.lineStyle(4, color, 0.76);
    charge.beginPath();
    charge.arc(0, 0, 46, -0.52, 0.52, false);
    charge.strokePath();
    charge.lineStyle(2, 0xffffff, 0.72);
    for (const offset of [-0.18, 0, 0.18]) {
      charge.lineBetween(18, 0, Math.cos(offset) * 58, Math.sin(offset) * 58);
    }
    this.tweens.add({
      targets: charge,
      scale: 0.72,
      alpha: 0,
      duration: 250,
      ease: "Sine.In",
      onComplete: () => charge.destroy(),
    });
  }

  private playSlashEffect(
    angle: number,
    range: number,
    color: number,
    halfAngle: number,
    thickness = 11,
  ): void {
    const slash = this.add.graphics().setDepth(8);
    slash.lineStyle(thickness, color, 0.88);
    slash.beginPath();
    slash.arc(
      this.player.x,
      this.player.y,
      range * 0.78,
      angle - halfAngle,
      angle + halfAngle,
      false,
    );
    slash.strokePath();
    slash.lineStyle(3, 0xffffff, 0.72);
    slash.beginPath();
    slash.arc(
      this.player.x,
      this.player.y,
      range * 0.72,
      angle - halfAngle * 0.92,
      angle + halfAngle * 0.92,
      false,
    );
    slash.strokePath();
    this.tweens.add({
      targets: slash,
      alpha: 0,
      duration: 210,
      ease: "Quad.Out",
      onComplete: () => slash.destroy(),
    });
  }

  private playThrustEffect(
    angle: number,
    range: number,
    color: number,
    thickness: number,
  ): void {
    const startX = this.player.x + Math.cos(angle) * 26;
    const startY = this.player.y + Math.sin(angle) * 26;
    const endX = this.player.x + Math.cos(angle) * range;
    const endY = this.player.y + Math.sin(angle) * range;
    const trail = this.add.graphics().setDepth(8);
    trail.lineStyle(thickness, color, 0.68);
    trail.lineBetween(startX, startY, endX, endY);
    trail.lineStyle(3, 0xffffff, 0.9);
    trail.lineBetween(startX, startY, endX, endY);
    this.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 150,
      ease: "Quad.Out",
      onComplete: () => trail.destroy(),
    });
  }

  private playShieldImpact(
    x: number,
    y: number,
    radius: number,
    color: number,
  ): void {
    const wave = this.add
      .circle(x, y, radius * 0.38, color, 0.16)
      .setStrokeStyle(9, color, 0.82)
      .setDepth(8);
    this.tweens.add({
      targets: wave,
      radius,
      alpha: 0,
      duration: 260,
      ease: "Back.Out",
      onComplete: () => wave.destroy(),
    });
  }

  private launchArrow(
    angle: number,
    range: number,
    damage: number,
    color: number,
    hitWidth: number,
    empowered = false,
  ): void {
    const startX = this.player.x + Math.cos(angle) * 28;
    const startY = this.player.y + Math.sin(angle) * 28;
    const endX = this.player.x + Math.cos(angle) * range;
    const endY = this.player.y + Math.sin(angle) * range;
    const trail = this.add.graphics().setDepth(7);
    trail.lineStyle(empowered ? 7 : 3, color, empowered ? 0.24 : 0.32);
    trail.lineBetween(startX, startY, endX, endY);
    if (empowered) {
      trail.lineStyle(2, 0xf5ffe8, 0.7);
      trail.lineBetween(startX, startY, endX, endY);
    }

    const projectile = this.add
      .container(startX, startY)
      .setRotation(angle)
      .setDepth(9);
    const glow = this.add.circle(
      0,
      0,
      empowered ? 11 : 6,
      color,
      empowered ? 0.22 : 0.1,
    );
    const shaft = this.add
      .rectangle(0, 0, empowered ? 27 : 18, empowered ? 5 : 4, color)
      .setStrokeStyle(1, 0xf7fff2, 0.9);
    const head = this.add.triangle(
      empowered ? 17 : 12,
      0,
      -5,
      -5,
      6,
      0,
      -5,
      5,
      empowered ? 0xf5ffe8 : color,
      0.96,
    );
    const fletching = this.add.triangle(
      empowered ? -16 : -11,
      0,
      5,
      -5,
      -5,
      0,
      5,
      5,
      color,
      0.82,
    );
    projectile.add([glow, shaft, head, fletching]);
    this.tweens.add({
      targets: projectile,
      x: endX,
      y: endY,
      duration: Math.max(150, range * 0.72),
      ease: "Linear",
      onComplete: () => {
        projectile.destroy();
        if (empowered) this.playProjectileImpact(endX, endY, color);
      },
    });
    if (empowered) {
      for (let index = 1; index <= 5; index += 1) {
        this.time.delayedCall(index * 48, () => {
          if (!projectile.active) return;
          const mote = this.add
            .circle(projectile.x, projectile.y, 3 + (index % 2), color, 0.62)
            .setDepth(8);
          this.tweens.add({
            targets: mote,
            x: mote.x - Math.cos(angle) * 28,
            y: mote.y - Math.sin(angle) * 28,
            scale: 0.2,
            alpha: 0,
            duration: 170,
            onComplete: () => mote.destroy(),
          });
        });
      }
    }
    this.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 260,
      onComplete: () => trail.destroy(),
    });
    this.damageEnemiesAlongLine(
      this.player.x,
      this.player.y,
      angle,
      range,
      hitWidth,
      damage,
    );
  }

  private launchMagicOrb(
    angle: number,
    distance: number,
    damage: number,
    explosionRadius: number,
    color: number,
  ): void {
    const startX = this.player.x + Math.cos(angle) * 30;
    const startY = this.player.y + Math.sin(angle) * 30;
    const endX = this.player.x + Math.cos(angle) * distance;
    const endY = this.player.y + Math.sin(angle) * distance;
    const glow = this.add.circle(startX, startY, 16, color, 0.18).setDepth(8);
    const orb = this.add
      .circle(startX, startY, 7, color)
      .setStrokeStyle(3, 0xeaf3ff, 0.9)
      .setDepth(9);
    this.tweens.add({
      targets: [glow, orb],
      x: endX,
      y: endY,
      duration: Math.max(190, distance * 0.9),
      ease: "Sine.In",
      onComplete: () => {
        glow.destroy();
        orb.destroy();
        this.flashAttack(endX, endY, explosionRadius, color);
        this.damageEnemies(endX, endY, explosionRadius, damage);
      },
    });
  }

  private castStarfall(angle: number, distance: number, color: number): void {
    const targetX = this.player.x + Math.cos(angle) * distance;
    const targetY = this.player.y + Math.sin(angle) * distance;
    this.playRuneCircle(this.player.x, this.player.y, 44, color, 420);
    this.playRuneCircle(targetX, targetY, 92, color, 560);
    const marker = this.add
      .circle(targetX, targetY, 92, color, 0.08)
      .setStrokeStyle(5, color, 0.62)
      .setDepth(7);
    this.tweens.add({
      targets: marker,
      scale: 0.68,
      alpha: 0.85,
      duration: 360,
      ease: "Sine.In",
      onComplete: () => {
        marker.destroy();
        const beam = this.add
          .rectangle(targetX, targetY - 62, 14, 138, color, 0.16)
          .setDepth(8);
        this.tweens.add({
          targets: beam,
          scaleX: 0.25,
          alpha: 0,
          duration: 230,
          onComplete: () => beam.destroy(),
        });
        const star = this.add
          .circle(targetX, targetY - 110, 18, 0xe9f2ff, 0.95)
          .setStrokeStyle(7, color, 0.75)
          .setDepth(9);
        this.tweens.add({
          targets: star,
          y: targetY,
          scale: 0.45,
          duration: 150,
          ease: "Quad.In",
          onComplete: () => {
            star.destroy();
            this.flashAttack(targetX, targetY, 132, color);
            this.playStarImpact(targetX, targetY, 132, color);
            this.damageEnemies(targetX, targetY, 132, 58, 22);
            this.cameras.main.shake(150, 0.0045);
          },
        });
      },
    });
  }

  private playRuneCircle(
    x: number,
    y: number,
    radius: number,
    color: number,
    duration: number,
  ): void {
    const runes = this.add.graphics().setPosition(x, y).setDepth(7);
    runes.lineStyle(3, color, 0.58);
    runes.strokeCircle(0, 0, radius);
    runes.lineStyle(1, 0xffffff, 0.34);
    runes.strokeCircle(0, 0, radius * 0.68);
    for (let index = 0; index < 8; index += 1) {
      const runeAngle = (index / 8) * Math.PI * 2;
      const innerX = Math.cos(runeAngle) * radius * 0.7;
      const innerY = Math.sin(runeAngle) * radius * 0.7;
      const outerX = Math.cos(runeAngle) * radius;
      const outerY = Math.sin(runeAngle) * radius;
      runes.lineBetween(innerX, innerY, outerX, outerY);
      runes.fillStyle(index % 2 === 0 ? color : 0xffffff, 0.74);
      runes.fillPoints(
        [
          { x: outerX, y: outerY - 6 },
          { x: outerX + 4, y: outerY },
          { x: outerX, y: outerY + 6 },
          { x: outerX - 4, y: outerY },
        ],
        true,
      );
    }
    this.tweens.add({
      targets: runes,
      angle: 90,
      scale: 0.76,
      alpha: 0,
      duration,
      ease: "Sine.InOut",
      onComplete: () => runes.destroy(),
    });
  }

  private playProjectileImpact(x: number, y: number, color: number): void {
    const impact = this.add.graphics().setPosition(x, y).setDepth(10);
    impact.lineStyle(3, color, 0.9);
    for (let index = 0; index < 6; index += 1) {
      const impactAngle = (index / 6) * Math.PI * 2;
      impact.lineBetween(
        Math.cos(impactAngle) * 5,
        Math.sin(impactAngle) * 5,
        Math.cos(impactAngle) * 24,
        Math.sin(impactAngle) * 24,
      );
    }
    impact.fillStyle(0xffffff, 0.86);
    impact.fillCircle(0, 0, 5);
    this.tweens.add({
      targets: impact,
      scale: 1.45,
      alpha: 0,
      duration: 180,
      onComplete: () => impact.destroy(),
    });
  }

  private playStarImpact(
    x: number,
    y: number,
    radius: number,
    color: number,
  ): void {
    for (let index = 0; index < 12; index += 1) {
      const rayAngle = (index / 12) * Math.PI * 2;
      const ray = this.add
        .triangle(
          x,
          y,
          -5,
          8,
          0,
          -12,
          5,
          8,
          index % 2 === 0 ? color : 0xffffff,
          0.9,
        )
        .setRotation(rayAngle)
        .setDepth(10);
      this.tweens.add({
        targets: ray,
        x: x + Math.cos(rayAngle) * radius * 0.82,
        y: y + Math.sin(rayAngle) * radius * 0.82,
        scale: 0.2,
        alpha: 0,
        duration: 330 + index * 11,
        ease: "Quad.Out",
        onComplete: () => ray.destroy(),
      });
    }
  }

  private dashPlayer(angle: number, distance: number): void {
    const steps = 12;
    for (let step = 1; step <= steps; step += 1) {
      const candidateX =
        this.player.x + Math.cos(angle) * ((distance * step) / steps);
      const candidateY =
        this.player.y + Math.sin(angle) * ((distance * step) / steps);
      if (!this.canPlayerOccupy(candidateX, candidateY)) break;
      this.player.x = candidateX;
      this.player.y = candidateY;
    }
    this.playerShadow.setPosition(this.player.x, this.player.y + 17);
    this.cameras.main.flash(90, 190, 130, 225, false);
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
    knockback = 0,
  ): void {
    for (const actor of [...this.enemies]) {
      if (
        Phaser.Math.Distance.Between(x, y, actor.node.x, actor.node.y) > radius
      )
        continue;
      this.hitEnemy(actor, damage, x, y, knockback);
    }
  }

  private damageEnemiesInCone(
    x: number,
    y: number,
    angle: number,
    range: number,
    halfAngle: number,
    damage: number,
    knockback = 0,
  ): void {
    for (const actor of [...this.enemies]) {
      const distance = Phaser.Math.Distance.Between(
        x,
        y,
        actor.node.x,
        actor.node.y,
      );
      if (distance > range) continue;
      const targetAngle = Phaser.Math.Angle.Between(
        x,
        y,
        actor.node.x,
        actor.node.y,
      );
      if (Math.abs(Phaser.Math.Angle.Wrap(targetAngle - angle)) > halfAngle) {
        continue;
      }
      this.hitEnemy(actor, damage, x, y, knockback);
    }
  }

  private damageEnemiesAlongLine(
    x: number,
    y: number,
    angle: number,
    range: number,
    width: number,
    damage: number,
  ): void {
    const endX = x + Math.cos(angle) * range;
    const endY = y + Math.sin(angle) * range;
    for (const actor of [...this.enemies]) {
      if (
        distanceToSegment(actor.node.x, actor.node.y, x, y, endX, endY) > width
      ) {
        continue;
      }
      this.hitEnemy(actor, damage, x, y);
    }
  }

  private hitEnemy(
    actor: EnemyActor,
    damage: number,
    sourceX: number,
    sourceY: number,
    knockback = 0,
  ): void {
    if (!actor.node.active || actor.hp <= 0) return;
    if (this.time.now >= this.nextImpactSoundAt) {
      this.nextImpactSoundAt = this.time.now + 72;
      playSfx("weaponHit");
    }
    actor.hp = Math.max(0, actor.hp - damage);
    if (knockback > 0) {
      const push = new Phaser.Math.Vector2(
        actor.node.x - sourceX,
        actor.node.y - sourceY,
      );
      if (push.lengthSq() > 0) {
        push.normalize().scale(knockback);
        actor.node.x = Phaser.Math.Clamp(
          actor.node.x + push.x,
          this.movementBounds.left + 24,
          this.movementBounds.right - 24,
        );
        actor.node.y = Phaser.Math.Clamp(
          actor.node.y + push.y,
          this.movementBounds.top + 24,
          this.movementBounds.bottom - 24,
        );
      }
    }
    actor.node.setTintFill(0xffffff);
    this.time.delayedCall(70, () => {
      if (actor.node.active) {
        actor.node.clearTint();
        if (actor.wanderer && this.enemies.includes(actor)) {
          actor.node.setTint(0xffa85c);
        }
      }
    });
    this.showDamage(actor.node.x, actor.node.y - 35, damage);
    if (actor.hp === 0) this.defeatEnemy(actor);
  }

  private updateEnemies(time: number, delta: number): void {
    for (const actor of this.enemies) {
      const vector = new Phaser.Math.Vector2(
        this.player.x - actor.node.x,
        this.player.y - actor.node.y,
      );
      const distance = vector.length();
      if (time < actor.attackEndsAt) {
        this.updateActorTexture(actor, vector.x, vector.y, time);
      } else if (distance > 62) {
        vector.normalize();
        const step = (actor.speed * delta) / 1000;
        this.moveActorWithCollisions(actor, vector.x * step, vector.y * step);
        this.updateActorTexture(actor, vector.x, vector.y, time);
      } else if (time >= actor.nextAttackAt) {
        actor.nextAttackAt = time + actor.attackCooldown;
        this.playActorAttack(actor, this.player.x, this.player.y, 0xf06b5f);
        this.time.delayedCall(150, () => {
          if (
            !actor.node.active ||
            Phaser.Math.Distance.Between(
              actor.node.x,
              actor.node.y,
              this.player.x,
              this.player.y,
            ) > 82
          ) {
            return;
          }
          useGameStore
            .getState()
            .dispatch({ type: "TAKE_DAMAGE", amount: actor.attackDamage });
          this.playPlayerHit(actor.node.x, actor.node.y);
        });
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

    if (time < ally.attackEndsAt) {
      this.updateActorTexture(ally, vector.x, vector.y, time);
      return;
    }

    if (distance > (target ? 68 : 46)) {
      vector.normalize();
      const step = (ally.speed * delta) / 1000;
      this.moveActorWithCollisions(ally, vector.x * step, vector.y * step);
      this.updateActorTexture(ally, vector.x, vector.y, time);
    } else if (target && time >= this.nextAllyAttackAt) {
      const difficulty = getFloorDifficulty(
        useGameStore.getState().snapshot.floor,
      );
      this.nextAllyAttackAt = time + 760 / difficulty.attackRate;
      this.playActorAttack(ally, target.node.x, target.node.y, 0x6fd5c3);
      this.time.delayedCall(150, () => {
        if (!target.node.active || target.hp <= 0) return;
        this.hitEnemy(
          target,
          Math.round(10 * Math.sqrt(difficulty.damage)),
          ally.node.x,
          ally.node.y,
          10,
        );
      });
    }
  }

  private moveActorWithCollisions(
    actor: EnemyActor,
    deltaX: number,
    deltaY: number,
  ): void {
    const canOccupy = (x: number, y: number): boolean => {
      const feet = new Phaser.Geom.Rectangle(x - 14, y + 8, 28, 14);
      return (
        Phaser.Geom.Rectangle.ContainsRect(this.movementBounds, feet) &&
        !this.intersectsWorldCollision(feet)
      );
    };
    for (const candidate of movementAvoidanceCandidates(
      deltaX,
      deltaY,
      Math.round(actor.node.x + actor.node.y) % 2 === 0,
    )) {
      const distance = Math.hypot(deltaX, deltaY);
      const nextX = actor.node.x + candidate.x * distance;
      const nextY = actor.node.y + candidate.y * distance;
      if (!canOccupy(nextX, nextY)) continue;
      actor.node.setPosition(nextX, nextY);
      return;
    }
  }

  private playActorAttack(
    actor: EnemyActor,
    targetX: number,
    targetY: number,
    color: number,
  ): void {
    const now = this.time.now;
    const angle = Phaser.Math.Angle.Between(
      actor.node.x,
      actor.node.y,
      targetX,
      targetY,
    );
    actor.direction = cardinalDirectionFromAxes(
      Math.cos(angle),
      Math.sin(angle),
    );
    actor.attackStartedAt = now;
    actor.attackEndsAt = now + 330;
    const attackSound =
      actor.textureBase === "beetle"
        ? "beetleAttack"
        : actor.textureBase === "wraith"
          ? "wraithAttack"
          : actor.wanderer
            ? "weaponSwing"
            : "monsterAttack";
    playSfx(attackSound, { volume: actor.wanderer ? 0.28 : 0.3 });
    actor.node.setTexture(
      `actor-${actor.textureBase}-attack-${actor.direction}-0`,
    );
    const startX = actor.node.x;
    const startY = actor.node.y;
    this.tweens.add({
      targets: actor.node,
      x: startX + Math.cos(angle) * 16,
      y: startY + Math.sin(angle) * 16,
      duration: 145,
      yoyo: true,
      ease: "Quad.Out",
    });
    this.time.delayedCall(130, () => {
      if (!actor.node.active) return;
      actor.node.setTexture(
        `actor-${actor.textureBase}-attack-${actor.direction}-1`,
      );
      this.playCombatSwipe(
        actor.node.x + Math.cos(angle) * 28,
        actor.node.y + Math.sin(angle) * 28,
        angle,
        color,
      );
    });
  }

  private playCombatSwipe(
    x: number,
    y: number,
    angle: number,
    color: number,
  ): void {
    const swipe = this.add.graphics().setPosition(x, y).setDepth(9);
    swipe.lineStyle(7, color, 0.86);
    swipe.beginPath();
    swipe.arc(0, 0, 29, angle - 0.85, angle + 0.85, false);
    swipe.strokePath();
    swipe.lineStyle(2, 0xffffff, 0.78);
    swipe.beginPath();
    swipe.arc(0, 0, 23, angle - 0.7, angle + 0.7, false);
    swipe.strokePath();
    this.tweens.add({
      targets: swipe,
      scale: 1.25,
      alpha: 0,
      duration: 190,
      onComplete: () => swipe.destroy(),
    });
  }

  private playPlayerHit(sourceX: number, sourceY: number): void {
    const angle = Phaser.Math.Angle.Between(
      sourceX,
      sourceY,
      this.player.x,
      this.player.y,
    );
    this.playCombatSwipe(this.player.x, this.player.y, angle, 0xff665e);
    playSfx("weaponHit", { volume: 0.34, rate: 0.88 });
    this.player.setTintFill(0xffffff);
    this.time.delayedCall(75, () => {
      if (this.player.active) this.player.clearTint();
    });
    this.cameras.main.shake(100, 0.0038);
  }

  private updateActorUi(): void {
    for (const actor of [...this.enemies, ...(this.ally ? [this.ally] : [])]) {
      if (!actor.node.active) continue;
      actor.barBack.setPosition(actor.node.x, actor.node.y + 35);
      actor.barFill.setPosition(actor.node.x - 21, actor.node.y + 35);
      actor.barFill.width = 42 * (actor.hp / actor.maxHp);
      actor.name.setPosition(actor.node.x, actor.node.y - 50);
    }
  }

  private updateActorTexture(
    actor: EnemyActor,
    xAxis: number,
    yAxis: number,
    time: number,
  ): void {
    actor.direction = cardinalDirectionFromAxes(xAxis, yAxis);
    if (time < actor.attackEndsAt) {
      const frame = time - actor.attackStartedAt < 145 ? 0 : 1;
      actor.node.setTexture(
        `actor-${actor.textureBase}-attack-${actor.direction}-${frame}`,
      );
      return;
    }
    const frame = Math.floor(time / ACTOR_WALK_FRAME_DURATION) % 2;
    actor.node.setTexture(
      `actor-${actor.textureBase}-${actor.direction}-${frame}`,
    );
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
    textureBase: ActorKind,
    label: string,
    hp: number,
    speed: number,
    wanderer: boolean,
    xpReward: number,
  ): EnemyActor {
    const actor = this.spawnActor(
      x,
      y,
      textureBase,
      label,
      hp,
      speed,
      wanderer,
      xpReward,
    );
    this.enemies.push(actor);
    return actor;
  }

  private spawnActor(
    x: number,
    y: number,
    textureBase: ActorKind,
    label: string,
    hp: number,
    speed: number,
    wanderer: boolean,
    xpReward: number,
  ): EnemyActor {
    const node = this.add
      .image(x, y, `actor-${textureBase}-south-0`)
      .setDisplaySize(
        textureBase === "wanderer" ? 66 : textureBase === "wraith" ? 82 : 74,
        textureBase === "wanderer" ? 96 : textureBase === "wraith" ? 92 : 74,
      )
      .setOrigin(0.5, 0.72)
      .setDepth(4);
    const barBack = this.add
      .rectangle(x, y + 30, 46, 7, 0x101417)
      .setStrokeStyle(2, 0x07090a);
    const barFill = this.add
      .rectangle(x - 21, y + 30, 42, 4, wanderer ? 0xf0ad5d : 0xe75b67)
      .setOrigin(0, 0.5);
    const name = this.add
      .text(x, y - 36, label, {
        color: wanderer ? "#ffe0a6" : "#f6c5c9",
        fontFamily: GAME_FONT,
        fontSize: "12px",
        backgroundColor: "#0b1117aa",
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5)
      .setResolution(2);
    return {
      node,
      barBack,
      barFill,
      name,
      hp,
      maxHp: hp,
      speed,
      nextAttackAt: 0,
      attackStartedAt: Number.NEGATIVE_INFINITY,
      attackEndsAt: Number.NEGATIVE_INFINITY,
      attackDamage: Math.max(
        1,
        Math.round(
          (wanderer ? 9 : 6) *
            getFloorDifficulty(useGameStore.getState().snapshot.floor).damage,
        ),
      ),
      attackCooldown:
        (wanderer ? 940 : 1080) /
        getFloorDifficulty(useGameStore.getState().snapshot.floor).attackRate,
      wanderer,
      textureBase,
      direction: "south",
      xpReward,
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
    if (actor.xpReward > 0) {
      useGameStore
        .getState()
        .dispatch({ type: "GAIN_EXPERIENCE", amount: actor.xpReward });
    }
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
      playSfx("pickup");
      drop.node.destroy();
      drop.glow.destroy();
      this.drops.splice(this.drops.indexOf(drop), 1);
    }
  }

  private maybeCreateReturnPortal(): void {
    if (this.isFifthFloor()) return;
    if (this.enemies.length > 0 || this.returnPortalCreated) return;
    this.returnPortalCreated = true;
    const floor = useGameStore.getState().snapshot.floor;
    const x = this.movementBounds.centerX;
    const y = this.movementBounds.top + 125;
    this.createPortal(x, y, "rest", "휴식처 귀환");
    this.addInstruction(x, y + 74, `${floor}층 정리 완료 · 귀환 포탈에서 W`);
  }

  private createPortal(
    x: number,
    y: number,
    target: ZoneId,
    labelText: string,
  ): void {
    const color =
      target === "battle" ? 0xd87366 : target === "shop" ? 0xd5b96c : 0x77d9c7;
    const darkColor =
      target === "battle" ? 0x3a171d : target === "shop" ? 0x3b3218 : 0x173a35;
    const node = this.add.container(x, y).setDepth(2);
    const glow = this.add.ellipse(0, 5, 102, 116, color, 0.2);
    const core = this.add
      .rectangle(0, 2, 52, 66, darkColor, 0.82)
      .setStrokeStyle(4, color, 0.88);
    const innerLight = this.add.rectangle(0, 2, 40, 54, color, 0.1);
    const frame = this.add.graphics();
    frame.fillStyle(0x172128, 1);
    frame.fillRect(-40, -29, 13, 63);
    frame.fillRect(27, -29, 13, 63);
    frame.fillRect(-32, -42, 64, 14);
    frame.fillRect(-27, -51, 19, 10);
    frame.fillRect(8, -51, 19, 10);
    frame.fillStyle(color, 0.56);
    frame.fillRect(-36, -24, 5, 52);
    frame.fillRect(31, -24, 5, 52);
    frame.fillRect(-25, -46, 50, 4);
    frame.fillStyle(0xdde8df, 0.34);
    frame.fillRect(-40, -29, 4, 54);
    frame.fillRect(27, -29, 4, 54);
    const rune = this.add
      .text(0, 1, target === "battle" ? "Ⅰ" : target === "shop" ? "◆" : "⌂", {
        color: target === "battle" ? "#ffd6c6" : "#f5f1df",
        fontFamily: GAME_FONT,
        fontSize: "25px",
      })
      .setOrigin(0.5);
    const label = this.add
      .text(0, 64, labelText, {
        color: "#f2ead2",
        fontFamily: GAME_FONT,
        fontSize: "14px",
        backgroundColor: "#101923cc",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5);
    node.add([glow, core, innerLight, frame, rune, label]);

    let door: Phaser.GameObjects.Container | undefined;
    if (this.zone === "rest" && target === "battle") {
      door = this.add.container(0, 4);
      const slab = this.add
        .rectangle(0, 0, 45, 57, 0x432b26)
        .setStrokeStyle(3, 0xb07055);
      const upperBand = this.add.rectangle(0, -17, 39, 5, 0x734939);
      const lowerBand = this.add.rectangle(0, 17, 39, 5, 0x734939);
      const handle = this.add.circle(13, 2, 3, 0xe6bd71);
      door.add([slab, upperBand, lowerBand, handle]);
      node.add(door);
      rune.setDepth(2);
    }

    for (let index = 0; index < 4; index += 1) {
      const spark = this.add
        .rectangle(index % 2 === 0 ? -48 : 48, -28 + index * 18, 4, 4, color)
        .setAlpha(0.35);
      node.add(spark);
      this.tweens.add({
        targets: spark,
        y: spark.y - 12,
        alpha: 0.9,
        yoyo: true,
        repeat: -1,
        delay: index * 130,
        duration: 520 + index * 70,
      });
    }
    this.tweens.add({
      targets: glow,
      scaleX: 1.14,
      scaleY: 1.07,
      alpha: 0.3,
      yoyo: true,
      repeat: -1,
      duration: 760,
    });
    this.tweens.add({
      targets: core,
      alpha: 0.62,
      yoyo: true,
      repeat: -1,
      duration: 520,
    });
    this.tweens.add({
      targets: innerLight,
      alpha: 0.34,
      yoyo: true,
      repeat: -1,
      duration: 640,
    });
    // Only the stone uprights are solid. The center remains walkable so the
    // player can actually step inside the interaction radius of the gate.
    this.collisionRects.push(
      new Phaser.Geom.Rectangle(x - 42, y - 52, 15, 78),
      new Phaser.Geom.Rectangle(x + 27, y - 52, 15, 78),
    );
    this.portals.push({ node, glow, core, door, rune, label, target });
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
      this.animatePortalTransition(portal);
      return true;
    }
    return false;
  }

  private animatePortalTransition(portal: PortalActor): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.aimCursor.setVisible(false);

    if (portal.door) {
      this.tweens.add({
        targets: portal.door,
        x: 18,
        scaleX: 0.2,
        scaleY: 1.08,
        angle: -7,
        duration: 220,
        hold: 150,
        yoyo: true,
        ease: "Sine.InOut",
      });
      this.tweens.add({
        targets: portal.core,
        alpha: 1,
        duration: 180,
        yoyo: true,
        hold: 180,
      });
      this.time.delayedCall(470, () =>
        this.cameras.main.fadeOut(170, 16, 12, 16),
      );
      this.time.delayedCall(650, () => {
        this.dispatchPortalCommand(portal.target);
      });
      return;
    }

    this.tweens.add({
      targets: portal.node,
      scale: 1.13,
      duration: 120,
      yoyo: true,
    });
    this.cameras.main.flash(180, 90, 180, 160, false);
    this.time.delayedCall(240, () => {
      this.dispatchPortalCommand(portal.target);
    });
  }

  private dispatchPortalCommand(target: ZoneId): void {
    const dispatch = useGameStore.getState().dispatch;
    if (this.isFifthFloor() && target === "rest" && this.fifthFloorMission) {
      const escaped = escapeFifthFloorMission(this.fifthFloorMission);
      this.fifthFloorMission = escaped.state;
      if (escaped.state.status === "failed") {
        this.handleFifthFloorEvents(escaped.events);
        return;
      }
      if (escaped.state.status !== "escaped") {
        this.transitioning = false;
        this.showBossCallout(
          this.fifthFloorMission.reachedBeach
            ? `생존 병사 집결 대기 · ${this.fifthFloorMission.alliesAtBeach}/${this.fifthFloorMission.alliesRemaining}`
            : "먼저 열린 바위문을 지나 바닷가에 도달해야 합니다",
          "#ffc39c",
        );
        return;
      }
      this.publishFifthFloorMission(true);
      dispatch({ type: "COMPLETE_FLOOR" });
      return;
    }
    if (
      this.zone === "battle" &&
      target === "rest" &&
      this.returnPortalCreated
    ) {
      dispatch({ type: "COMPLETE_FLOOR" });
      return;
    }
    dispatch({ type: "ENTER_ZONE", zone: target });
  }

  private addInstruction(x: number, y: number, text: string): void {
    this.add
      .text(x, y, text, {
        color: "#cfddd6",
        fontFamily: GAME_FONT,
        fontSize: "14px",
        backgroundColor: "#0b1117bb",
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setResolution(2);
  }

  private showDamage(x: number, y: number, amount: number): void {
    const text = this.add
      .text(x, y, String(amount), {
        color: "#fff2b3",
        fontFamily: GAME_FONT,
        fontSize: "24px",
        fontStyle: "bold",
        stroke: "#552c28",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setResolution(2);
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
    this.input.setDefaultCursor("default");
    this.heldWeapon?.setVisible(false);
  }
}

function zoneBackground(zone: ZoneId): number {
  if (zone === "battle") return 0x0e141a;
  if (zone === "shop") return 0x211b1a;
  return 0x14231f;
}

function cardinalDirectionFromAxes(
  xAxis: number,
  yAxis: number,
): ActorDirection {
  if (Math.abs(xAxis) > Math.abs(yAxis)) return xAxis < 0 ? "west" : "east";
  return yAxis < 0 ? "north" : "south";
}

function playerDirectionAngle(direction: PlayerDirection): number {
  const index = PLAYER_DIRECTIONS.indexOf(direction);
  return -Math.PI / 2 + index * (Math.PI / 4);
}

function distanceToSegment(
  pointX: number,
  pointY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): number {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared === 0) {
    return Phaser.Math.Distance.Between(pointX, pointY, startX, startY);
  }
  const projection = Phaser.Math.Clamp(
    ((pointX - startX) * segmentX + (pointY - startY) * segmentY) /
      lengthSquared,
    0,
    1,
  );
  const nearestX = startX + segmentX * projection;
  const nearestY = startY + segmentY * projection;
  return Phaser.Math.Distance.Between(pointX, pointY, nearestX, nearestY);
}

export function relationLabel(role: WandererRole): string {
  return role === "ally" ? "아군" : "적군";
}
