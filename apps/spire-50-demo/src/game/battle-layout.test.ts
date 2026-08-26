import { describe, expect, it } from "vitest";
import {
  getBattleEnemySpawnPoint,
  getBattleLayout,
  getFloorDifficulty,
} from "./battle-layout.js";

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

  it("starts with twice as many enemies and keeps adding one per regular floor", () => {
    expect(getFloorDifficulty(1).enemyCount).toBe(6);
    expect(getFloorDifficulty(10).enemyCount).toBe(15);
    expect(getFloorDifficulty(25).enemyCount).toBe(30);
    expect(getFloorDifficulty(50).enemyCount).toBe(30);

    for (let floor = 1; floor <= 50; floor += 1) {
      const previousEnemyCount =
        3 + Math.min(6, Math.floor(Math.max(0, floor - 1) / 2));
      expect(getFloorDifficulty(floor).enemyCount).toBeGreaterThanOrEqual(
        previousEnemyCount * 2,
      );
    }
  });

  it("spreads a maximum-size enemy group across distinct arena positions", () => {
    const points = Array.from({ length: 30 }, (_, index) =>
      getBattleEnemySpawnPoint(25, index, 30),
    );

    expect(new Set(points.map(({ x, y }) => `${x}:${y}`)).size).toBe(30);
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(0.1);
      expect(point.x).toBeLessThanOrEqual(0.9);
      expect(point.y).toBeGreaterThanOrEqual(0.12);
      expect(point.y).toBeLessThanOrEqual(0.84);
    }
  });
});
