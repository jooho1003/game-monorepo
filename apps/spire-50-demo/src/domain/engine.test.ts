import { describe, expect, it } from "vitest";
import {
  createInitialSnapshot,
  transition,
  wandererRoleFromSeed,
} from "./engine.js";

describe("deterministic run shell", () => {
  it("derives the same wanderer role for the same seed", () => {
    expect(wandererRoleFromSeed(5025)).toBe(wandererRoleFromSeed(5025));
  });

  it("unlocks the first skill after the manager dialogue", () => {
    const started = transition(createInitialSnapshot(), {
      type: "START_RUN",
      weapon: "longsword",
      seed: 50,
    }).snapshot;

    const afterOne = transition(started, { type: "ADVANCE_DIALOGUE" }).snapshot;
    const afterTwo = transition(afterOne, {
      type: "ADVANCE_DIALOGUE",
    }).snapshot;
    const finished = transition(afterTwo, {
      type: "ADVANCE_DIALOGUE",
    }).snapshot;

    expect(finished.skillUnlocked).toBe(true);
    expect(finished.dialogueOpen).toBe(false);
  });

  it("spends gold and restores health in the shop", () => {
    const damaged = transition(createInitialSnapshot(), {
      type: "TAKE_DAMAGE",
      amount: 40,
    }).snapshot;
    const healed = transition(damaged, {
      type: "BUY_HEAL",
      price: 20,
      amount: 35,
    }).snapshot;

    expect(healed.hp).toBe(95);
    expect(healed.gold).toBe(10);
  });

  it("returns a defeated player to the rest area", () => {
    const battle = transition(createInitialSnapshot(), {
      type: "ENTER_ZONE",
      zone: "battle",
    }).snapshot;
    const defeated = transition(battle, {
      type: "TAKE_DAMAGE",
      amount: 100,
    }).snapshot;

    expect(defeated.zone).toBe("rest");
    expect(defeated.hp).toBe(100);
  });
});
