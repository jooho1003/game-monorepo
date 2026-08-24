import { describe, expect, it } from "vitest";
import {
  CYCLOPS_GATE_OPEN_DURATION_MS,
  CYCLOPS_SLEEP_DURATION_MS,
  CYCLOPS_WATCH_DURATION_MS,
  FIFTH_FLOOR_MISSION_DURATION_MS,
  advanceFifthFloorMission,
  chooseFifthFloorSacrifice,
  createFifthFloorMission,
  escapeFifthFloorMission,
  hitCyclopsWithBasicAttack,
  hitCyclopsWithSkill,
  isCyclopsVisionActive,
  reachFifthFloorBeach,
} from "./fifth-floor-mission.js";

describe("fifth-floor cyclops mission", () => {
  it("starts a five-minute escape with fifteen allies and twenty sheep", () => {
    expect(createFifthFloorMission()).toMatchObject({
      status: "active",
      remainingMs: 300_000,
      phase: "watching",
      phaseRemainingMs: 15_000,
      alliesRemaining: 15,
      sheepCount: 20,
      flockLocation: "inside",
      flockDirection: "out",
      bossHp: 1_200,
      weakPoint: "dormant",
      reachedBeach: false,
    });
  });

  it("forces two sacrifices at the fifteen-second boundary", () => {
    const before = advanceFifthFloorMission(
      createFifthFloorMission(),
      CYCLOPS_WATCH_DURATION_MS - 1,
    );
    expect(before.state.alliesRemaining).toBe(15);
    expect(before.state.phase).toBe("watching");

    const boundary = advanceFifthFloorMission(before.state, 1);
    expect(boundary.state.alliesRemaining).toBe(13);
    expect(boundary.state.phase).toBe("sleeping");
    expect(boundary.events[0]).toEqual({
      type: "allies-sacrificed",
      count: 2,
      voluntary: false,
    });
  });

  it("lets a voluntary sacrifice begin sleep immediately", () => {
    const result = chooseFifthFloorSacrifice(createFifthFloorMission(), true);
    expect(result.state.phase).toBe("sleeping");
    expect(result.state.phaseRemainingMs).toBe(CYCLOPS_SLEEP_DURATION_MS);
    expect(result.state.alliesRemaining).toBe(13);
    expect(result.events[0]).toMatchObject({ voluntary: true });
  });

  it("opens the gate without casualties after surviving the fight", () => {
    const fighting = chooseFifthFloorSacrifice(
      createFifthFloorMission(),
      false,
    );
    expect(fighting.state.sacrificeDecision).toBe("fighting");
    const survived = advanceFifthFloorMission(
      fighting.state,
      CYCLOPS_WATCH_DURATION_MS,
    );
    expect(survived.state.alliesRemaining).toBe(15);
    expect(survived.state.phase).toBe("gate-open");
    expect(
      survived.events.some((event) => event.type === "allies-sacrificed"),
    ).toBe(false);
  });

  it("opens for thirty seconds and alternates the flock out then in", () => {
    const sleeping = advanceFifthFloorMission(
      createFifthFloorMission(),
      CYCLOPS_WATCH_DURATION_MS,
    ).state;
    const opened = advanceFifthFloorMission(
      sleeping,
      CYCLOPS_SLEEP_DURATION_MS,
    ).state;
    expect(opened.phase).toBe("gate-open");
    expect(opened.phaseRemainingMs).toBe(CYCLOPS_GATE_OPEN_DURATION_MS);

    const secondWatch = advanceFifthFloorMission(
      opened,
      CYCLOPS_GATE_OPEN_DURATION_MS,
    ).state;
    expect(secondWatch).toMatchObject({
      phase: "watching",
      flockLocation: "outside",
      flockDirection: "in",
    });

    const secondOpen = advanceFifthFloorMission(
      secondWatch,
      CYCLOPS_WATCH_DURATION_MS + CYCLOPS_SLEEP_DURATION_MS,
    ).state;
    const thirdWatch = advanceFifthFloorMission(
      secondOpen,
      CYCLOPS_GATE_OPEN_DURATION_MS,
    ).state;
    expect(thirdWatch).toMatchObject({
      flockLocation: "inside",
      flockDirection: "out",
    });
  });

  it("is invariant to large or small elapsed-time chunks", () => {
    const elapsed = 105_000;
    const once = advanceFifthFloorMission(
      createFifthFloorMission(),
      elapsed,
    ).state;
    let chunked = createFifthFloorMission();
    for (let time = 0; time < elapsed; time += 1_000) {
      chunked = advanceFifthFloorMission(chunked, 1_000).state;
    }
    expect(once).toEqual(chunked);
  });

  it("fails once at exactly five minutes and ignores later ticks", () => {
    const failed = advanceFifthFloorMission(
      createFifthFloorMission(),
      FIFTH_FLOOR_MISSION_DURATION_MS,
    );
    expect(failed.state).toMatchObject({
      status: "failed",
      failureReason: "timeout",
      remainingMs: 0,
    });
    expect(failed.events.filter((event) => event.type === "mission-failed"))
      .toHaveLength(1);
    expect(advanceFifthFloorMission(failed.state, 60_000).events).toEqual([]);
  });

  it("allows escape only after the player reaches the beach", () => {
    expect(escapeFifthFloorMission(createFifthFloorMission()).state.status).toBe(
      "active",
    );
    const reached = reachFifthFloorBeach(createFifthFloorMission()).state;
    expect(escapeFifthFloorMission(reached).state.status).toBe("escaped");
  });

  it("requires one sleeping basic hit before an eye hit can block vision", () => {
    const sleeping = advanceFifthFloorMission(
      createFifthFloorMission(),
      CYCLOPS_WATCH_DURATION_MS,
    ).state;
    expect(sleeping.weakPoint).toBe("primed");

    const awakened = hitCyclopsWithBasicAttack(sleeping, 20, false);
    expect(awakened.state).toMatchObject({
      phase: "watching",
      weakPoint: "exposed",
      bossHp: 1_200,
    });
    expect(isCyclopsVisionActive(awakened.state)).toBe(true);

    const blinded = hitCyclopsWithBasicAttack(awakened.state, 20, true);
    expect(blinded.state).toMatchObject({
      weakPoint: "blinded",
      bossHp: 1_140,
    });
    expect(isCyclopsVisionActive(blinded.state)).toBe(false);
  });

  it("allows skills to damage the boss without exposing or blinding the eye", () => {
    const hit = hitCyclopsWithSkill(createFifthFloorMission(), 35);
    expect(hit.state).toMatchObject({ bossHp: 1_165, weakPoint: "dormant" });
    expect(hit.events).toContainEqual({
      type: "boss-damaged",
      amount: 35,
      hp: 1_165,
    });
  });

  it("ignores invalid elapsed time", () => {
    const initial = createFifthFloorMission();
    expect(advanceFifthFloorMission(initial, 0).state).toBe(initial);
    expect(advanceFifthFloorMission(initial, -1).state).toBe(initial);
    expect(advanceFifthFloorMission(initial, Number.NaN).state).toBe(initial);
  });
});
