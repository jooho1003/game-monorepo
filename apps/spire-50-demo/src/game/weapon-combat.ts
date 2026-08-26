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

export interface SecondSkillCombatProfile {
  cooldown: number;
  range: number;
  damage: number;
  hitRadius: number;
  knockback: number;
}

export const SECOND_SKILL_COMBAT: Readonly<
  Record<WeaponId, SecondSkillCombatProfile>
> = {
  longsword: {
    cooldown: 2200,
    range: 190,
    damage: 62,
    hitRadius: 34,
    knockback: 38,
  },
  dagger: {
    cooldown: 2000,
    range: 150,
    damage: 68,
    hitRadius: 78,
    knockback: 28,
  },
  shield: {
    cooldown: 2600,
    range: 96,
    damage: 52,
    hitRadius: 92,
    knockback: 76,
  },
  bow: {
    cooldown: 2600,
    range: 360,
    damage: 58,
    hitRadius: 92,
    knockback: 22,
  },
  staff: {
    cooldown: 2800,
    range: 330,
    damage: 64,
    hitRadius: 108,
    knockback: 30,
  },
};

export interface ThirdSkillCombatProfile {
  cooldown: number;
  range: number;
  damage: number;
  hitRadius: number;
  knockback: number;
  halfAngle?: number;
}

export const THIRD_SKILL_COMBAT: Readonly<
  Record<WeaponId, ThirdSkillCombatProfile>
> = {
  longsword: {
    cooldown: 3800,
    range: 220,
    damage: 86,
    hitRadius: 0,
    knockback: 62,
    halfAngle: 1.16,
  },
  dagger: {
    cooldown: 3400,
    range: 300,
    damage: 98,
    hitRadius: 38,
    knockback: 34,
  },
  shield: {
    cooldown: 4200,
    range: 126,
    damage: 74,
    hitRadius: 116,
    knockback: 108,
  },
  bow: {
    cooldown: 4000,
    range: 620,
    damage: 108,
    hitRadius: 24,
    knockback: 46,
  },
  staff: {
    cooldown: 4400,
    range: 520,
    damage: 94,
    hitRadius: 58,
    knockback: 40,
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
