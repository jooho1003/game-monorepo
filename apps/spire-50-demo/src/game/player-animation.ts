import type { WeaponId } from "../domain/model.js";

export type PlayerDirection =
  | "north"
  | "north-east"
  | "east"
  | "south-east"
  | "south"
  | "south-west"
  | "west"
  | "north-west";

export const PLAYER_DIRECTIONS: readonly PlayerDirection[] = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
];

export interface PlayerTextureFrame {
  key: string;
  flipX: boolean;
}

const MIRRORED_DIRECTION: Partial<Record<PlayerDirection, PlayerDirection>> = {
  west: "east",
  "north-west": "north-east",
  "south-west": "south-east",
};

export function playerActionTextureKey(
  action: "attack" | "skill",
  weaponId: WeaponId,
  direction: PlayerDirection,
  frame: number,
): string {
  return `player-${action}-${weaponId}-${direction}-${frame}`;
}

export function playerActionTextureFrame(
  action: "attack" | "skill",
  weaponId: WeaponId,
  direction: PlayerDirection,
  frame: number,
): PlayerTextureFrame {
  const sourceDirection =
    action === "skill"
      ? (MIRRORED_DIRECTION[direction] ?? direction)
      : direction;
  return {
    key: playerActionTextureKey(action, weaponId, sourceDirection, frame),
    flipX: sourceDirection !== direction,
  };
}

export function playerStanceTextureFrame(
  weaponId: WeaponId,
  direction: PlayerDirection,
  frame: number,
): PlayerTextureFrame {
  const sourceDirection = MIRRORED_DIRECTION[direction] ?? direction;
  return {
    key: `player-stance-${weaponId}-${sourceDirection}-${frame}`,
    flipX: sourceDirection !== direction,
  };
}

export function playerWalkTextureFrame(
  direction: PlayerDirection,
  frame: number,
): PlayerTextureFrame {
  const sourceDirection = MIRRORED_DIRECTION[direction] ?? direction;
  return {
    key: `player-walk-${sourceDirection}-${frame}`,
    flipX: sourceDirection !== direction,
  };
}

export function playerLocomotionTextureFrame(
  weaponId: WeaponId,
  direction: PlayerDirection,
  frame: number,
): PlayerTextureFrame {
  return playerStanceTextureFrame(weaponId, direction, frame);
}

export function directionFromAxes(
  xAxis: number,
  yAxis: number,
  fallback: PlayerDirection,
): PlayerDirection {
  if (xAxis === 0 && yAxis === 0) return fallback;
  if (yAxis < 0) {
    if (xAxis < 0) return "north-west";
    if (xAxis > 0) return "north-east";
    return "north";
  }
  if (yAxis > 0) {
    if (xAxis < 0) return "south-west";
    if (xAxis > 0) return "south-east";
    return "south";
  }
  return xAxis < 0 ? "west" : "east";
}

export function directionFromAngle(angle: number): PlayerDirection {
  const octant = Math.round(angle / (Math.PI / 4));
  const directions: readonly PlayerDirection[] = [
    "east",
    "south-east",
    "south",
    "south-west",
    "west",
    "north-west",
    "north",
    "north-east",
  ];
  return directions[(octant + 8) % 8]!;
}
