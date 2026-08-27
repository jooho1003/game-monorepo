import { describe, expect, it } from "vitest";
import {
  REST_MOVEMENT_BOUNDS,
  REST_PORTAL_POSITIONS,
  REST_STRUCTURE_COLLIDERS,
} from "./rest-layout.js";

function containsPoint(
  rectangle: (typeof REST_STRUCTURE_COLLIDERS)[number],
  point: { x: number; y: number },
): boolean {
  return (
    point.x >= rectangle.x &&
    point.x <= rectangle.x + rectangle.width &&
    point.y >= rectangle.y &&
    point.y <= rectangle.y + rectangle.height
  );
}

function isBlocked(point: { x: number; y: number }): boolean {
  return REST_STRUCTURE_COLLIDERS.some((rectangle) =>
    containsPoint(rectangle, point),
  );
}

describe("rest-area structure collision", () => {
  it("recognizes all six visible pillars", () => {
    expect(
      REST_STRUCTURE_COLLIDERS.filter(({ id }) => id.startsWith("pillar")),
    ).toHaveLength(6);
  });

  it("matches the visible furniture instead of merging empty floor into it", () => {
    expect(REST_STRUCTURE_COLLIDERS.map(({ id }) => id)).toEqual([
      "pillar-north-west",
      "pillar-north-center",
      "pillar-north-east",
      "pillar-south-west",
      "pillar-south-center",
      "pillar-south-east",
      "north-bench",
      "north-chest",
      "west-chair",
      "south-crate-stack",
    ]);

    expect(isBlocked({ x: 205, y: 540 })).toBe(true);
    expect(isBlocked({ x: 326, y: 650 })).toBe(true);
    expect(isBlocked({ x: 165, y: 620 })).toBe(false);
  });

  it("places the staggered pillars at their actual map heights", () => {
    expect(isBlocked({ x: 245, y: 305 })).toBe(false);
    expect(isBlocked({ x: 245, y: 360 })).toBe(true);
    expect(isBlocked({ x: 430, y: 470 })).toBe(false);
    expect(isBlocked({ x: 430, y: 570 })).toBe(true);
  });

  it("keeps both portal interaction centers clear of structures", () => {
    for (const portal of Object.values(REST_PORTAL_POSITIONS)) {
      expect(
        REST_STRUCTURE_COLLIDERS.some((rectangle) =>
          containsPoint(rectangle, portal),
        ),
      ).toBe(false);
      expect(portal.x).toBeGreaterThanOrEqual(REST_MOVEMENT_BOUNDS.x);
      expect(portal.x).toBeLessThanOrEqual(
        REST_MOVEMENT_BOUNDS.x + REST_MOVEMENT_BOUNDS.width,
      );
    }
  });
});
