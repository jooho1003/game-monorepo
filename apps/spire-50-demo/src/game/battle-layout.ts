export type BattleBiomeId = "forest" | "lava" | "glacier" | "ruins";

export interface BattlePalette {
  ground: number;
  groundAlt: number;
  secondaryGround: number;
  grid: number;
  edge: number;
  wall: number;
  wallEdge: number;
  accent: number;
  hazard: number;
  path: number;
  stone: number;
  water: number;
  waterLight: number;
}

export interface BattlePoint {
  x: number;
  y: number;
}

export interface BattleTerrainRegion {
  kind: "secondary" | "path" | "water" | "stone";
  points: readonly BattlePoint[];
}

export interface BattleBoundarySpec {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "cliff" | "ruin-wall";
}

export interface BattleObstacleSpec {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "tree" | "cactus" | "dead-tree" | "ruin" | "basalt" | "ice" | "pillar";
}

export interface BattleLayout {
  biome: BattleBiomeId;
  name: string;
  worldWidth: number;
  worldHeight: number;
  palette: BattlePalette;
  terrain: readonly BattleTerrainRegion[];
  boundaries: readonly BattleBoundarySpec[];
  obstacles: readonly BattleObstacleSpec[];
}

export interface FloorDifficulty {
  vitality: number;
  speed: number;
  damage: number;
  attackRate: number;
  enemyCount: number;
}

const BIOMES: readonly Omit<
  BattleLayout,
  "worldWidth" | "worldHeight" | "terrain" | "boundaries" | "obstacles"
>[] = [
  {
    biome: "forest",
    name: "영원의 녹원",
    palette: {
      ground: 0x3f8751,
      groundAlt: 0x327244,
      secondaryGround: 0xc88f61,
      grid: 0x74a767,
      edge: 0xa8cf79,
      wall: 0x6b4931,
      wallEdge: 0xa46f42,
      accent: 0x8acb60,
      hazard: 0xd1a06d,
      path: 0xb98253,
      stone: 0x7f8879,
      water: 0x2d719c,
      waterLight: 0x63b9cf,
    },
  },
  {
    biome: "lava",
    name: "잿불 제련 평원",
    palette: {
      ground: 0x4a342c,
      groundAlt: 0x382825,
      secondaryGround: 0x8c5840,
      grid: 0x744137,
      edge: 0xe09052,
      wall: 0x281b1a,
      wallEdge: 0x754437,
      accent: 0xff9a42,
      hazard: 0xe14d26,
      path: 0x765044,
      stone: 0x65544d,
      water: 0xb63f24,
      waterLight: 0xffa13d,
    },
  },
  {
    biome: "glacier",
    name: "월백 빙원",
    palette: {
      ground: 0x426978,
      groundAlt: 0x335765,
      secondaryGround: 0x88aeb5,
      grid: 0x5f8995,
      edge: 0xb9edf0,
      wall: 0x284552,
      wallEdge: 0x6d9da8,
      accent: 0x8fe8ef,
      hazard: 0x3b7184,
      path: 0x6d8d91,
      stone: 0x839fa4,
      water: 0x286989,
      waterLight: 0x7ad5e5,
    },
  },
  {
    biome: "ruins",
    name: "자색 왕실 평원",
    palette: {
      ground: 0x4b4058,
      groundAlt: 0x3b3349,
      secondaryGround: 0x8c6b69,
      grid: 0x65557b,
      edge: 0xc4a9e6,
      wall: 0x30283b,
      wallEdge: 0x766384,
      accent: 0xc398e8,
      hazard: 0x674878,
      path: 0x776168,
      stone: 0x777080,
      water: 0x4f3869,
      waterLight: 0xa36ed0,
    },
  },
];

export function getBattleLayout(floor: number): BattleLayout {
  const safeFloor = Math.max(1, Math.floor(floor));
  const biome = BIOMES[(safeFloor - 1) % BIOMES.length]!;
  return {
    ...biome,
    // Every regular combat floor uses the same 3:2 world footprint so the
    // authored full-map art is never cropped, repeated, or stretched between
    // floors. Only the visual theme and combat pressure change.
    worldWidth: 2400,
    worldHeight: 1600,
    terrain: [],
    boundaries: [],
    obstacles: [],
  };
}

export function getFloorDifficulty(floor: number): FloorDifficulty {
  const step = Math.max(0, Math.floor(floor) - 1);
  return {
    vitality: 1 + step * 0.16,
    speed: Math.min(1.75, 1 + step * 0.035),
    damage: 1 + step * 0.09,
    attackRate: Math.min(1.7, 1 + step * 0.04),
    enemyCount: 6 + Math.min(24, step),
  };
}

export function getBattleEnemySpawnPoint(
  floor: number,
  index: number,
  enemyCount: number,
): BattlePoint {
  const safeCount = Math.max(1, Math.floor(enemyCount));
  const safeIndex = Math.max(0, Math.floor(index));
  const columns = Math.min(6, Math.ceil(Math.sqrt(safeCount * 1.5)));
  const rows = Math.ceil(safeCount / columns);
  const column = safeIndex % columns;
  const row = Math.floor(safeIndex / columns);
  const normalizedX = columns === 1 ? 0.5 : column / (columns - 1);
  const normalizedY = rows === 1 ? 0.5 : row / (rows - 1);
  const jitterX = ((((safeIndex + 1) * 37 + floor * 17) % 11) - 5) * 0.004;
  const jitterY = ((((safeIndex + 1) * 29 + floor * 13) % 9) - 4) * 0.004;

  return {
    x: Math.min(0.9, Math.max(0.1, 0.12 + normalizedX * 0.76 + jitterX)),
    y: Math.min(0.84, Math.max(0.12, 0.14 + normalizedY * 0.68 + jitterY)),
  };
}
