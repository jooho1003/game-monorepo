import type { WeaponId } from "../domain/model.js";

export const SKILL2_MANA_COST = 35;
export const SKILL2_COOLDOWN_MS = 2_600;

export type Skill2Shape =
  | { kind: "radial"; radius: number; knockback: number }
  | {
      kind: "fan";
      range: number;
      spread: number;
      blades: number;
      width: number;
    }
  | { kind: "projectile"; range: number; blastRadius: number }
  | { kind: "beam"; range: number; width: number };

export interface Skill2Definition {
  name: string;
  description: string;
  effect: string;
  damage: number;
  poseDurationMs: number;
  shape: Skill2Shape;
}

export const SKILL2_DEFINITIONS: Record<WeaponId, Skill2Definition> = {
  longsword: {
    name: "회전 폭풍",
    description: "검기를 회오리처럼 둘러 주변의 모든 적을 베어냅니다.",
    effect: "주변 360° 회전 베기 · 피해 40 · MP 35",
    damage: 40,
    poseDurationMs: 560,
    shape: { kind: "radial", radius: 190, knockback: 46 },
  },
  dagger: {
    name: "환영 표창",
    description: "다섯 갈래의 환영 칼날을 부채꼴로 던져 관통시킵니다.",
    effect: "5갈래 관통 칼날 · 칼날당 피해 26 · MP 35",
    damage: 26,
    poseDurationMs: 420,
    shape: { kind: "fan", range: 260, spread: 0.36, blades: 5, width: 26 },
  },
  shield: {
    name: "대지 격동",
    description: "방패로 대지를 내리쳐 충격파로 주변 적을 날려버립니다.",
    effect: "주변 대지 강타 · 피해 34 · 매우 강한 밀쳐내기 · MP 35",
    damage: 34,
    poseDurationMs: 620,
    shape: { kind: "radial", radius: 205, knockback: 96 },
  },
  bow: {
    name: "폭발 화살",
    description: "마력을 응축한 화살이 명중 지점에서 폭발합니다.",
    effect: "관통 화살 + 착탄 폭발 · 피해 48 · MP 35",
    damage: 48,
    poseDurationMs: 520,
    shape: { kind: "projectile", range: 460, blastRadius: 120 },
  },
  staff: {
    name: "비전 광선",
    description: "응축한 비전 마력을 한 줄기 광선으로 방출합니다.",
    effect: "직선 관통 광선 · 피해 58 · MP 35",
    damage: 58,
    poseDurationMs: 760,
    shape: { kind: "beam", range: 420, width: 46 },
  },
};

export function skill2IconPath(weaponId: WeaponId): string {
  return `/assets/game/hud/skills/${weaponId}-skill2-v1.png`;
}

export function getSkill2Definition(weaponId: WeaponId): Skill2Definition {
  return SKILL2_DEFINITIONS[weaponId];
}
