export interface RestRectangleSpec {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const REST_MOVEMENT_BOUNDS = {
  x: 140,
  y: 214,
  width: 652,
  height: 506,
} as const;

export const REST_STRUCTURE_COLLIDERS: readonly RestRectangleSpec[] = [
  { id: "pillar-north-west", x: 218, y: 294, width: 58, height: 94 },
  { id: "pillar-north-center", x: 406, y: 284, width: 62, height: 96 },
  { id: "pillar-north-east", x: 660, y: 284, width: 62, height: 96 },
  { id: "pillar-south-west", x: 217, y: 449, width: 62, height: 98 },
  { id: "pillar-south-center", x: 406, y: 449, width: 62, height: 98 },
  { id: "pillar-south-east", x: 660, y: 449, width: 62, height: 98 },
  { id: "north-chest-stack", x: 526, y: 179, width: 98, height: 76 },
  { id: "south-crate-stack", x: 278, y: 612, width: 132, height: 82 },
  { id: "west-crate-stack", x: 96, y: 562, width: 108, height: 116 },
] as const;

export const REST_PORTAL_POSITIONS = {
  battle: { x: 566, y: 398 },
  shop: { x: 157, y: 398 },
} as const;
