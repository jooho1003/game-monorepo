import type { FifthFloorPhase } from "../domain/fifth-floor-mission.js";

export interface CavePoint {
  x: number;
  y: number;
}

export interface CaveRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FIFTH_FLOOR_NUMBER = 5;
export const CAVE_WORLD_WIDTH = 4200;
export const CAVE_WORLD_HEIGHT = 1600;
export const CAVE_PLAYER_SPAWN: CavePoint = { x: 390, y: 800 };
export const CYCLOPS_POSITION: CavePoint = { x: 2160, y: 800 };
/** Centre of the open arena — where the Cyclops always beds down. */
export const CYCLOPS_SLEEP_POSITION: CavePoint = { x: 1568, y: 780 };
export const CYCLOPS_FACING_ANGLE = Math.PI;
export const CYCLOPS_VIEW_DISTANCE = 720;
export const CYCLOPS_VIEW_HALF_ANGLE = Math.PI / 5.2;
export const CYCLOPS_GATE_GUARD_RANGE = 600;
export const CYCLOPS_BLINDED_GUARD_RANGE = 200;
export const CYCLOPS_GATE_STRIKE_RADIUS = 102;
export const CYCLOPS_BLINDED_STRIKE_RADIUS = 50;
export const PLAYER_DISPLAY_SIZE = 84;
export const CYCLOPS_DISPLAY_SIZE = PLAYER_DISPLAY_SIZE * 6;
export const CAVE_GATE_POSITION: CavePoint = { x: 2490, y: 800 };
export const CAVE_GATE_COLLIDER: CaveRectangle = {
  x: 2418,
  y: 642,
  width: 116,
  height: 316,
};
export const CAVE_EXIT: CaveRectangle = {
  x: 2525,
  y: 676,
  width: 110,
  height: 248,
};
export const BEACH_REGION: CaveRectangle = {
  x: 2700,
  y: 112,
  width: 1380,
  height: 1376,
};
export const BEACH_REST_GATE_POSITION: CavePoint = { x: 3720, y: 800 };
export const CAVE_MOVEMENT_BOUNDS: CaveRectangle = {
  x: 112,
  y: 112,
  width: 3968,
  height: 1376,
};

// The arena centre is deliberately empty. The four columns and the rocks
// flanking the gate approach used to sit right across the flock's route and
// wedged sheep against them, so only wall-hugging cover remains.
export const CAVE_OBSTACLES: readonly CaveRectangle[] = [
  { x: 700, y: 250, width: 190, height: 120 },
  { x: 870, y: 455, width: 150, height: 145 },
  { x: 880, y: 1180, width: 230, height: 120 },
  { x: 1320, y: 220, width: 160, height: 110 },
  { x: 1390, y: 1260, width: 240, height: 105 },
  { x: 1740, y: 330, width: 170, height: 120 },
  { x: 1780, y: 1130, width: 180, height: 130 },
] as const;

/** Solid masonry around the only cave-to-beach opening. */
export const CAVE_STRUCTURE_COLLIDERS: readonly CaveRectangle[] = [
  ...CAVE_OBSTACLES,
  { x: 2360, y: 112, width: 330, height: CAVE_GATE_COLLIDER.y - 112 },
  {
    x: 2360,
    y: CAVE_GATE_COLLIDER.y + CAVE_GATE_COLLIDER.height,
    width: 330,
    height:
      CAVE_MOVEMENT_BOUNDS.y +
      CAVE_MOVEMENT_BOUNDS.height -
      (CAVE_GATE_COLLIDER.y + CAVE_GATE_COLLIDER.height),
  },
  { x: 2860, y: 210, width: 190, height: 150 },
  { x: 3060, y: 405, width: 100, height: 190 },
  { x: 3380, y: 250, width: 150, height: 125 },
  { x: 3090, y: 1190, width: 165, height: 135 },
  { x: 3500, y: 1260, width: 180, height: 130 },
] as const;

export interface CyclopsGuardAttackProfile {
  detectionRange: number;
  strikeRadius: number;
  warningMs: number;
  cooldownMs: number;
}

export function cyclopsGuardAttackProfile(
  blinded: boolean,
): CyclopsGuardAttackProfile {
  return blinded
    ? {
        detectionRange: CYCLOPS_BLINDED_GUARD_RANGE,
        strikeRadius: CYCLOPS_BLINDED_STRIKE_RADIUS,
        warningMs: 1_200,
        cooldownMs: 3_300,
      }
    : {
        detectionRange: CYCLOPS_GATE_GUARD_RANGE,
        strikeRadius: CYCLOPS_GATE_STRIKE_RADIUS,
        warningMs: 660,
        cooldownMs: 1_300,
      };
}

export function isPointInCyclopsGuardRange(
  point: CavePoint,
  cyclopsPosition: CavePoint,
  blinded: boolean,
): boolean {
  return (
    Math.hypot(
      point.x - cyclopsPosition.x,
      point.y - cyclopsPosition.y,
    ) <= cyclopsGuardAttackProfile(blinded).detectionRange
  );
}

export function missionShoveTarget(
  origin: CavePoint,
  actor: CavePoint,
  facingAngle: number,
  distance = 104,
): CavePoint {
  const dx = actor.x - origin.x;
  const dy = actor.y - origin.y;
  const length = Math.hypot(dx, dy);
  const normalX = length > 0 ? dx / length : Math.cos(facingAngle);
  const normalY = length > 0 ? dy / length : Math.sin(facingAngle);
  return {
    x: actor.x + normalX * distance,
    y: actor.y + normalY * distance,
  };
}

export const ALLY_SPAWNS: readonly CavePoint[] = Array.from(
  { length: 15 },
  (_, index) => {
    const row = Math.floor(index / 5);
    return {
      x: CAVE_PLAYER_SPAWN.x + ((index % 5) - 2) * 56,
      y: CAVE_PLAYER_SPAWN.y - 92 - row * 60,
    };
  },
);

export const SHEEP_INSIDE_SPAWNS: readonly CavePoint[] = Array.from(
  { length: 20 },
  (_, index) => ({
    x: 1050 + (index % 5) * 100 + (Math.floor(index / 5) % 2) * 18,
    y: 590 + Math.floor(index / 5) * 75,
  }),
);

export const SHEEP_OUTSIDE_SPAWNS: readonly CavePoint[] = Array.from(
  { length: 20 },
  (_, index) => ({
    x: 3020 + (index % 5) * 112 + (Math.floor(index / 5) % 2) * 30,
    y: 660 + Math.floor(index / 5) * 145,
  }),
);

export function movementAvoidanceCandidates(
  x: number,
  y: number,
  preferClockwise: boolean,
): readonly CavePoint[] {
  const length = Math.hypot(x, y);
  if (length === 0) return [];
  const normalizedX = x / length;
  const normalizedY = y / length;
  const side = preferClockwise ? 1 : -1;
  const offsets = [
    0,
    (side * Math.PI) / 4,
    (-side * Math.PI) / 4,
    (side * Math.PI) / 2,
    (-side * Math.PI) / 2,
    (side * Math.PI * 3) / 4,
    (-side * Math.PI * 3) / 4,
  ];
  return offsets.map((offset) => ({
    x: normalizedX * Math.cos(offset) - normalizedY * Math.sin(offset),
    y: normalizedX * Math.sin(offset) + normalizedY * Math.cos(offset),
  }));
}

export function isPointInCyclopsVision(
  point: CavePoint,
  phase: FifthFloorPhase,
  cyclopsPosition: CavePoint = CYCLOPS_POSITION,
  facingAngle = CYCLOPS_FACING_ANGLE,
): boolean {
  if (phase !== "watching") return false;
  const dx = point.x - cyclopsPosition.x;
  const dy = point.y - cyclopsPosition.y;
  const distance = Math.hypot(dx, dy);
  if (distance > CYCLOPS_VIEW_DISTANCE) return false;
  const angle = Math.atan2(dy, dx);
  const difference = normalizeAngle(angle - facingAngle);
  return Math.abs(difference) <= CYCLOPS_VIEW_HALF_ANGLE;
}

export function isPointInCaveExit(point: CavePoint): boolean {
  return (
    point.x >= CAVE_EXIT.x &&
    point.x <= CAVE_EXIT.x + CAVE_EXIT.width &&
    point.y >= CAVE_EXIT.y &&
    point.y <= CAVE_EXIT.y + CAVE_EXIT.height
  );
}

export function doCaveBodiesOverlap(
  first: CavePoint,
  firstRadius: number,
  second: CavePoint,
  secondRadius: number,
): boolean {
  return (
    Math.hypot(first.x - second.x, first.y - second.y) <
    firstRadius + secondRadius
  );
}

export function isPointInCyclopsStrike(
  point: CavePoint,
  target: CavePoint,
  radius: number,
): boolean {
  return Math.hypot(point.x - target.x, point.y - target.y) <= radius;
}

export function sheepYieldTarget(
  sheep: CavePoint,
  approachingActor: CavePoint,
  preferClockwise: boolean,
  distance = 112,
): CavePoint {
  const towardSheepX = sheep.x - approachingActor.x;
  const towardSheepY = sheep.y - approachingActor.y;
  const length = Math.hypot(towardSheepX, towardSheepY);
  if (length === 0) {
    return { x: sheep.x, y: sheep.y + (preferClockwise ? distance : -distance) };
  }
  const normalX = towardSheepX / length;
  const normalY = towardSheepY / length;
  const side = preferClockwise ? 1 : -1;
  return {
    x: sheep.x + normalX * 34 - normalY * distance * side,
    y: sheep.y + normalY * 34 + normalX * distance * side,
  };
}

export function sheepTransitTarget(
  sheep: CavePoint,
  destination: CavePoint,
  index: number,
  direction: "out" | "in" = "out",
): CavePoint {
  const passageY = 670 + (index % 5) * 34;
  if (direction === "out") {
    if (sheep.x < 1638) return { x: 1650, y: passageY };
    if (sheep.x < 2038) return { x: 2050, y: passageY };
    if (sheep.x < 2308) return { x: 2320, y: passageY };
    if (sheep.x < 2748) return { x: 2760, y: passageY };
    return destination;
  }
  if (sheep.x > 2762) return { x: 2750, y: passageY };
  if (sheep.x > 2322) return { x: 2310, y: passageY };
  if (sheep.x > 2052) return { x: 2040, y: passageY };
  if (sheep.x > 1652) return { x: 1640, y: passageY };
  return destination;
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
