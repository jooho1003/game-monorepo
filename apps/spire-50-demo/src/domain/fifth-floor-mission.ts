export const FIFTH_FLOOR_MISSION_DURATION_MS = 300_000;
export const CYCLOPS_WATCH_DURATION_MS = 15_000;
export const CYCLOPS_SLEEP_DURATION_MS = 15_000;
/**
 * The rock stays up for a flat thirty seconds. Nothing shortens it — not a
 * flock that finished crossing early, not an empty doorway.
 */
export const CYCLOPS_GATE_OPEN_DURATION_MS = 30_000;
export const FIFTH_FLOOR_ALLY_COUNT = 15;
export const FIFTH_FLOOR_SHEEP_COUNT = 20;
export const FIFTH_FLOOR_MIN_ESCAPE_ALLIES = 6;
export const CYCLOPS_MEAL_SIZE = 2;
export const CYCLOPS_MAX_HP = 1_200;

export type FifthFloorPhase = "watching" | "sleeping" | "gate-open";
export type FlockLocation = "inside" | "outside";
export type FlockDirection = "out" | "in";
export type FifthFloorStrategy =
  | "observing"
  | "pending"
  | "stealth-selecting"
  | "stealth-charging"
  | "stealth"
  | "fighting";
export type FifthFloorMissionStatus = "active" | "escaped" | "failed";
export type FifthFloorFailureReason =
  | "timeout"
  | "spotted"
  | "too-few-survivors"
  | "gate-sealed";
export type CyclopsWeakPoint = "dormant" | "primed" | "blinded";

export interface FifthFloorMissionState {
  status: FifthFloorMissionStatus;
  failureReason: FifthFloorFailureReason | null;
  remainingMs: number;
  phase: FifthFloorPhase;
  phaseRemainingMs: number;
  phaseTimerHeld: boolean;
  soldiersEaten: number;
  alliesRemaining: number;
  sheepCount: number;
  sheepAtBeach: number;
  flockLocation: FlockLocation;
  flockDirection: FlockDirection;
  strategy: FifthFloorStrategy;
  activeSoldierIds: readonly number[];
  selectedSacrificeIds: readonly number[];
  cycle: number;
  bossHp: number;
  bossMaxHp: number;
  weakPoint: CyclopsWeakPoint;
  weakPointRemainingMs: number;
  reachedBeach: boolean;
  alliesAtBeach: number;
}

export type FifthFloorMissionEvent =
  | { type: "allies-lost"; count: number }
  | { type: "charge-commanded" }
  | { type: "sacrifice-charge-commanded"; soldierIds: readonly number[] }
  | { type: "allies-sacrificed"; soldierIds: readonly number[] }
  | { type: "sacrifice-reset" }
  | { type: "strategy-revoked" }
  | { type: "phase-changed"; phase: FifthFloorPhase }
  | {
      type: "flock-moved";
      location: FlockLocation;
      nextDirection: FlockDirection;
    }
  | { type: "mission-escaped" }
  | { type: "mission-failed"; reason: FifthFloorFailureReason }
  | { type: "vision-obscured" }
  | { type: "boss-sated" }
  | { type: "boss-roared" }
  | { type: "boss-damaged"; amount: number; hp: number }
  | { type: "boss-staggered" }
  | { type: "beach-reached" };

export interface FifthFloorMissionResult {
  state: FifthFloorMissionState;
  events: FifthFloorMissionEvent[];
}

export function createFifthFloorMission(): FifthFloorMissionState {
  return {
    status: "active",
    failureReason: null,
    remainingMs: FIFTH_FLOOR_MISSION_DURATION_MS,
    phase: "watching",
    phaseRemainingMs: CYCLOPS_WATCH_DURATION_MS,
    phaseTimerHeld: false,
    soldiersEaten: 0,
    alliesRemaining: FIFTH_FLOOR_ALLY_COUNT,
    sheepCount: FIFTH_FLOOR_SHEEP_COUNT,
    sheepAtBeach: 0,
    flockLocation: "inside",
    flockDirection: "out",
    strategy: "observing",
    activeSoldierIds: Array.from(
      { length: FIFTH_FLOOR_ALLY_COUNT },
      (_, index) => index,
    ),
    selectedSacrificeIds: [],
    cycle: 1,
    bossHp: CYCLOPS_MAX_HP,
    bossMaxHp: CYCLOPS_MAX_HP,
    weakPoint: "dormant",
    weakPointRemainingMs: 0,
    reachedBeach: false,
    alliesAtBeach: 0,
  };
}

export function chooseFifthFloorStrategy(
  state: FifthFloorMissionState,
  stealth: boolean,
): FifthFloorMissionResult {
  if (
    state.status !== "active" ||
    state.phase === "sleeping" ||
    state.strategy !== "pending"
  ) {
    return { state, events: [] };
  }

  if (!stealth) {
    return {
      state: {
        ...state,
        strategy: "fighting",
        phaseRemainingMs:
          state.phase === "watching"
            ? CYCLOPS_WATCH_DURATION_MS
            : state.phaseRemainingMs,
      },
      events: [{ type: "charge-commanded" }],
    };
  }

  return {
    state: {
      ...state,
      strategy: "stealth-selecting",
      selectedSacrificeIds: [],
    },
    events: [],
  };
}

// X undoes the standing order. A fight can be called off and a half-picked
// sacrifice can be abandoned; a charge already committed cannot be recalled.
export function revokeFifthFloorStrategy(
  state: FifthFloorMissionState,
): FifthFloorMissionResult {
  if (
    state.status !== "active" ||
    state.phase === "sleeping" ||
    (state.strategy !== "fighting" && state.strategy !== "stealth-selecting")
  ) {
    return { state, events: [] };
  }
  return {
    state: { ...state, strategy: "pending", selectedSacrificeIds: [] },
    events: [{ type: "strategy-revoked" }],
  };
}

export function toggleFifthFloorSacrifice(
  state: FifthFloorMissionState,
  soldierId: number,
): FifthFloorMissionResult {
  if (
    state.status !== "active" ||
    state.phase === "sleeping" ||
    state.strategy !== "stealth-selecting" ||
    !Number.isInteger(soldierId) ||
    !state.activeSoldierIds.includes(soldierId)
  ) {
    return { state, events: [] };
  }
  const selected = state.selectedSacrificeIds.includes(soldierId)
    ? state.selectedSacrificeIds.filter((id) => id !== soldierId)
    : state.selectedSacrificeIds.length < CYCLOPS_MEAL_SIZE
      ? [...state.selectedSacrificeIds, soldierId]
      : state.selectedSacrificeIds;
  if (selected === state.selectedSacrificeIds) return { state, events: [] };
  return { state: { ...state, selectedSacrificeIds: selected }, events: [] };
}

export function commandFifthFloorSacrificeCharge(
  state: FifthFloorMissionState,
): FifthFloorMissionResult {
  if (
    state.status !== "active" ||
    state.phase === "sleeping" ||
    state.strategy !== "stealth-selecting" ||
    state.selectedSacrificeIds.length !== CYCLOPS_MEAL_SIZE
  ) {
    return { state, events: [] };
  }
  return {
    state: {
      ...state,
      strategy: "stealth-charging",
      phaseRemainingMs:
        state.phase === "watching"
          ? CYCLOPS_WATCH_DURATION_MS
          : state.phaseRemainingMs,
    },
    events: [
      {
        type: "sacrifice-charge-commanded",
        soldierIds: state.selectedSacrificeIds,
      },
    ],
  };
}

export function completeFifthFloorSacrifice(
  state: FifthFloorMissionState,
): FifthFloorMissionResult {
  if (
    state.status !== "active" ||
    state.phase === "sleeping" ||
    state.strategy !== "stealth-charging" ||
    state.selectedSacrificeIds.length !== CYCLOPS_MEAL_SIZE
  ) {
    return { state, events: [] };
  }
  const soldierIds = state.selectedSacrificeIds.filter((id) =>
    state.activeSoldierIds.includes(id),
  );
  if (soldierIds.length !== CYCLOPS_MEAL_SIZE) return { state, events: [] };
  const activeSoldierIds = state.activeSoldierIds.filter(
    (id) => !soldierIds.includes(id),
  );
  const sleeping = beginCyclopsSleep({
    ...state,
    strategy: "stealth",
    activeSoldierIds,
    selectedSacrificeIds: [],
    alliesRemaining: activeSoldierIds.length,
    alliesAtBeach: Math.min(state.alliesAtBeach, activeSoldierIds.length),
  });
  return {
    state: sleeping.state,
    events: [
      { type: "allies-sacrificed", soldierIds },
      ...sleeping.events,
    ],
  };
}

export interface AdvanceFifthFloorOptions {
  /**
   * True only while the boss is mid-attack (a sweep windup or impact). The
   * rock-gate schedule freezes for the duration of the swing and nothing
   * else: chasing, being harassed, or a standing fight no longer stop the
   * timetable. The five-minute mission clock keeps running regardless.
   */
  holdPhaseTimer?: boolean;
}

export function advanceFifthFloorMission(
  state: FifthFloorMissionState,
  elapsedMs: number,
  options?: AdvanceFifthFloorOptions,
): FifthFloorMissionResult {
  if (
    state.status !== "active" ||
    !Number.isFinite(elapsedMs) ||
    elapsedMs <= 0
  ) {
    return { state, events: [] };
  }

  const holdPhaseTimer = options?.holdPhaseTimer === true;
  let current =
    state.phaseTimerHeld === holdPhaseTimer
      ? state
      : { ...state, phaseTimerHeld: holdPhaseTimer };
  let unconsumedMs = elapsedMs;
  const events: FifthFloorMissionEvent[] = [];

  if (holdPhaseTimer) {
    const step = Math.min(unconsumedMs, current.remainingMs);
    current = {
      ...current,
      remainingMs: current.remainingMs - step,
      weakPointRemainingMs: Math.max(0, current.weakPointRemainingMs - step),
    };
    if (current.remainingMs <= 0) {
      const failure = failFifthFloorMission(current, "timeout");
      current = failure.state;
      events.push(...failure.events);
    }
    return { state: current, events };
  }

  while (unconsumedMs > 0 && current.status === "active") {
    if (
      current.phase === "gate-open" &&
      current.phaseRemainingMs <= 0
    ) {
      const step = Math.min(unconsumedMs, current.remainingMs);
      current = {
        ...current,
        remainingMs: current.remainingMs - step,
        weakPointRemainingMs: Math.max(0, current.weakPointRemainingMs - step),
      };
      unconsumedMs -= step;
      if (current.remainingMs <= 0) {
        const failure = failFifthFloorMission(current, "timeout");
        current = failure.state;
        events.push(...failure.events);
      }
      break;
    }
    if (
      current.phase === "watching" &&
      current.strategy === "stealth"
    ) {
      const step = Math.min(unconsumedMs, current.remainingMs);
      current = {
        ...current,
        remainingMs: current.remainingMs - step,
        weakPointRemainingMs: Math.max(0, current.weakPointRemainingMs - step),
      };
      unconsumedMs -= step;
      if (current.remainingMs <= 0) {
        const failure = failFifthFloorMission(current, "timeout");
        current = failure.state;
        events.push(...failure.events);
      }
      break;
    }

    const step = Math.min(
      unconsumedMs,
      current.remainingMs,
      current.phaseRemainingMs,
    );
    current = {
      ...current,
      remainingMs: current.remainingMs - step,
      phaseRemainingMs: current.phaseRemainingMs - step,
      weakPointRemainingMs: Math.max(0, current.weakPointRemainingMs - step),
    };
    unconsumedMs -= step;

    // A five-minute expiry wins over a phase transition on the same tick.
    if (current.remainingMs <= 0) {
      const failure = failFifthFloorMission(current, "timeout");
      current = failure.state;
      events.push(...failure.events);
      break;
    }

    if (current.phaseRemainingMs > 0) break;

    if (current.phase === "watching") {
      if (
        current.strategy === "observing" ||
        current.strategy === "pending" ||
        current.strategy === "stealth-selecting" ||
        current.strategy === "stealth-charging" ||
        current.strategy === "fighting"
      ) {
        current = {
          ...current,
          phase: "gate-open",
          phaseRemainingMs: CYCLOPS_GATE_OPEN_DURATION_MS,
        };
        events.push({ type: "phase-changed", phase: "gate-open" });
        continue;
      }
      current = {
        ...current,
        phaseRemainingMs: CYCLOPS_WATCH_DURATION_MS,
      };
      continue;
    }

    if (current.phase === "sleeping") {
      current = {
        ...current,
        phase: "watching",
        phaseRemainingMs: CYCLOPS_WATCH_DURATION_MS,
        strategy: "pending",
        // A pierced eye never heals: blindness survives every wake-up.
        weakPoint: current.weakPoint === "blinded" ? "blinded" : "dormant",
        weakPointRemainingMs: 0,
      };
      events.push({ type: "phase-changed", phase: "watching" });
      continue;
    }

    // Only the Cyclops can move the rock, so a downed boss leaves the doorway
    // open for good.
    if (current.bossHp <= 0) {
      current = { ...current, phaseRemainingMs: 0 };
      continue;
    }

    // Thirty seconds up: the rock comes down on schedule, whatever the flock
    // has or has not finished doing.
    const transit = completeFifthFloorFlockTransit(current);
    current = transit.state;
    events.push(...transit.events);
    continue;
  }

  return { state: current, events };
}

export function completeFifthFloorFlockTransit(
  state: FifthFloorMissionState,
): FifthFloorMissionResult {
  if (
    state.status !== "active" ||
    state.phase !== "gate-open" ||
    state.bossHp <= 0
  ) {
    return { state, events: [] };
  }
  const flockLocation: FlockLocation =
    state.flockDirection === "out" ? "outside" : "inside";
  const nextDirection: FlockDirection =
    state.flockDirection === "out" ? "in" : "out";
  const strategy: FifthFloorStrategy =
    state.strategy === "observing" || state.strategy === "stealth"
      ? "pending"
      : state.strategy;
  return {
    state: {
      ...state,
      phase: "watching",
      phaseRemainingMs: CYCLOPS_WATCH_DURATION_MS,
      flockLocation,
      flockDirection: nextDirection,
      sheepAtBeach: flockLocation === "outside" ? state.sheepCount : 0,
      strategy,
      cycle: state.cycle + 1,
    },
    events: [
      { type: "flock-moved", location: flockLocation, nextDirection },
      { type: "phase-changed", phase: "watching" },
    ],
  };
}

export function escapeFifthFloorMission(
  state: FifthFloorMissionState,
): FifthFloorMissionResult {
  if (state.status !== "active") return { state, events: [] };
  if (state.remainingMs <= 0) return failFifthFloorMission(state, "timeout");
  if (!state.reachedBeach || state.alliesAtBeach < state.alliesRemaining) {
    return { state, events: [] };
  }
  if (state.alliesRemaining < FIFTH_FLOOR_MIN_ESCAPE_ALLIES) {
    return failFifthFloorMission(state, "too-few-survivors");
  }
  return {
    state: { ...state, status: "escaped" },
    events: [{ type: "mission-escaped" }],
  };
}

export function reachFifthFloorBeach(
  state: FifthFloorMissionState,
): FifthFloorMissionResult {
  if (state.status !== "active" || state.reachedBeach) {
    return { state, events: [] };
  }
  return {
    state: { ...state, reachedBeach: true },
    events: [{ type: "beach-reached" }],
  };
}

export function updateFifthFloorAlliesAtBeach(
  state: FifthFloorMissionState,
  count: number,
): FifthFloorMissionResult {
  if (state.status !== "active") return { state, events: [] };
  const alliesAtBeach = Math.max(
    0,
    Math.min(state.alliesRemaining, Math.trunc(count)),
  );
  if (alliesAtBeach === state.alliesAtBeach) return { state, events: [] };
  return { state: { ...state, alliesAtBeach }, events: [] };
}

export function updateFifthFloorSheepAtBeach(
  state: FifthFloorMissionState,
  count: number,
): FifthFloorMissionResult {
  if (state.status !== "active") return { state, events: [] };
  const sheepAtBeach = Math.max(0, Math.min(state.sheepCount, Math.trunc(count)));
  if (sheepAtBeach === state.sheepAtBeach) return { state, events: [] };
  return { state: { ...state, sheepAtBeach }, events: [] };
}

export function loseFifthFloorAllies(
  state: FifthFloorMissionState,
  count: number,
): FifthFloorMissionResult {
  if (state.status !== "active") return { state, events: [] };
  const lost = Math.max(0, Math.min(state.alliesRemaining, Math.trunc(count)));
  if (lost === 0) return { state, events: [] };
  const activeSoldierIds = state.activeSoldierIds.slice(0, -lost);
  const lostIds = state.activeSoldierIds.slice(-lost);
  const alliesRemaining = activeSoldierIds.length;
  const digested = digestFallenSoldiers(
    {
      ...state,
      activeSoldierIds,
      selectedSacrificeIds: state.selectedSacrificeIds.filter((id) =>
        activeSoldierIds.includes(id),
      ),
      alliesRemaining,
      alliesAtBeach: Math.min(state.alliesAtBeach, alliesRemaining),
    },
    lost,
    { lostIds, designatedIds: state.selectedSacrificeIds },
  );
  return {
    state: digested.state,
    events: [{ type: "allies-lost", count: lost }, ...digested.events],
  };
}

export function loseFifthFloorSoldiers(
  state: FifthFloorMissionState,
  soldierIds: readonly number[],
): FifthFloorMissionResult {
  if (state.status !== "active") return { state, events: [] };
  const lostIds = new Set(
    soldierIds.filter((id) => state.activeSoldierIds.includes(id)),
  );
  if (lostIds.size === 0) return { state, events: [] };
  const activeSoldierIds = state.activeSoldierIds.filter(
    (id) => !lostIds.has(id),
  );
  const digested = digestFallenSoldiers(
    {
      ...state,
      activeSoldierIds,
      selectedSacrificeIds: state.selectedSacrificeIds.filter((id) =>
        activeSoldierIds.includes(id),
      ),
      alliesRemaining: activeSoldierIds.length,
      alliesAtBeach: Math.min(state.alliesAtBeach, activeSoldierIds.length),
    },
    lostIds.size,
    { lostIds: [...lostIds], designatedIds: state.selectedSacrificeIds },
  );
  return {
    state: digested.state,
    events: [{ type: "allies-lost", count: lostIds.size }, ...digested.events],
  };
}

// Two soldiers make a full meal. A sated Cyclops always shuts the rock gate
// first and only then lies down — the eye becomes vulnerable again.
function digestFallenSoldiers(
  state: FifthFloorMissionState,
  eaten: number,
  meal?: { lostIds: readonly number[]; designatedIds: readonly number[] },
): FifthFloorMissionResult {
  const soldiersEaten = state.soldiersEaten + eaten;
  if (
    soldiersEaten < CYCLOPS_MEAL_SIZE ||
    state.bossHp <= 0 ||
    state.phase === "sleeping"
  ) {
    return { state: { ...state, soldiersEaten }, events: [] };
  }
  const events: FifthFloorMissionEvent[] = [];
  let next: FifthFloorMissionState = { ...state, soldiersEaten };
  // The boss now hunts the marked pair on sight, so the meal it finishes is
  // usually the designated one. That is the sacrifice succeeding, not a reset.
  const designatedIds = meal?.designatedIds ?? [];
  const sacrificeFulfilled =
    designatedIds.length === CYCLOPS_MEAL_SIZE &&
    designatedIds.every((id) => meal!.lostIds.includes(id));
  if (sacrificeFulfilled) {
    next = { ...next, strategy: "stealth", selectedSacrificeIds: [] };
    events.push({ type: "allies-sacrificed", soldierIds: designatedIds });
  } else if (
    next.strategy === "stealth-selecting" ||
    next.strategy === "stealth-charging"
  ) {
    // Other soldiers completed the meal before the hand-picked pair arrived:
    // the marked two are spared, their designation is cleared, and the boss
    // dozes off regardless.
    next = { ...next, strategy: "pending", selectedSacrificeIds: [] };
    events.push({ type: "sacrifice-reset" });
  }
  const sleeping = beginCyclopsSleep(next);
  return {
    state: sleeping.state,
    events: [...events, { type: "boss-sated" }, ...sleeping.events],
  };
}

export function hitCyclopsWithBasicAttack(
  state: FifthFloorMissionState,
  damage: number,
  aimedAtEye: boolean,
): FifthFloorMissionResult {
  if (state.status !== "active") return { state, events: [] };

  if (
    state.phase === "sleeping" &&
    state.weakPoint === "primed" &&
    aimedAtEye
  ) {
    const hit = damageCyclops(state, Math.max(1, damage * 3));
    if (hit.state.status !== "active" || hit.state.bossHp === 0) {
      // The boss died in its sleep behind a closed gate — damageCyclops has
      // already sealed the mission as failed; no wake-up follows.
      return hit;
    }
    // The stab blinds forever but grants no shortcut: the boss merely wakes
    // and the rock-gate timetable resumes on its own schedule.
    return {
      state: {
        ...hit.state,
        phase: "watching",
        phaseRemainingMs: CYCLOPS_WATCH_DURATION_MS,
        strategy: "pending",
        weakPoint: "blinded",
        weakPointRemainingMs: 0,
      },
      events: [
        ...hit.events,
        { type: "boss-roared" },
        { type: "vision-obscured" },
        { type: "phase-changed", phase: "watching" },
      ],
    };
  }

  return damageCyclops(state, damage);
}

export function hitCyclopsWithSkill(
  state: FifthFloorMissionState,
  damage: number,
): FifthFloorMissionResult {
  if (state.status !== "active") return { state, events: [] };
  return damageCyclops(state, damage);
}

export function failFifthFloorMission(
  state: FifthFloorMissionState,
  reason: FifthFloorFailureReason,
): FifthFloorMissionResult {
  if (state.status !== "active") return { state, events: [] };
  return {
    state: { ...state, status: "failed", failureReason: reason },
    events: [{ type: "mission-failed", reason }],
  };
}

export function isCyclopsAwake(state: FifthFloorMissionState): boolean {
  return (
    state.status === "active" &&
    state.bossHp > 0 &&
    (state.phase === "watching" || state.phase === "gate-open")
  );
}

export function isCyclopsVisionActive(state: FifthFloorMissionState): boolean {
  return (
    isCyclopsAwake(state) &&
    state.phase === "watching" &&
    state.weakPoint !== "blinded"
  );
}

function beginCyclopsSleep(
  state: FifthFloorMissionState,
): FifthFloorMissionResult {
  const alreadyBlinded = state.weakPoint === "blinded";
  return {
    state: {
      ...state,
      phase: "sleeping",
      phaseRemainingMs: CYCLOPS_SLEEP_DURATION_MS,
      soldiersEaten: 0,
      // A pierced eye cannot be primed a second time.
      weakPoint: alreadyBlinded ? "blinded" : "primed",
      weakPointRemainingMs: alreadyBlinded ? 0 : CYCLOPS_SLEEP_DURATION_MS,
    },
    events: [{ type: "phase-changed", phase: "sleeping" }],
  };
}

function damageCyclops(
  state: FifthFloorMissionState,
  rawDamage: number,
): FifthFloorMissionResult {
  const amount = Math.max(0, Math.round(rawDamage));
  if (amount === 0 || state.bossHp <= 0) return { state, events: [] };
  const bossHp = Math.max(0, state.bossHp - amount);
  const events: FifthFloorMissionEvent[] = [
    { type: "boss-damaged", amount, hp: bossHp },
  ];
  let next: FifthFloorMissionState = { ...state, bossHp };
  if (bossHp === 0) {
    next = { ...next, weakPoint: "blinded", weakPointRemainingMs: 0 };
    events.push({ type: "boss-staggered" });
    // Only the Cyclops can move the rock. Downing it while the gate is shut
    // seals the cave for good — the escape is lost, not won.
    if (next.phase !== "gate-open") {
      const failure = failFifthFloorMission(next, "gate-sealed");
      return { state: failure.state, events: [...events, ...failure.events] };
    }
  }
  return { state: next, events };
}
