import type { WeaponId } from "../domain/model.js";

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  englishName: string;
  icon: string;
  image: string;
  characterImage: string;
  characterScale: number;
  characterOffsetY: string;
  role: string;
  description: string;
  trait: string;
  skill: string;
  skillIcon: string;
  skillDescription: string;
  skillEffect: string;
  accent: string;
  stats: {
    attack: number;
    speed: number;
    defense: number;
  };
}

export const weaponDefinitions: readonly WeaponDefinition[] = [
  {
    id: "longsword",
    name: "장검",
    englishName: "LONGSWORD",
    icon: "⚔",
    image: "/assets/loadout/weapons/longsword.png",
    characterImage: "/assets/loadout/characters/ern-longsword.png",
    characterScale: 1,
    characterOffsetY: "0%",
    role: "균형형 검객",
    description:
      "공격 범위와 기동성의 균형이 좋은 무기입니다. 처음 탑에 오르는 도전자에게 가장 안정적인 선택입니다.",
    trait: "넓고 안정적인 전방 베기",
    skill: "반월참",
    skillIcon: "/assets/game/hud/skills/longsword-v1.png",
    skillDescription:
      "커서 방향 전방을 크게 두 번 베어 넓은 범위의 적을 밀어냅니다.",
    skillEffect: "전방 부채꼴 2연격 · 피해 34 × 2 · MP 25",
    accent: "#8ce6d0",
    stats: { attack: 78, speed: 56, defense: 48 },
  },
  {
    id: "dagger",
    name: "단검",
    englishName: "DAGGER",
    icon: "◢",
    image: "/assets/loadout/weapons/dagger.png",
    characterImage: "/assets/loadout/characters/ern-dagger.png",
    characterScale: 0.98,
    characterOffsetY: "3.1%",
    role: "고속 기습자",
    description:
      "짧은 공격 범위를 빠른 연속 공격과 회피 기동으로 보완합니다. 적의 빈틈을 파고드는 전투에 적합합니다.",
    trait: "빠른 연속 공격과 기동성",
    skill: "그림자 돌진",
    skillIcon: "/assets/game/hud/skills/dagger-v1.png",
    skillDescription:
      "그림자처럼 전진하며 경로상의 적을 관통하고 도착 지점에서 베어냅니다.",
    skillEffect: "전방 관통 돌진 · 피해 56 · MP 25",
    accent: "#df9df3",
    stats: { attack: 61, speed: 92, defense: 28 },
  },
  {
    id: "shield",
    name: "방패",
    englishName: "SHIELD",
    icon: "⬟",
    image: "/assets/loadout/weapons/shield.png",
    characterImage: "/assets/loadout/characters/ern-shield.png",
    characterScale: 1.01,
    characterOffsetY: "3.9%",
    role: "수호 전위",
    description:
      "적의 공격을 견디고 충격으로 거리를 만듭니다. 느리지만 생존력이 높아 안전한 공략이 가능합니다.",
    trait: "피해를 버티며 밀쳐내기",
    skill: "수호 충격",
    skillIcon: "/assets/game/hud/skills/shield-v1.png",
    skillDescription:
      "방패에 힘을 모아 전방에 충격파를 내보내고 적의 접근을 끊습니다.",
    skillEffect: "전방 충격파 · 피해 30 · 강한 밀쳐내기 · MP 25",
    accent: "#f0c97b",
    stats: { attack: 42, speed: 31, defense: 94 },
  },
  {
    id: "bow",
    name: "활",
    englishName: "BOW",
    icon: "➶",
    image: "/assets/loadout/weapons/bow.png",
    characterImage: "/assets/loadout/characters/ern-bow.png",
    characterScale: 0.99,
    characterOffsetY: "4.3%",
    role: "원거리 사수",
    description:
      "안전한 거리에서 적을 조준하고 전투의 흐름을 통제합니다. 위치 선정과 정확한 사격이 중요합니다.",
    trait: "거리를 유지하는 직선 사격",
    skill: "세 갈래 사격",
    skillIcon: "/assets/game/hud/skills/bow-v1.png",
    skillDescription:
      "커서 방향을 중심으로 세 발의 화살을 부채꼴로 동시에 발사합니다.",
    skillEffect: "3방향 화살 · 화살당 피해 28 · MP 25",
    accent: "#a9db7e",
    stats: { attack: 72, speed: 74, defense: 32 },
  },
  {
    id: "staff",
    name: "지팡이",
    englishName: "STAFF",
    icon: "✦",
    image: "/assets/loadout/weapons/staff.png",
    characterImage: "/assets/loadout/characters/ern-staff.png",
    characterScale: 1,
    characterOffsetY: "1.7%",
    role: "마력 조율사",
    description:
      "마력 투사체와 범위 기술로 다수의 적을 제어합니다. 강력한 대신 마력 관리가 필요합니다.",
    trait: "마력으로 전장을 제어",
    skill: "별비",
    skillIcon: "/assets/game/hud/skills/staff-v1.png",
    skillDescription:
      "지정 방향의 넓은 지역에 별빛을 연속 낙하시켜 적 무리를 제압합니다.",
    skillEffect: "범위 연속 낙하 · 총 피해 72 · MP 25",
    accent: "#87b9ff",
    stats: { attack: 88, speed: 43, defense: 35 },
  },
] as const;

export function getWeaponDefinition(id: WeaponId): WeaponDefinition {
  return (
    weaponDefinitions.find((weapon) => weapon.id === id) ??
    weaponDefinitions[0]!
  );
}
