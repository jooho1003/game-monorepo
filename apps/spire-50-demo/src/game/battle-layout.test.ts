import { describe, expect, it } from "vitest";
import { getBattleLayout, getFloorDifficulty } from "./battle-layout.js";

describe("battle floor progression", () => {
  it("cycles through distinct forest, lava, glacier, and ruins maps", () => {
    expect([1, 2, 3, 4].map((floor) => getBattleLayout(floor).biome)).toEqual([
      "forest",
      "lava",
      "glacier",
      "ruins",
    ]);
    expect(getBattleLayout(1).worldWidth).toBeGreaterThan(1280);
    expect(getBattleLayout(1).worldHeight).toBeGreaterThan(720);
  });

  it("keeps every regular floor as one consistent obstacle-free 3:2 field", () => {
    for (const floor of [1, 2, 3, 4]) {
      const layout = getBattleLayout(floor);
      expect(layout.worldWidth).toBe(2400);
      expect(layout.worldHeight).toBe(1600);
      expect(layout.terrain).toEqual([]);
      expect(layout.boundaries).toEqual([]);
      expect(layout.obstacles).toEqual([]);
    }
  });

  it("raises every combat pressure metric on later floors", () => {
    const first = getFloorDifficulty(1);
    const fifth = getFloorDifficulty(5);
    expect(fifth.vitality).toBeGreaterThan(first.vitality);
    expect(fifth.speed).toBeGreaterThan(first.speed);
    expect(fifth.damage).toBeGreaterThan(first.damage);
    expect(fifth.attackRate).toBeGreaterThan(first.attackRate);
    expect(fifth.enemyCount).toBeGreaterThan(first.enemyCount);
  });
});
