export const FIFTH_FLOOR_MISSION_DURATION_MS = 300_000;
export const CYCLOPS_WATCH_DURATION_MS = 15_000;
export const CYCLOPS_SLEEP_DURATION_MS = 15_000;
export const CYCLOPS_GATE_OPEN_DURATION_MS = 30_000;
export const FIFTH_FLOOR_ALLY_COUNT = 15;
export const FIFTH_FLOOR_SHEEP_COUNT = 20;
export const CYCLOPS_MEAL_SIZE = 2;
export const CYCLOPS_MAX_HP = 1_200;
export const CYCLOPS_EYE_EXPOSED_DURATION_MS = 4_000;
export const CYCLOPS_BLINDED_DURATION_MS = 8_000;

export type FifthFloorPhase = "watching" | "sleeping" | "gate-open";
export type FlockLocation = "inside" | "outside";
export type FlockDirection = "out" | "in";
export type SacrificeDecision = "pending" | "accepted" | "fighting";
export type FifthFloorMissionStatus = "active" | "escaped" | "failed";
export type FifthFloorFailureReason = "timeout" | "spotted";
export type CyclopsWeakPoint =
  | "dormant"
  | "primed"
  | "exposed"
  | "blinded";

export interface FifthFloorMissionState {
  status: FifthFloorMissionStatus;
  failureReason: FifthFloorFailureReason | null;
  remainingMs: number;
  phase: FifthFloorPhase;
  phaseRemainingMs: number;
  alliesRemaining: number;
  sheepCount: number;
  flockLocation: FlockLocation;
  flockDirection: FlockDirection;
  sacrificeDecision: SacrificeDecision;
  cycle: number;
  bossHp: number;
  bossMaxHp: number;
  weakPoint: CyclopsWeakPoint;
  weakPointRemainingMs: number;
  reachedBeach: boolean;
}

export type FifthFloorMissionEvent =
  | { type: "allies-sacrificed"; count: number; voluntary: boolean }
  | { type: "phase-changed"; phase: FifthFloorPhase }
  | {
      type: "flock-moved";
      location: FlockLocation;
      nextDirection: FlockDirection;
    }
  | { type: "mission-escaped" }
  | { type: "mission-failed"; reason: FifthFloorFailureReason }
  | { type: "weak-point-exposed" }
  | { type: "vision-obscured"; durationMs: number }
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
    alliesRemaining: FIFTH_FLOOR_ALLY_COUNT,
    sheepCount: FIFTH_FLOOR_SHEEP_COUNT,
    flockLocation: "inside",
    flockDirection: "out",
    sacrificeDecision: "pending",
    cycle: 1,
    bossHp: CYCLOPS_MAX_HP,
    bossMaxHp: CYCLOPS_MAX_HP,
    weakPoint: "dormant",
    weakPointRemainingMs: 0,
    reachedBeach: false,
  };
}

export function chooseFifthFloorSacrifice(
  state: FifthFloorMissionState,
  accept: boolean,
): FifthFloorMissionResult {
  if (
    state.status !== "active" ||
    state.phase !== "watching" ||
    state.sacrificeDecision !== "pending"
  ) {
    return { state, events: [] };
  }

  if (!accept) {
    return {
      state: { ...state, sacrificeDecision: "fighting" },
      events: [],
    };
  }

  return beginCyclopsSleep(state, true);
}

export function advanceFifthFloorMission(
  state: FifthFloorMissionState,
  elapsedMs: number,
): FifthFloorMissionResult {
  if (
    state.status !== "active" ||
    !Number.isFinite(elapsedMs) ||
    elapsedMs <= 0
  ) {
    return { state, events: [] };
  }

  let current = state;
  let unconsumedMs = elapsedMs;
  const events: FifthFloorMissionEvent[] = [];

  while (unconsumedMs > 0 && current.status === "active") {
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

    if (
      current.weakPointRemainingMs <= 0 &&
      (current.weakPoint === "exposed" || current.weakPoint === "blinded")
    ) {
      current = {
        ...current,
        weakPoint: "dormant",
        weakPointRemainingMs: 0,
      };
    }

    if (current.phaseRemainingMs > 0) break;

    if (current.phase === "watching") {
      if (current.sacrificeDecision === "fighting") {
        current = {
          ...current,
          phase: "gate-open",
          phaseRemainingMs: CYCLOPS_GATE_OPEN_DURATION_MS,
        };
        events.push({ type: "phase-changed", phase: "gate-open" });
        continue;
      }
      const sleep = beginCyclopsSleep(current, false);
      current = sleep.state;
      events.push(...sleep.events);
      continue;
    }

    if (current.phase === "sleeping") {
      current = {
        ...current,
        phase: "gate-open",
        phaseRemainingMs: CYCLOPS_GATE_OPEN_DURATION_MS,
        weakPoint: "dormant",
        weakPointRemainingMs: 0,
      };
      events.push({ type: "phase-changed", phase: "gate-open" });
      continue;
    }

    const flockLocation: FlockLocation =
      current.flockDirection === "out" ? "outside" : "inside";
    const nextDirection: FlockDirection =
      current.flockDirection === "out" ? "in" : "out";
    current = {
      ...current,
      phase: "watching",
      phaseRemainingMs: CYCLOPS_WATCH_DURATION_MS,
      flockLocation,
      flockDirection: nextDirection,
      sacrificeDecision: "pending",
      cycle: current.cycle + 1,
    };
    events.push(
      { type: "flock-moved", location: flockLocation, nextDirection },
      { type: "phase-changed", phase: "watching" },
    );
  }

  return { state: current, events };
}

export function escapeFifthFloorMission(
  state: FifthFloorMissionState,
): FifthFloorMissionResult {
  if (state.status !== "active") return { state, events: [] };
  if (state.remainingMs <= 0) return failFifthFloorMission(state, "timeout");
  if (!state.reachedBeach) return { state, events: [] };
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

export function hitCyclopsWithBasicAttack(
  state: FifthFloorMissionState,
  damage: number,
  aimedAtEye: boolean,
): FifthFloorMissionResult {
  if (state.status !== "active") return { state, events: [] };

  if (state.phase === "sleeping" && state.weakPoint === "primed") {
    return {
      state: {
        ...state,
        phase: "watching",
        phaseRemainingMs: CYCLOPS_WATCH_DURATION_MS,
        weakPoint: "exposed",
        weakPointRemainingMs: CYCLOPS_EYE_EXPOSED_DURATION_MS,
      },
      events: [
        { type: "phase-changed", phase: "watching" },
        { type: "weak-point-exposed" },
      ],
    };
  }

  if (state.weakPoint === "exposed" && aimedAtEye) {
    const hit = damageCyclops(state, Math.max(1, damage * 3));
    return {
      state: {
        ...hit.state,
        weakPoint: "blinded",
        weakPointRemainingMs: CYCLOPS_BLINDED_DURATION_MS,
      },
      events: [
        ...hit.events,
        { type: "vision-obscured", durationMs: CYCLOPS_BLINDED_DURATION_MS },
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
  return state.status === "active" && state.phase === "watching";
}

export function isCyclopsVisionActive(state: FifthFloorMissionState): boolean {
  return isCyclopsAwake(state) && state.weakPoint !== "blinded";
}

function beginCyclopsSleep(
  state: FifthFloorMissionState,
  voluntary: boolean,
): FifthFloorMissionResult {
  const count = Math.min(CYCLOPS_MEAL_SIZE, state.alliesRemaining);
  return {
    state: {
      ...state,
      phase: "sleeping",
      phaseRemainingMs: CYCLOPS_SLEEP_DURATION_MS,
      alliesRemaining: state.alliesRemaining - count,
      sacrificeDecision: voluntary ? "accepted" : state.sacrificeDecision,
      weakPoint: "primed",
      weakPointRemainingMs: CYCLOPS_SLEEP_DURATION_MS,
    },
    events: [
      { type: "allies-sacrificed", count, voluntary },
      { type: "phase-changed", phase: "sleeping" },
    ],
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
    next = {
      ...next,
      phase: "gate-open",
      phaseRemainingMs: CYCLOPS_GATE_OPEN_DURATION_MS,
      weakPoint: "blinded",
      weakPointRemainingMs: CYCLOPS_GATE_OPEN_DURATION_MS,
    };
    events.push(
      { type: "boss-staggered" },
      { type: "phase-changed", phase: "gate-open" },
    );
  }
  return { state: next, events };
}
