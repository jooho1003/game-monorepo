import { describe, expect, it } from "vitest";
import {
  ALLY_SPAWNS,
  BEACH_REGION,
  BEACH_REST_GATE_POSITION,
  CAVE_EXIT,
  CAVE_GATE_COLLIDER,
  CAVE_PLAYER_SPAWN,
  CAVE_STRUCTURE_COLLIDERS,
  CYCLOPS_DISPLAY_SIZE,
  CYCLOPS_BLINDED_GUARD_RANGE,
  CYCLOPS_GATE_GUARD_RANGE,
  CYCLOPS_POSITION,
  cyclopsGuardAttackProfile,
  doCaveBodiesOverlap,
  PLAYER_DISPLAY_SIZE,
  SHEEP_INSIDE_SPAWNS,
  SHEEP_OUTSIDE_SPAWNS,
  isPointInCaveExit,
  isPointInCyclopsStrike,
  isPointInCyclopsGuardRange,
  isPointInCyclopsVision,
  movementAvoidanceCandidates,
  missionShoveTarget,
  sheepYieldTarget,
  sheepTransitTarget,
} from "./fifth-floor-layout.js";

describe("fifth-floor cave layout", () => {
  it("contains one giant, fifteen allies, and twenty sheep", () => {
    expect(ALLY_SPAWNS).toHaveLength(15);
    expect(SHEEP_INSIDE_SPAWNS).toHaveLength(20);
    expect(CYCLOPS_DISPLAY_SIZE).toBe(PLAYER_DISPLAY_SIZE * 6);
    expect(CYCLOPS_POSITION.x).toBeGreaterThan(CAVE_PLAYER_SPAWN.x);
    expect(ALLY_SPAWNS.every((point) => point.x < 600)).toBe(true);
    expect(ALLY_SPAWNS.every((point) => point.y < CAVE_PLAYER_SPAWN.y)).toBe(
      true,
    );
    for (let first = 0; first < ALLY_SPAWNS.length; first += 1) {
      for (let second = first + 1; second < ALLY_SPAWNS.length; second += 1) {
        expect(
          Math.hypot(
            ALLY_SPAWNS[first]!.x - ALLY_SPAWNS[second]!.x,
            ALLY_SPAWNS[first]!.y - ALLY_SPAWNS[second]!.y,
          ),
        ).toBeGreaterThanOrEqual(50);
      }
    }
    expect(
      [...SHEEP_INSIDE_SPAWNS, ...SHEEP_OUTSIDE_SPAWNS].every(
        (point) =>
          !CAVE_STRUCTURE_COLLIDERS.some(
            (rect) =>
              point.x + 16 > rect.x &&
              point.x - 16 < rect.x + rect.width &&
              point.y + 11 > rect.y &&
              point.y - 5 < rect.y + rect.height,
          ),
      ),
    ).toBe(true);
  });

  it("places the stone door in front of the exit", () => {
    expect(CAVE_GATE_COLLIDER.x).toBeLessThan(CAVE_EXIT.x);
    expect(isPointInCaveExit({ x: CAVE_EXIT.x + 10, y: 800 })).toBe(true);
    expect(isPointInCaveExit(CAVE_PLAYER_SPAWN)).toBe(false);
  });

  it("seals the cave-to-beach wall everywhere except the rock-door opening", () => {
    const blockedByStructure = (x: number, y: number) =>
      CAVE_STRUCTURE_COLLIDERS.some(
        (rect) =>
          x >= rect.x &&
          x <= rect.x + rect.width &&
          y >= rect.y &&
          y <= rect.y + rect.height,
      );
    expect(blockedByStructure(2500, 400)).toBe(true);
    expect(blockedByStructure(2500, 1200)).toBe(true);
    expect(blockedByStructure(2500, 800)).toBe(false);
    expect(
      2500 >= CAVE_GATE_COLLIDER.x &&
        2500 <= CAVE_GATE_COLLIDER.x + CAVE_GATE_COLLIDER.width &&
        800 >= CAVE_GATE_COLLIDER.y &&
        800 <= CAVE_GATE_COLLIDER.y + CAVE_GATE_COLLIDER.height,
    ).toBe(true);
  });

  it("extends the cave exit into a separate beach with a rest gate", () => {
    expect(BEACH_REGION.x).toBeGreaterThan(CAVE_EXIT.x + CAVE_EXIT.width);
    expect(BEACH_REST_GATE_POSITION.x).toBeGreaterThan(BEACH_REGION.x);
    expect(SHEEP_INSIDE_SPAWNS.every((point) => point.x < BEACH_REGION.x)).toBe(
      true,
    );
  });

  it("detects only awake targets inside the limited vision cone", () => {
    expect(isPointInCyclopsVision({ x: 1700, y: 800 }, "watching")).toBe(true);
    expect(isPointInCyclopsVision({ x: 1700, y: 800 }, "sleeping")).toBe(false);
    expect(isPointInCyclopsVision({ x: 2160, y: 1300 }, "watching")).toBe(
      false,
    );
    expect(isPointInCyclopsVision({ x: 900, y: 800 }, "watching")).toBe(false);
    expect(
      isPointInCyclopsVision(
        { x: 1200, y: 800 },
        "watching",
        { x: 900, y: 800 },
        0,
      ),
    ).toBe(true);
  });

  it("damages only targets that remain inside the telegraphed strike", () => {
    const target = { x: 600, y: 500 };
    expect(isPointInCyclopsStrike({ x: 650, y: 500 }, target, 82)).toBe(true);
    expect(isPointInCyclopsStrike({ x: 683, y: 500 }, target, 82)).toBe(false);
  });

  it("shrinks the gate guard attack dramatically after the eye is hit", () => {
    const normal = cyclopsGuardAttackProfile(false);
    const blinded = cyclopsGuardAttackProfile(true);
    expect(normal.detectionRange).toBe(CYCLOPS_GATE_GUARD_RANGE);
    expect(blinded.detectionRange).toBe(CYCLOPS_BLINDED_GUARD_RANGE);
    expect(blinded.detectionRange).toBeLessThan(normal.detectionRange / 3);
    expect(blinded.strikeRadius).toBeLessThan(normal.strikeRadius / 2);
    expect(isPointInCyclopsGuardRange({ x: 500, y: 0 }, { x: 0, y: 0 }, false)).toBe(true);
    expect(isPointInCyclopsGuardRange({ x: 500, y: 0 }, { x: 0, y: 0 }, true)).toBe(false);
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
    expect(clockwise).toHaveLength(7);
    expect(clockwise[0]).toEqual({ x: 1, y: 0 });
    expect(clockwise[1]!.y).toBeGreaterThan(0);
    expect(counterClockwise[1]!.y).toBeLessThan(0);
  });

  it("moves sheep sideways when a character approaches", () => {
    const clockwise = sheepYieldTarget(
      { x: 100, y: 100 },
      { x: 40, y: 100 },
      true,
    );
    const counterClockwise = sheepYieldTarget(
      { x: 100, y: 100 },
      { x: 40, y: 100 },
      false,
    );
    expect(clockwise.x).toBeGreaterThan(100);
    expect(clockwise.y).toBeGreaterThan(100);
    expect(counterClockwise.y).toBeLessThan(100);
  });

  it("routes every sheep through the open rock-door passage", () => {
    const approach = sheepTransitTarget(
      { x: 1600, y: 400 },
      { x: 3200, y: 400 },
      4,
    );
    const crossing = sheepTransitTarget(
      { x: 2400, y: 400 },
      { x: 3200, y: 400 },
      4,
    );
    const returning = sheepTransitTarget(
      { x: 3000, y: 400 },
      { x: 1200, y: 400 },
      4,
      "in",
    );
    expect(approach.x).toBeLessThan(CAVE_GATE_COLLIDER.x);
    expect(crossing.x).toBeGreaterThan(
      CAVE_GATE_COLLIDER.x + CAVE_GATE_COLLIDER.width,
    );
    expect(approach.y).toBeGreaterThan(CAVE_GATE_COLLIDER.y);
    expect(approach.y).toBeLessThan(
      CAVE_GATE_COLLIDER.y + CAVE_GATE_COLLIDER.height,
    );
    expect(returning.x).toBeGreaterThan(
      CAVE_GATE_COLLIDER.x + CAVE_GATE_COLLIDER.width,
    );
    expect(returning.x).toBeLessThan(3000);
  });

  it("pushes a mission actor directly away from the player", () => {
    expect(
      missionShoveTarget({ x: 100, y: 100 }, { x: 140, y: 100 }, 0, 80),
    ).toEqual({ x: 220, y: 100 });
    const overlap = missionShoveTarget(
      { x: 100, y: 100 },
      { x: 100, y: 100 },
      Math.PI / 2,
      60,
    );
    expect(overlap.x).toBeCloseTo(100);
    expect(overlap.y).toBeCloseTo(160);
  });
});
