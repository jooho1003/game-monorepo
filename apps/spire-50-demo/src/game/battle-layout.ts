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
  kind:
    | "tree"
    | "cactus"
    | "dead-tree"
    | "ruin"
    | "basalt"
    | "ice"
    | "pillar";
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
    name: "녹음과 사막의 경계",
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
    name: "잿빛 제련 경계",
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
    name: "빙설과 침수 유적",
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
    name: "자색 왕실의 황무지",
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
  const worldWidth = 2400 + ((safeFloor - 1) % 3) * 120;
  const worldHeight = 1500 + (safeFloor % 2) * 120;
  const variant = (safeFloor - 1) % BIOMES.length;
  return {
    ...biome,
    worldWidth,
    worldHeight,
    terrain: createTerrain(worldWidth, worldHeight, variant),
    boundaries: createBoundaries(worldWidth, worldHeight, variant),
    obstacles: createObstacles(worldWidth, worldHeight, biome.biome),
  };
}

function createTerrain(
  worldWidth: number,
  worldHeight: number,
  variant: number,
): BattleTerrainRegion[] {
  const seam = worldWidth * (0.56 + (variant % 2) * 0.025);
  const lowerLakeX = worldWidth * (variant % 2 === 0 ? 0.43 : 0.3);
  return [
    {
      kind: "secondary",
      points: [
        { x: seam, y: 76 },
        { x: seam + 90, y: worldHeight * 0.2 },
        { x: seam - 35, y: worldHeight * 0.36 },
        { x: seam + 105, y: worldHeight * 0.54 },
        { x: seam + 10, y: worldHeight * 0.7 },
        { x: seam + 145, y: worldHeight - 76 },
        { x: worldWidth - 76, y: worldHeight - 76 },
        { x: worldWidth - 76, y: 76 },
      ],
    },
    {
      kind: "path",
      points: [
        { x: worldWidth * 0.12, y: worldHeight * 0.28 },
        { x: worldWidth * 0.47, y: worldHeight * 0.25 },
        { x: worldWidth * 0.49, y: worldHeight * 0.34 },
        { x: worldWidth * 0.31, y: worldHeight * 0.38 },
        { x: worldWidth * 0.3, y: worldHeight * 0.64 },
        { x: worldWidth * 0.22, y: worldHeight * 0.68 },
        { x: worldWidth * 0.21, y: worldHeight * 0.43 },
        { x: worldWidth * 0.11, y: worldHeight * 0.39 },
      ],
    },
    {
      kind: "path",
      points: [
        { x: worldWidth * 0.3, y: worldHeight * 0.52 },
        { x: worldWidth * 0.57, y: worldHeight * 0.5 },
        { x: worldWidth * 0.59, y: worldHeight * 0.58 },
        { x: worldWidth * 0.31, y: worldHeight * 0.61 },
      ],
    },
    {
      kind: "water",
      points: [
        { x: 76, y: 76 },
        { x: worldWidth * 0.2, y: 76 },
        { x: worldWidth * 0.18, y: worldHeight * 0.18 },
        { x: worldWidth * 0.13, y: worldHeight * 0.24 },
        { x: 76, y: worldHeight * 0.2 },
      ],
    },
    {
      kind: "water",
      points: [
        { x: lowerLakeX, y: worldHeight * 0.73 },
        { x: lowerLakeX + worldWidth * 0.17, y: worldHeight * 0.7 },
        { x: lowerLakeX + worldWidth * 0.22, y: worldHeight - 76 },
        { x: lowerLakeX - worldWidth * 0.05, y: worldHeight - 76 },
        { x: lowerLakeX - worldWidth * 0.07, y: worldHeight * 0.82 },
      ],
    },
    {
      kind: "stone",
      points: [
        { x: worldWidth * 0.72, y: worldHeight * 0.18 },
        { x: worldWidth * 0.86, y: worldHeight * 0.18 },
        { x: worldWidth * 0.87, y: worldHeight * 0.32 },
        { x: worldWidth * 0.73, y: worldHeight * 0.33 },
      ],
    },
    {
      kind: "stone",
      points: [
        { x: worldWidth * 0.67, y: worldHeight * 0.63 },
        { x: worldWidth * 0.83, y: worldHeight * 0.61 },
        { x: worldWidth * 0.84, y: worldHeight * 0.76 },
        { x: worldWidth * 0.69, y: worldHeight * 0.77 },
      ],
    },
  ];
}

function createBoundaries(
  worldWidth: number,
  worldHeight: number,
  variant: number,
): BattleBoundarySpec[] {
  const seam = worldWidth * (0.56 + (variant % 2) * 0.025);
  return [
    { x: seam + 42, y: worldHeight * 0.2, width: 74, height: worldHeight * 0.2, kind: "cliff" },
    { x: seam + 16, y: worldHeight * 0.47, width: 74, height: worldHeight * 0.15, kind: "cliff" },
    { x: seam + 72, y: worldHeight * 0.75, width: 78, height: worldHeight * 0.18, kind: "cliff" },
    { x: worldWidth * 0.79, y: worldHeight * 0.18, width: worldWidth * 0.14, height: 34, kind: "ruin-wall" },
    { x: worldWidth * 0.72, y: worldHeight * 0.7, width: 32, height: worldHeight * 0.14, kind: "ruin-wall" },
  ];
}

function createObstacles(
  worldWidth: number,
  worldHeight: number,
  biome: BattleBiomeId,
): BattleObstacleSpec[] {
  const themed: Record<BattleBiomeId, BattleObstacleSpec["kind"][]> = {
    forest: ["tree", "ruin", "tree", "cactus", "dead-tree", "ruin"],
    lava: ["basalt", "ruin", "basalt", "dead-tree", "pillar", "basalt"],
    glacier: ["ice", "pillar", "ice", "ruin", "ice", "pillar"],
    ruins: ["pillar", "ruin", "dead-tree", "pillar", "ruin", "pillar"],
  };
  const kinds = themed[biome];
  const specs = [
    [0.16, 0.22, 150, 150],
    [0.35, 0.2, 184, 144],
    [0.44, 0.44, 138, 156],
    [0.71, 0.25, 104, 132],
    [0.89, 0.3, 132, 176],
    [0.76, 0.68, 186, 138],
    [0.18, 0.61, 128, 152],
    [0.38, 0.66, 148, 122],
    [0.9, 0.72, 122, 164],
  ] as const;
  return specs.map(([x, y, width, height], index) => ({
    x: worldWidth * x,
    y: worldHeight * y,
    width,
    height,
    kind: kinds[index % kinds.length]!,
  }));
}

export function getFloorDifficulty(floor: number): FloorDifficulty {
  const step = Math.max(0, Math.floor(floor) - 1);
  return {
    vitality: 1 + step * 0.16,
    speed: Math.min(1.75, 1 + step * 0.035),
    damage: 1 + step * 0.09,
    attackRate: Math.min(1.7, 1 + step * 0.04),
    enemyCount: 3 + Math.min(6, Math.floor(step / 2)),
  };
}
