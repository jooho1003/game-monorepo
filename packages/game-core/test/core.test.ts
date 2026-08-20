import { describe, expect, it } from "vitest";
import { clamp, createRng, lerp, ScoreBoard } from "../src/index.js";

describe("math", () => {
  it("clamp bounds values", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("lerp interpolates and clamps t", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 2)).toBe(10);
  });
});

describe("rng", () => {
  it("is deterministic for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it("intBetween stays within range", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const n = rng.intBetween(1, 6);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
    }
  });
});

describe("ScoreBoard", () => {
  it("applies combo multiplier", () => {
    const board = new ScoreBoard();
    expect(board.add(100)).toBe(100); // 콤보 1: x1.0
    expect(board.add(100)).toBe(110); // 콤보 2: x1.1
    expect(board.add(100)).toBe(120); // 콤보 3: x1.2
    expect(board.score).toBe(330);
  });

  it("keeps best score after reset", () => {
    const board = new ScoreBoard();
    board.add(500);
    board.reset();
    expect(board.score).toBe(0);
    expect(board.best).toBe(500);
  });
});
