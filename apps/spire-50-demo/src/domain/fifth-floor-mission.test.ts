import { describe, expect, it } from "vitest";
import {
  CYCLOPS_FIRST_WATCH_DURATION_MS,
  CYCLOPS_GATE_OPEN_DURATION_MS,
  CYCLOPS_SLEEP_DURATION_MS,
  CYCLOPS_WATCH_DURATION_MS,
  FIFTH_FLOOR_MIN_ESCAPE_ALLIES,
  FIFTH_FLOOR_MISSION_DURATION_MS,
  advanceFifthFloorMission,
  chooseFifthFloorStrategy,
  commandFifthFloorSacrificeCharge,
  completeFifthFloorFlockTransit,
  completeFifthFloorSacrifice,
  createFifthFloorMission,
  escapeFifthFloorMission,
  hitCyclopsWithBasicAttack,
  hitCyclopsWithSkill,
  isCyclopsVisionActive,
  loseFifthFloorAllies,
  loseFifthFloorSoldiers,
  reachFifthFloorBeach,
  revokeFifthFloorStrategy,
  toggleFifthFloorSacrifice,
  updateFifthFloorAlliesAtBeach,
  updateFifthFloorSheepAtBeach,
  type FifthFloorMissionState,
} from "./fifth-floor-mission.js";

function prepareTactics(
  state = createFifthFloorMission(),
): FifthFloorMissionState {
  const gateOpen = advanceFifthFloorMission(
    state,
    CYCLOPS_WATCH_DURATION_MS,
  ).state;
  return completeFifthFloorFlockTransit(gateOpen).state;
}

function prepareStealthSacrifice(
  state = prepareTactics(),
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
      phaseRemainingMs: CYCLOPS_FIRST_WATCH_DURATION_MS,
      alliesRemaining: 15,
      sheepCount: 20,
      sheepAtBeach: 0,
      flockLocation: "inside",
      flockDirection: "out",
      strategy: "observing",
      activeSoldierIds: Array.from({ length: 15 }, (_, index) => index),
      selectedSacrificeIds: [],
      bossHp: 1_200,
      weakPoint: "dormant",
      reachedBeach: false,
      alliesAtBeach: 0,
    });
  });

  it("opens the gate for the flock before asking for a strategy", () => {
    const opened = advanceFifthFloorMission(
      createFifthFloorMission(),
      CYCLOPS_WATCH_DURATION_MS,
    );
    expect(opened.state).toMatchObject({
      phase: "gate-open",
      strategy: "observing",
      alliesRemaining: 15,
    });
    expect(opened.events).toContainEqual({
      type: "phase-changed",
      phase: "gate-open",
    });

    const ready = completeFifthFloorFlockTransit(opened.state);
    expect(ready.state).toMatchObject({
      phase: "watching",
      strategy: "pending",
      flockLocation: "outside",
      flockDirection: "in",
    });
  });

  it("reopens the gate and alternates the flock between outside and inside", () => {
    const firstOpen = advanceFifthFloorMission(
      createFifthFloorMission(),
      CYCLOPS_WATCH_DURATION_MS,
    ).state;
    const outside = completeFifthFloorFlockTransit(firstOpen).state;
    expect(outside).toMatchObject({
      phase: "watching",
      flockLocation: "outside",
      flockDirection: "in",
      sheepAtBeach: 20,
    });

    const secondOpen = advanceFifthFloorMission(
      outside,
      CYCLOPS_WATCH_DURATION_MS,
    ).state;
    expect(secondOpen).toMatchObject({ phase: "gate-open", strategy: "pending" });
    const inside = completeFifthFloorFlockTransit(secondOpen).state;
    expect(inside).toMatchObject({
      phase: "watching",
      flockLocation: "inside",
      flockDirection: "out",
      sheepAtBeach: 0,
    });
  });

  it("keeps the gate cycle running while a strategy command is in progress", () => {
    let charging = chooseFifthFloorStrategy(prepareTactics(), true).state;
    charging = toggleFifthFloorSacrifice(charging, 0).state;
    charging = toggleFifthFloorSacrifice(charging, 1).state;
    charging = commandFifthFloorSacrificeCharge(charging).state;
    expect(
      advanceFifthFloorMission(charging, CYCLOPS_WATCH_DURATION_MS).state,
    ).toMatchObject({ phase: "gate-open", flockDirection: "in" });
  });

  it("clamps the number of sheep that crossed into the beach", () => {
    const state = createFifthFloorMission();
    expect(updateFifthFloorSheepAtBeach(state, 7.9).state.sheepAtBeach).toBe(7);
    expect(updateFifthFloorSheepAtBeach(state, 99).state.sheepAtBeach).toBe(20);
  });

  it("requires the player to select exactly two living sacrifice soldiers", () => {
    let state = chooseFifthFloorStrategy(prepareTactics(), true).state;
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

  it("accepts a sacrifice while the gate is open and sleeps only after leaving the gate phase", () => {
    // Reach a later cycle where the strategy is pending, then reopen the gate.
    const pendingWatch = prepareTactics();
    const gateOpen = advanceFifthFloorMission(
      pendingWatch,
      CYCLOPS_WATCH_DURATION_MS,
    ).state;
    expect(gateOpen).toMatchObject({ phase: "gate-open", strategy: "pending" });

    let state = chooseFifthFloorStrategy(gateOpen, true).state;
    expect(state.strategy).toBe("stealth-selecting");
    const gateTimer = state.phaseRemainingMs;
    state = toggleFifthFloorSacrifice(state, 2).state;
    state = toggleFifthFloorSacrifice(state, 3).state;
    const charging = commandFifthFloorSacrificeCharge(state).state;
    expect(charging.strategy).toBe("stealth-charging");
    // Commanding during gate-open must not reset the gate timer.
    expect(charging.phaseRemainingMs).toBe(gateTimer);

    const slept = completeFifthFloorSacrifice(charging);
    expect(slept.state).toMatchObject({
      phase: "sleeping",
      strategy: "stealth",
      phaseRemainingMs: CYCLOPS_SLEEP_DURATION_MS,
      weakPoint: "primed",
    });
    expect(slept.events).toContainEqual({
      type: "phase-changed",
      phase: "sleeping",
    });
  });

  it("commands every soldier to charge immediately when fighting is chosen", () => {
    const fighting = chooseFifthFloorStrategy(
      prepareTactics(),
      false,
    );
    expect(fighting.state.strategy).toBe("fighting");
    expect(fighting.events).toEqual([{ type: "charge-commanded" }]);

    const firstExchange = advanceFifthFloorMission(
      fighting.state,
      CYCLOPS_WATCH_DURATION_MS,
    );
    expect(firstExchange.state.alliesRemaining).toBe(15);
    expect(firstExchange.state.phase).toBe("gate-open");

    const defeatedSquad = loseFifthFloorAllies(firstExchange.state, 15).state;
    expect(defeatedSquad.alliesRemaining).toBe(0);
    // Two soldiers are a full meal: the sated boss shuts the gate and sleeps.
    expect(defeatedSquad.phase).toBe("sleeping");
  });

  it("does not open after sleep unless the primed eye is hit", () => {
    const sleeping = prepareStealthSacrifice();
    const woke = advanceFifthFloorMission(
      sleeping,
      CYCLOPS_SLEEP_DURATION_MS,
    ).state;
    expect(woke).toMatchObject({
      phase: "watching",
      strategy: "pending",
      flockLocation: "outside",
      weakPoint: "dormant",
    });
  });

  it("is invariant to large or small elapsed-time chunks", () => {
    const elapsed = 105_000;
    const started = chooseFifthFloorStrategy(
      prepareTactics(),
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
    const reached = reachFifthFloorBeach(prepareTactics()).state;
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

    const tooFew = loseFifthFloorAllies(reached, 10).state;
    const fiveGathered = updateFifthFloorAlliesAtBeach(tooFew, 5).state;
    const failed = escapeFifthFloorMission(fiveGathered);
    expect(tooFew.alliesRemaining).toBe(FIFTH_FLOOR_MIN_ESCAPE_ALLIES - 1);
    expect(failed.state).toMatchObject({
      status: "failed",
      failureReason: "too-few-survivors",
    });
  });

  it("wakes the sleeping boss into the hunt when struck anywhere but the eye", () => {
    const sleeping = prepareStealthSacrifice();
    const bodyHit = hitCyclopsWithBasicAttack(sleeping, 20, false);
    expect(bodyHit.state).toMatchObject({
      phase: "watching",
      phaseRemainingMs: CYCLOPS_WATCH_DURATION_MS,
      strategy: "pending",
      weakPoint: "dormant",
      bossHp: 1_180,
    });
    expect(bodyHit.events).toContainEqual({ type: "boss-roared" });
    expect(bodyHit.events).toContainEqual({
      type: "phase-changed",
      phase: "watching",
    });

    const skillHit = hitCyclopsWithSkill(sleeping, 20);
    expect(skillHit.state).toMatchObject({ phase: "watching", bossHp: 1_180 });
    expect(skillHit.events).toContainEqual({ type: "boss-roared" });
  });

  it("blinds the boss forever without touching the gate cycle when the sleeping eye is pierced", () => {
    const sleeping = prepareStealthSacrifice();

    const blinded = hitCyclopsWithBasicAttack(sleeping, 20, true);
    expect(blinded.state).toMatchObject({
      phase: "watching",
      phaseRemainingMs: CYCLOPS_WATCH_DURATION_MS,
      strategy: "pending",
      weakPoint: "blinded",
      bossHp: 1_140,
    });
    expect(blinded.events).toContainEqual({ type: "vision-obscured" });
    expect(blinded.events).toContainEqual({
      type: "phase-changed",
      phase: "watching",
    });
    expect(isCyclopsVisionActive(blinded.state)).toBe(false);

    // The gate schedule keeps running: the next open arrives on its own.
    const reopened = advanceFifthFloorMission(
      blinded.state,
      CYCLOPS_WATCH_DURATION_MS,
    ).state;
    expect(reopened).toMatchObject({ phase: "gate-open", weakPoint: "blinded" });
  });

  it("keeps blindness through every later sleep and wake", () => {
    const sleeping = prepareStealthSacrifice();
    const blinded = hitCyclopsWithBasicAttack(sleeping, 20, true).state;

    const satedAgain = loseFifthFloorSoldiers(blinded, [5, 6]).state;
    expect(satedAgain).toMatchObject({ phase: "sleeping", weakPoint: "blinded" });

    const woke = advanceFifthFloorMission(
      satedAgain,
      CYCLOPS_SLEEP_DURATION_MS,
    ).state;
    expect(woke).toMatchObject({ phase: "watching", weakPoint: "blinded" });
  });

  it("allows skills to damage the boss without replacing the eye attack", () => {
    const hit = hitCyclopsWithSkill(prepareTactics(), 35);
    expect(hit.state).toMatchObject({ bossHp: 1_165, weakPoint: "dormant" });
    expect(hit.events).toContainEqual({
      type: "boss-damaged",
      amount: 35,
      hp: 1_165,
    });
  });

  it("removes the exact soldiers caught by an attack and sleeps once two are eaten", () => {
    const first = loseFifthFloorSoldiers(createFifthFloorMission(), [3]);
    expect(first.state.alliesRemaining).toBe(14);
    expect(first.state).toMatchObject({ phase: "watching", soldiersEaten: 1 });
    expect(first.events).toEqual([{ type: "allies-lost", count: 1 }]);

    const sated = loseFifthFloorSoldiers(first.state, [8]);
    expect(sated.state.alliesRemaining).toBe(13);
    expect(sated.state.activeSoldierIds).not.toContain(3);
    expect(sated.state.activeSoldierIds).not.toContain(8);
    expect(sated.state).toMatchObject({
      phase: "sleeping",
      soldiersEaten: 0,
      weakPoint: "primed",
    });
    expect(sated.events).toEqual([
      { type: "allies-lost", count: 1 },
      { type: "boss-sated" },
      { type: "phase-changed", phase: "sleeping" },
    ]);
  });

  it("closes the gate and sleeps when two soldiers are eaten with the gate open", () => {
    const gateOpen = advanceFifthFloorMission(
      createFifthFloorMission(),
      CYCLOPS_WATCH_DURATION_MS,
    ).state;
    expect(gateOpen.phase).toBe("gate-open");
    const sated = loseFifthFloorSoldiers(gateOpen, [0, 1]);
    expect(sated.state).toMatchObject({
      phase: "sleeping",
      phaseRemainingMs: CYCLOPS_SLEEP_DURATION_MS,
      weakPoint: "primed",
    });
    expect(sated.events).toContainEqual({ type: "boss-sated" });
  });

  it("freezes the gate timetable while the boss is in combat", () => {
    const initial = createFifthFloorMission();
    const held = advanceFifthFloorMission(initial, 4_000, {
      holdPhaseTimer: true,
    }).state;
    expect(held).toMatchObject({
      phase: "watching",
      phaseRemainingMs: CYCLOPS_FIRST_WATCH_DURATION_MS,
      phaseTimerHeld: true,
      remainingMs: FIFTH_FLOOR_MISSION_DURATION_MS - 4_000,
    });

    const resumed = advanceFifthFloorMission(held, 1_000).state;
    expect(resumed).toMatchObject({
      phaseTimerHeld: false,
      phaseRemainingMs: CYCLOPS_FIRST_WATCH_DURATION_MS - 1_000,
    });

    const timedOut = advanceFifthFloorMission(
      held,
      FIFTH_FLOOR_MISSION_DURATION_MS,
      { holdPhaseTimer: true },
    );
    expect(timedOut.state).toMatchObject({
      status: "failed",
      failureReason: "timeout",
    });
  });

  it("resets the chosen sacrifices and sleeps when other soldiers fill the meal", () => {
    let charging = chooseFifthFloorStrategy(prepareTactics(), true).state;
    charging = toggleFifthFloorSacrifice(charging, 0).state;
    charging = toggleFifthFloorSacrifice(charging, 1).state;
    charging = commandFifthFloorSacrificeCharge(charging).state;
    expect(charging.strategy).toBe("stealth-charging");

    // One casualty is not a full meal: the designation stands.
    const oneLost = loseFifthFloorSoldiers(charging, [5]);
    expect(oneLost.state).toMatchObject({
      strategy: "stealth-charging",
      selectedSacrificeIds: [0, 1],
      soldiersEaten: 1,
      phase: "watching",
    });

    const sated = loseFifthFloorSoldiers(oneLost.state, [6]);
    expect(sated.state).toMatchObject({
      phase: "sleeping",
      strategy: "pending",
      selectedSacrificeIds: [],
      weakPoint: "primed",
    });
    expect(sated.state.activeSoldierIds).toContain(0);
    expect(sated.state.activeSoldierIds).toContain(1);
    expect(sated.events).toContainEqual({ type: "sacrifice-reset" });
    expect(sated.events).toContainEqual({ type: "boss-sated" });
  });

  it("fails the mission when the boss is downed with the gate shut", () => {
    const watching = prepareTactics();
    const downed = hitCyclopsWithSkill(watching, watching.bossHp);
    expect(downed.state).toMatchObject({
      status: "failed",
      failureReason: "gate-sealed",
      bossHp: 0,
    });
    expect(downed.events).toContainEqual({
      type: "mission-failed",
      reason: "gate-sealed",
    });

    // A sleeping boss lies behind a closed gate — an eye-stab kill also seals.
    const sleeping = { ...prepareStealthSacrifice(), bossHp: 10 };
    const eyeKill = hitCyclopsWithBasicAttack(sleeping, 20, true);
    expect(eyeKill.state).toMatchObject({
      status: "failed",
      failureReason: "gate-sealed",
    });
  });

  it("keeps the gate open when the boss is downed mid-opening", () => {
    const gateOpen = advanceFifthFloorMission(
      createFifthFloorMission(),
      CYCLOPS_WATCH_DURATION_MS,
    ).state;
    expect(gateOpen.phase).toBe("gate-open");
    const downed = hitCyclopsWithSkill(gateOpen, gateOpen.bossHp);
    expect(downed.state).toMatchObject({
      status: "active",
      phase: "gate-open",
      bossHp: 0,
      weakPoint: "blinded",
    });
    expect(downed.events).toContainEqual({ type: "boss-staggered" });
    expect(
      downed.events.filter((event) => event.type === "phase-changed"),
    ).toEqual([]);
    // The downed boss can never shut the rock again.
    expect(completeFifthFloorFlockTransit(downed.state).state).toBe(
      downed.state,
    );

    // ...and the gate timer cannot shut it either.
    const waited = advanceFifthFloorMission(
      downed.state,
      CYCLOPS_GATE_OPEN_DURATION_MS * 2,
    ).state;
    expect(waited).toMatchObject({ phase: "gate-open", bossHp: 0 });
  });

  it("holds the rock up for the flat gate window and then closes it", () => {
    const gateOpen = advanceFifthFloorMission(
      createFifthFloorMission(),
      CYCLOPS_FIRST_WATCH_DURATION_MS,
    ).state;
    expect(gateOpen).toMatchObject({
      phase: "gate-open",
      phaseRemainingMs: CYCLOPS_GATE_OPEN_DURATION_MS,
    });

    const almost = advanceFifthFloorMission(
      gateOpen,
      CYCLOPS_GATE_OPEN_DURATION_MS - 1,
    );
    expect(almost.state).toMatchObject({
      phase: "gate-open",
      phaseRemainingMs: 1,
    });
    expect(almost.events).toEqual([]);

    const closed = advanceFifthFloorMission(almost.state, 1);
    expect(closed.state).toMatchObject({
      phase: "watching",
      phaseRemainingMs: CYCLOPS_WATCH_DURATION_MS,
      flockLocation: "outside",
      flockDirection: "in",
      strategy: "pending",
      cycle: 2,
    });
    expect(closed.events).toContainEqual({
      type: "flock-moved",
      location: "outside",
      nextDirection: "in",
    });
  });

  it("counts the designated pair being eaten as the sacrifice landing", () => {
    let charging = chooseFifthFloorStrategy(prepareTactics(), true).state;
    charging = toggleFifthFloorSacrifice(charging, 2).state;
    charging = toggleFifthFloorSacrifice(charging, 4).state;
    charging = commandFifthFloorSacrificeCharge(charging).state;

    const eaten = loseFifthFloorSoldiers(charging, [2, 4]);
    expect(eaten.state).toMatchObject({
      phase: "sleeping",
      strategy: "stealth",
      selectedSacrificeIds: [],
      weakPoint: "primed",
      alliesRemaining: 13,
    });
    expect(eaten.events).toContainEqual({
      type: "allies-sacrificed",
      soldierIds: [2, 4],
    });
    expect(
      eaten.events.some((event) => event.type === "sacrifice-reset"),
    ).toBe(false);
  });

  it("silently dismisses the tactics prompt when stealth is picked after blinding", () => {
    const sleeping = prepareStealthSacrifice();
    const blinded = hitCyclopsWithBasicAttack(sleeping, 20, true).state;
    expect(blinded).toMatchObject({ strategy: "pending", weakPoint: "blinded" });

    const dismissed = chooseFifthFloorStrategy(blinded, true);
    expect(dismissed.state).toMatchObject({
      strategy: "observing",
      selectedSacrificeIds: [],
    });
    expect(dismissed.events).toEqual([]);
  });

  it("revokes a fight or a half-picked sacrifice back to pending with X", () => {
    const fighting = chooseFifthFloorStrategy(prepareTactics(), false).state;
    const calledOff = revokeFifthFloorStrategy(fighting);
    expect(calledOff.state.strategy).toBe("pending");
    expect(calledOff.events).toEqual([{ type: "strategy-revoked" }]);

    let selecting = chooseFifthFloorStrategy(prepareTactics(), true).state;
    selecting = toggleFifthFloorSacrifice(selecting, 3).state;
    const abandoned = revokeFifthFloorStrategy(selecting);
    expect(abandoned.state).toMatchObject({
      strategy: "pending",
      selectedSacrificeIds: [],
    });

    // A committed charge and a sleeping boss cannot be revoked.
    let charging = chooseFifthFloorStrategy(prepareTactics(), true).state;
    charging = toggleFifthFloorSacrifice(charging, 0).state;
    charging = toggleFifthFloorSacrifice(charging, 1).state;
    charging = commandFifthFloorSacrificeCharge(charging).state;
    expect(revokeFifthFloorStrategy(charging).state).toBe(charging);
    const sleeping = prepareStealthSacrifice();
    expect(revokeFifthFloorStrategy(sleeping).state).toBe(sleeping);
  });

  it("ignores invalid elapsed time", () => {
    const initial = createFifthFloorMission();
    expect(advanceFifthFloorMission(initial, 0).state).toBe(initial);
    expect(advanceFifthFloorMission(initial, -1).state).toBe(initial);
    expect(advanceFifthFloorMission(initial, Number.NaN).state).toBe(initial);
  });
});
