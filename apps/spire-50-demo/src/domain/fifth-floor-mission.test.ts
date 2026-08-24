import { describe, expect, it } from "vitest";
import {
  CYCLOPS_GATE_OPEN_DURATION_MS,
  CYCLOPS_SLEEP_DURATION_MS,
  CYCLOPS_WATCH_DURATION_MS,
  FIFTH_FLOOR_MISSION_DURATION_MS,
  advanceFifthFloorMission,
  chooseFifthFloorStrategy,
  commandFifthFloorSacrificeCharge,
  completeFifthFloorSacrifice,
  createFifthFloorMission,
  escapeFifthFloorMission,
  hitCyclopsWithBasicAttack,
  hitCyclopsWithSkill,
  isCyclopsVisionActive,
  loseFifthFloorAllies,
  loseFifthFloorSoldiers,
  reachFifthFloorBeach,
  toggleFifthFloorSacrifice,
  updateFifthFloorAlliesAtBeach,
  type FifthFloorMissionState,
} from "./fifth-floor-mission.js";

function prepareStealthSacrifice(
  state = createFifthFloorMission(),
  soldierIds: readonly [number, number] = [0, 1],
): FifthFloorMissionState {
  let current = chooseFifthFloorStrategy(state, true).state;
  current = toggleFifthFloorSacrifice(current, soldierIds[0]).state;
  current = toggleFifthFloorSacrifice(current, soldierIds[1]).state;
  current = commandFifthFloorSacrificeCharge(current).state;
  return completeFifthFloorSacrifice(current).state;
}

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
      strategy: "pending",
      activeSoldierIds: Array.from({ length: 15 }, (_, index) => index),
      selectedSacrificeIds: [],
      bossHp: 1_200,
      weakPoint: "dormant",
      reachedBeach: false,
      alliesAtBeach: 0,
    });
  });

  it("waits for the player's strategy without sacrificing soldiers", () => {
    const waiting = advanceFifthFloorMission(
      createFifthFloorMission(),
      CYCLOPS_WATCH_DURATION_MS * 2,
    );
    expect(waiting.state).toMatchObject({
      phase: "watching",
      strategy: "pending",
      alliesRemaining: 15,
      phaseRemainingMs: CYCLOPS_WATCH_DURATION_MS,
    });
    expect(waiting.events).toEqual([]);
  });

  it("requires the player to select exactly two living sacrifice soldiers", () => {
    let state = chooseFifthFloorStrategy(createFifthFloorMission(), true).state;
    expect(state.strategy).toBe("stealth-selecting");

    state = toggleFifthFloorSacrifice(state, 4).state;
    expect(commandFifthFloorSacrificeCharge(state).state).toBe(state);
    state = toggleFifthFloorSacrifice(state, 9).state;
    state = toggleFifthFloorSacrifice(state, 12).state;
    expect(state.selectedSacrificeIds).toEqual([4, 9]);

    const charging = commandFifthFloorSacrificeCharge(state);
    expect(charging.state.strategy).toBe("stealth-charging");
    expect(charging.events).toEqual([
      { type: "sacrifice-charge-commanded", soldierIds: [4, 9] },
    ]);

    const sleeping = completeFifthFloorSacrifice(charging.state);
    expect(sleeping.state).toMatchObject({
      phase: "sleeping",
      strategy: "stealth",
      alliesRemaining: 13,
      selectedSacrificeIds: [],
      weakPoint: "primed",
    });
    expect(sleeping.state.activeSoldierIds).not.toContain(4);
    expect(sleeping.state.activeSoldierIds).not.toContain(9);
    expect(sleeping.events[0]).toEqual({
      type: "allies-sacrificed",
      soldierIds: [4, 9],
    });
  });

  it("commands every soldier to charge immediately when fighting is chosen", () => {
    const fighting = chooseFifthFloorStrategy(
      createFifthFloorMission(),
      false,
    );
    expect(fighting.state.strategy).toBe("fighting");
    expect(fighting.events).toEqual([{ type: "charge-commanded" }]);

    const firstExchange = advanceFifthFloorMission(
      fighting.state,
      CYCLOPS_WATCH_DURATION_MS,
    );
    expect(firstExchange.state.alliesRemaining).toBe(15);
    expect(firstExchange.state.phase).toBe("watching");

    const defeatedSquad = loseFifthFloorAllies(firstExchange.state, 15).state;
    const opened = advanceFifthFloorMission(
      defeatedSquad,
      CYCLOPS_WATCH_DURATION_MS,
    );
    expect(opened.state.alliesRemaining).toBe(0);
    expect(opened.state.phase).toBe("gate-open");
  });

  it("opens after sleep and alternates sheep moving outside then inside", () => {
    const sleeping = prepareStealthSacrifice();
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

    const secondSleep = prepareStealthSacrifice(secondWatch, [2, 3]);
    const secondOpen = advanceFifthFloorMission(
      secondSleep,
      CYCLOPS_SLEEP_DURATION_MS,
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
    const started = chooseFifthFloorStrategy(
      createFifthFloorMission(),
      false,
    ).state;
    const once = advanceFifthFloorMission(started, elapsed).state;
    let chunked = started;
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
    expect(
      failed.events.filter((event) => event.type === "mission-failed"),
    ).toHaveLength(1);
    expect(advanceFifthFloorMission(failed.state, 60_000).events).toEqual([]);
  });

  it("allows escape only after the player and every survivor reach the beach", () => {
    expect(
      escapeFifthFloorMission(createFifthFloorMission()).state.status,
    ).toBe("active");
    const reached = reachFifthFloorBeach(createFifthFloorMission()).state;
    expect(escapeFifthFloorMission(reached).state.status).toBe("active");
    const gathered = updateFifthFloorAlliesAtBeach(reached, 15).state;
    expect(escapeFifthFloorMission(gathered).state.status).toBe("escaped");

    const afterLoss = loseFifthFloorAllies(reached, 3).state;
    const survivorsGathered = updateFifthFloorAlliesAtBeach(
      afterLoss,
      12,
    ).state;
    expect(escapeFifthFloorMission(survivorsGathered).state.status).toBe(
      "escaped",
    );
  });

  it("opens the gate and blocks attacks when the sleeping eye is pierced", () => {
    const sleeping = prepareStealthSacrifice();
    const bodyHit = hitCyclopsWithBasicAttack(sleeping, 20, false);
    expect(bodyHit.state).toMatchObject({
      phase: "sleeping",
      weakPoint: "primed",
      bossHp: 1_180,
    });

    const blinded = hitCyclopsWithBasicAttack(sleeping, 20, true);
    expect(blinded.state).toMatchObject({
      phase: "gate-open",
      weakPoint: "blinded",
      bossHp: 1_140,
    });
    expect(isCyclopsVisionActive(blinded.state)).toBe(false);
  });

  it("allows skills to damage the boss without replacing the eye attack", () => {
    const hit = hitCyclopsWithSkill(createFifthFloorMission(), 35);
    expect(hit.state).toMatchObject({ bossHp: 1_165, weakPoint: "dormant" });
    expect(hit.events).toContainEqual({
      type: "boss-damaged",
      amount: 35,
      hp: 1_165,
    });
  });

  it("removes the exact soldiers caught by an attack", () => {
    const result = loseFifthFloorSoldiers(createFifthFloorMission(), [3, 8]);
    expect(result.state.alliesRemaining).toBe(13);
    expect(result.state.activeSoldierIds).not.toContain(3);
    expect(result.state.activeSoldierIds).not.toContain(8);
    expect(result.events).toEqual([{ type: "allies-lost", count: 2 }]);
  });

  it("ignores invalid elapsed time", () => {
    const initial = createFifthFloorMission();
    expect(advanceFifthFloorMission(initial, 0).state).toBe(initial);
    expect(advanceFifthFloorMission(initial, -1).state).toBe(initial);
    expect(advanceFifthFloorMission(initial, Number.NaN).state).toBe(initial);
  });
});
