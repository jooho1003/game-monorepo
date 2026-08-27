export interface RestRectangleSpec {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const REST_MAP_NATIVE_SIZE = { width: 808, height: 455 } as const;
const REST_MAP_RENDER_SIZE = { width: 1280, height: 720 } as const;

function scaleMapRectangle(
  rectangle: RestRectangleSpec,
): RestRectangleSpec {
  const scaleX = REST_MAP_RENDER_SIZE.width / REST_MAP_NATIVE_SIZE.width;
  const scaleY = REST_MAP_RENDER_SIZE.height / REST_MAP_NATIVE_SIZE.height;
  return {
    id: rectangle.id,
    x: Math.round(rectangle.x * scaleX),
    y: Math.round(rectangle.y * scaleY),
    width: Math.round(rectangle.width * scaleX),
    height: Math.round(rectangle.height * scaleY),
  };
}

export const REST_MOVEMENT_BOUNDS = {
  x: 140,
  y: 214,
  width: 652,
  height: 506,
} as const;

// Bounds are traced against first-floor-center.png in its native 808 x 455
// pixels, then scaled to the 1280 x 720 game canvas. Keep furniture separate:
// merging nearby props creates rectangular collision over visibly empty floor.
const REST_STRUCTURE_BOUNDS_IN_MAP_PIXELS: readonly RestRectangleSpec[] = [
  { id: "pillar-north-west", x: 145, y: 210, width: 24, height: 55 },
  { id: "pillar-north-center", x: 264, y: 180, width: 23, height: 54 },
  { id: "pillar-north-east", x: 427, y: 180, width: 23, height: 54 },
  { id: "pillar-south-west", x: 145, y: 282, width: 24, height: 54 },
  { id: "pillar-south-center", x: 264, y: 321, width: 23, height: 53 },
  { id: "pillar-south-east", x: 427, y: 321, width: 23, height: 53 },
  { id: "north-bench", x: 338, y: 116, width: 45, height: 34 },
  { id: "north-chest", x: 306, y: 149, width: 20, height: 30 },
  { id: "west-chair", x: 112, y: 327, width: 34, height: 31 },
  { id: "south-crate-stack", x: 184, y: 392, width: 46, height: 37 },
] as const;

export const REST_STRUCTURE_COLLIDERS: readonly RestRectangleSpec[] =
  REST_STRUCTURE_BOUNDS_IN_MAP_PIXELS.map(scaleMapRectangle);

export const REST_PORTAL_POSITIONS = {
  battle: { x: 566, y: 398 },
  shop: { x: 157, y: 398 },
} as const;
