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
export const CYCLOPS_FACING_ANGLE = Math.PI;
export const CYCLOPS_VIEW_DISTANCE = 720;
export const CYCLOPS_VIEW_HALF_ANGLE = Math.PI / 5.2;
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

export const CAVE_OBSTACLES: readonly CaveRectangle[] = [
  { x: 700, y: 250, width: 190, height: 120 },
  { x: 880, y: 1180, width: 230, height: 120 },
  { x: 1320, y: 220, width: 160, height: 110 },
  { x: 1390, y: 1260, width: 240, height: 105 },
  { x: 1740, y: 330, width: 170, height: 120 },
  { x: 1780, y: 1130, width: 180, height: 130 },
] as const;

export const ALLY_SPAWNS: readonly CavePoint[] = Array.from(
  { length: 15 },
  (_, index) => ({
    x: 650 + (index % 5) * 126 + (Math.floor(index / 5) % 2) * 34,
    y: 545 + Math.floor(index / 5) * 138,
  }),
);

export const SHEEP_INSIDE_SPAWNS: readonly CavePoint[] = Array.from(
  { length: 20 },
  (_, index) => ({
    x: 1230 + (index % 5) * 126 + (Math.floor(index / 5) % 2) * 28,
    y: 510 + Math.floor(index / 5) * 132,
  }),
);

export const SHEEP_OUTSIDE_SPAWNS: readonly CavePoint[] = Array.from(
  { length: 20 },
  (_, index) => ({
    x: 3020 + (index % 5) * 112 + (Math.floor(index / 5) % 2) * 30,
    y: 555 + Math.floor(index / 5) * 145,
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
  const offsets = [0, side * Math.PI / 4, -side * Math.PI / 4, side * Math.PI / 2, -side * Math.PI / 2];
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
  return Math.hypot(first.x - second.x, first.y - second.y) <
    firstRadius + secondRadius;
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
