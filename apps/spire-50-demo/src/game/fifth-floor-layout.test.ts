import { describe, expect, it } from "vitest";
import {
  ALLY_SPAWNS,
  BEACH_REGION,
  BEACH_REST_GATE_POSITION,
  CAVE_EXIT,
  CAVE_GATE_COLLIDER,
  CAVE_PLAYER_SPAWN,
  CYCLOPS_DISPLAY_SIZE,
  CYCLOPS_POSITION,
  doCaveBodiesOverlap,
  PLAYER_DISPLAY_SIZE,
  SHEEP_INSIDE_SPAWNS,
  isPointInCaveExit,
  isPointInCyclopsVision,
  movementAvoidanceCandidates,
} from "./fifth-floor-layout.js";

describe("fifth-floor cave layout", () => {
  it("contains one giant, fifteen allies, and twenty sheep", () => {
    expect(ALLY_SPAWNS).toHaveLength(15);
    expect(SHEEP_INSIDE_SPAWNS).toHaveLength(20);
    expect(CYCLOPS_DISPLAY_SIZE).toBe(PLAYER_DISPLAY_SIZE * 6);
    expect(CYCLOPS_POSITION.x).toBeGreaterThan(CAVE_PLAYER_SPAWN.x);
  });

  it("places the stone door in front of the exit", () => {
    expect(CAVE_GATE_COLLIDER.x).toBeLessThan(CAVE_EXIT.x);
    expect(isPointInCaveExit({ x: CAVE_EXIT.x + 10, y: 800 })).toBe(true);
    expect(isPointInCaveExit(CAVE_PLAYER_SPAWN)).toBe(false);
  });

  it("extends the cave exit into a separate beach with a rest gate", () => {
    expect(BEACH_REGION.x).toBeGreaterThan(CAVE_EXIT.x + CAVE_EXIT.width);
    expect(BEACH_REST_GATE_POSITION.x).toBeGreaterThan(BEACH_REGION.x);
    expect(SHEEP_INSIDE_SPAWNS.every((point) => point.x < BEACH_REGION.x)).toBe(
      true,
    );
  });

  it("detects only awake targets inside the limited vision cone", () => {
    expect(isPointInCyclopsVision({ x: 1700, y: 800 }, "watching")).toBe(
      true,
    );
    expect(isPointInCyclopsVision({ x: 1700, y: 800 }, "sleeping")).toBe(
      false,
    );
    expect(isPointInCyclopsVision({ x: 2160, y: 1300 }, "watching")).toBe(
      false,
    );
    expect(isPointInCyclopsVision({ x: 900, y: 800 }, "watching")).toBe(
      false,
    );
    expect(
      isPointInCyclopsVision(
        { x: 1200, y: 800 },
        "watching",
        { x: 900, y: 800 },
        0,
      ),
    ).toBe(true);
  });

  it("treats mission actors as separate solid bodies without rejecting tangency", () => {
    expect(
      doCaveBodiesOverlap({ x: 100, y: 100 }, 25, { x: 140, y: 100 }, 22),
    ).toBe(true);
    expect(
      doCaveBodiesOverlap({ x: 100, y: 100 }, 25, { x: 147, y: 100 }, 22),
    ).toBe(false);
  });

  it("offers deterministic left and right detours when a walker is blocked", () => {
    const clockwise = movementAvoidanceCandidates(1, 0, true);
    const counterClockwise = movementAvoidanceCandidates(1, 0, false);
    expect(clockwise).toHaveLength(5);
    expect(clockwise[0]).toEqual({ x: 1, y: 0 });
    expect(clockwise[1]!.y).toBeGreaterThan(0);
    expect(counterClockwise[1]!.y).toBeLessThan(0);
  });
});
