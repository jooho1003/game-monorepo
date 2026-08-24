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

describe("rest-area structure collision", () => {
  it("recognizes all six visible pillars", () => {
    expect(
      REST_STRUCTURE_COLLIDERS.filter(({ id }) => id.startsWith("pillar")),
    ).toHaveLength(6);
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
