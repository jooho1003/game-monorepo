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

  it("loads an existing run into the rest area", () => {
    const started = transition(createInitialSnapshot(), {
      type: "START_RUN",
      weapon: "bow",
      seed: 5026,
    }).snapshot;
    const loaded = transition(
      { ...started, screen: "title", zone: "battle" },
      { type: "LOAD_GAME" },
    ).snapshot;

    expect(loaded.screen).toBe("game");
    expect(loaded.zone).toBe("rest");
    expect(loaded.weapon).toBe("bow");
    expect(loaded.seed).toBe(5026);
  });

  it("keeps the title open when there is no run to load", () => {
    const loaded = transition(createInitialSnapshot(), {
      type: "LOAD_GAME",
    }).snapshot;

    expect(loaded.screen).toBe("title");
    expect(loaded.notice).toBe("불러올 여정이 없습니다.");
  });

  it("recovers hp and mp using per-minute rates", () => {
    const snapshot = { ...createInitialSnapshot(), hp: 40, mp: 20 };
    const recovered = transition(snapshot, {
      type: "RECOVER_RESOURCES",
      elapsedMs: 30_000,
    }).snapshot;

    expect(recovered.hp).toBe(43);
    expect(recovered.mp).toBe(26);
  });

  it("levels up and carries remaining experience", () => {
    const leveled = transition(createInitialSnapshot(), {
      type: "GAIN_EXPERIENCE",
      amount: 130,
    }).snapshot;

    expect(leveled.level).toBe(2);
    expect(leveled.experience).toBe(30);
    expect(leveled.experienceToNextLevel).toBe(145);
    expect(leveled.skillPoints).toBe(1);
  });

  it("opens the next floor only after a battle clear", () => {
    const battle = transition(createInitialSnapshot(), {
      type: "ENTER_ZONE",
      zone: "battle",
    }).snapshot;
    const completed = transition(battle, { type: "COMPLETE_FLOOR" }).snapshot;

    expect(completed.zone).toBe("rest");
    expect(completed.floor).toBe(2);
    expect(completed.highestFloor).toBe(2);
  });

  it("returns a failed fifth-floor mission to the rest area without progress", () => {
    const battle = {
      ...createInitialSnapshot(),
      floor: 5,
      highestFloor: 5,
      zone: "battle" as const,
      hp: 12,
    };
    const failed = transition(battle, {
      type: "FAIL_FIFTH_FLOOR",
      reason: "spotted",
    }).snapshot;

    expect(failed).toMatchObject({
      zone: "rest",
      floor: 5,
      highestFloor: 5,
      hp: 100,
      lastMissionResult: "failure-spotted",
    });
  });

  it("ignores fifth-floor failure commands outside its mission", () => {
    const initial = createInitialSnapshot();
    expect(
      transition(initial, {
        type: "FAIL_FIFTH_FLOOR",
        reason: "timeout",
      }).snapshot,
    ).toBe(initial);
  });
});
