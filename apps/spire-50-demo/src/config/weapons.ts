import type { WeaponId } from "../domain/model.js";

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  icon: string;
  trait: string;
  skill: string;
  accent: string;
}

export const weaponDefinitions: readonly WeaponDefinition[] = [
  {
    id: "longsword",
    name: "장검",
    icon: "⚔",
    trait: "넓고 안정적인 전방 베기",
    skill: "반월참",
    accent: "#8ce6d0",
  },
  {
    id: "dagger",
    name: "단검",
    icon: "◢",
    trait: "빠른 연속 공격과 기동성",
    skill: "그림자 돌진",
    accent: "#df9df3",
  },
  {
    id: "shield",
    name: "방패",
    icon: "⬟",
    trait: "피해를 버티며 밀쳐내기",
    skill: "수호 충격",
    accent: "#f0c97b",
  },
  {
    id: "bow",
    name: "활",
    icon: "➶",
    trait: "거리를 유지하는 직선 사격",
    skill: "세 갈래 사격",
    accent: "#a9db7e",
  },
  {
    id: "staff",
    name: "지팡이",
    icon: "✦",
    trait: "마력으로 전장을 제어",
    skill: "별비",
    accent: "#87b9ff",
  },
] as const;

export function getWeaponDefinition(id: WeaponId): WeaponDefinition {
  return (
    weaponDefinitions.find((weapon) => weapon.id === id) ??
    weaponDefinitions[0]!
  );
}
