import type { WeaponId } from "../domain/model.js";

export interface WeaponCombatProfile {
  cooldown: number;
  range: number;
  damage: number;
  color: number;
  /** Half-width or radius of the damaging shape, before target body radius. */
  hitRadius: number;
  /** Basic-attack cone half-angle. Used only by the longsword. */
  halfAngle?: number;
}

export const WEAPON_COMBAT: Readonly<Record<WeaponId, WeaponCombatProfile>> = {
  longsword: {
    cooldown: 410,
    range: 118,
    damage: 29,
    color: 0xe9f4ee,
    hitRadius: 0,
    halfAngle: 0.68,
  },
  dagger: {
    cooldown: 230,
    range: 92,
    damage: 18,
    color: 0xe2a5f4,
    hitRadius: 12,
  },
  shield: {
    cooldown: 560,
    range: 72,
    damage: 22,
    color: 0xf2cb76,
    hitRadius: 56,
  },
  bow: {
    cooldown: 510,
    range: 390,
    damage: 26,
    color: 0xa8df78,
    hitRadius: 11,
  },
  staff: {
    cooldown: 640,
    range: 300,
    damage: 31,
    color: 0x84baff,
    hitRadius: 58,
  },
};

export interface CircleTarget {
  x: number;
  y: number;
  radius: number;
}

export function circleHitsCircle(
  target: CircleTarget,
  attackX: number,
  attackY: number,
  attackRadius: number,
): boolean {
  return (
    Math.hypot(target.x - attackX, target.y - attackY) <=
    attackRadius + target.radius
  );
}

export function circleHitsSegment(
  target: CircleTarget,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  attackHalfWidth: number,
): boolean {
  return (
    distanceToSegment(target.x, target.y, startX, startY, endX, endY) <=
    attackHalfWidth + target.radius
  );
}

export function circleHitsCone(
  target: CircleTarget,
  originX: number,
  originY: number,
  angle: number,
  range: number,
  halfAngle: number,
): boolean {
  const deltaX = target.x - originX;
  const deltaY = target.y - originY;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance > range + target.radius) return false;
  if (distance <= target.radius) return true;

  const targetAngle = Math.atan2(deltaY, deltaX);
  const angularRadius = Math.asin(Math.min(1, target.radius / distance));
  return Math.abs(wrapAngle(targetAngle - angle)) <= halfAngle + angularRadius;
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
  if (lengthSquared === 0) return Math.hypot(pointX - startX, pointY - startY);
  const projection = Math.max(
    0,
    Math.min(
      1,
      ((pointX - startX) * segmentX + (pointY - startY) * segmentY) /
        lengthSquared,
    ),
  );
  return Math.hypot(
    pointX - (startX + segmentX * projection),
    pointY - (startY + segmentY * projection),
  );
}

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
