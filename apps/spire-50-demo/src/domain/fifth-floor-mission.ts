export const FIFTH_FLOOR_MISSION_DURATION_MS = 300_000;
export const CYCLOPS_WATCH_DURATION_MS = 15_000;
export const CYCLOPS_SLEEP_DURATION_MS = 15_000;
export const CYCLOPS_GATE_OPEN_DURATION_MS = 30_000;
export const FIFTH_FLOOR_ALLY_COUNT = 15;
export const FIFTH_FLOOR_SHEEP_COUNT = 20;
export const CYCLOPS_MEAL_SIZE = 2;
export const CYCLOPS_MAX_HP = 1_200;
export const CYCLOPS_BLINDED_DURATION_MS = 8_000;

export type FifthFloorPhase = "watching" | "sleeping" | "gate-open";
export type FlockLocation = "inside" | "outside";
export type FlockDirection = "out" | "in";
export type FifthFloorStrategy =
  | "pending"
  | "stealth-selecting"
  | "stealth-charging"
  | "stealth"
  | "fighting";
export type FifthFloorMissionStatus = "active" | "escaped" | "failed";
export type FifthFloorFailureReason = "timeout" | "spotted";
export type CyclopsWeakPoint = "dormant" | "primed" | "blinded";

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
  | { type: "phase-changed"; phase: FifthFloorPhase }
  | {
      type: "flock-moved";
      location: FlockLocation;
      nextDirection: FlockDirection;
    }
  | { type: "mission-escaped" }
  | { type: "mission-failed"; reason: FifthFloorFailureReason }
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
    strategy: "pending",
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
    state.phase !== "watching" ||
    state.strategy !== "pending"
  ) {
    return { state, events: [] };
  }

  if (!stealth) {
    return {
      state: {
        ...state,
        strategy: "fighting",
        phaseRemainingMs: CYCLOPS_WATCH_DURATION_MS,
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

export function toggleFifthFloorSacrifice(
  state: FifthFloorMissionState,
  soldierId: number,
): FifthFloorMissionResult {
  if (
    state.status !== "active" ||
    state.phase !== "watching" ||
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
    state.phase !== "watching" ||
    state.strategy !== "stealth-selecting" ||
    state.selectedSacrificeIds.length !== CYCLOPS_MEAL_SIZE
  ) {
    return { state, events: [] };
  }
  return {
    state: {
      ...state,
      strategy: "stealth-charging",
      phaseRemainingMs: CYCLOPS_WATCH_DURATION_MS,
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
    state.phase !== "watching" ||
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
    if (
      current.phase === "watching" &&
      current.strategy !== "fighting"
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

    if (current.weakPointRemainingMs <= 0 && current.weakPoint === "blinded") {
      current = {
        ...current,
        weakPoint: "dormant",
        weakPointRemainingMs: 0,
      };
    }

    if (current.phaseRemainingMs > 0) break;

    if (current.phase === "watching") {
      if (current.strategy === "fighting") {
        if (current.alliesRemaining > 0) {
          current = {
            ...current,
            phaseRemainingMs: CYCLOPS_WATCH_DURATION_MS,
          };
          continue;
        }
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
      strategy: "pending",
      selectedSacrificeIds: [],
      cycle: current.cycle + 1,
      alliesAtBeach: 0,
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
  if (!state.reachedBeach || state.alliesAtBeach < state.alliesRemaining) {
    return { state, events: [] };
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

export function loseFifthFloorAllies(
  state: FifthFloorMissionState,
  count: number,
): FifthFloorMissionResult {
  if (state.status !== "active") return { state, events: [] };
  const lost = Math.max(0, Math.min(state.alliesRemaining, Math.trunc(count)));
  if (lost === 0) return { state, events: [] };
  const activeSoldierIds = state.activeSoldierIds.slice(0, -lost);
  const alliesRemaining = activeSoldierIds.length;
  return {
    state: {
      ...state,
      activeSoldierIds,
      selectedSacrificeIds: state.selectedSacrificeIds.filter((id) =>
        activeSoldierIds.includes(id),
      ),
      alliesRemaining,
      alliesAtBeach: Math.min(state.alliesAtBeach, alliesRemaining),
    },
    events: [{ type: "allies-lost", count: lost }],
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
  return {
    state: {
      ...state,
      activeSoldierIds,
      selectedSacrificeIds: state.selectedSacrificeIds.filter((id) =>
        activeSoldierIds.includes(id),
      ),
      alliesRemaining: activeSoldierIds.length,
      alliesAtBeach: Math.min(state.alliesAtBeach, activeSoldierIds.length),
    },
    events: [{ type: "allies-lost", count: lostIds.size }],
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
    const defeated = hit.state.bossHp === 0;
    return {
      state: {
        ...hit.state,
        phase: "gate-open",
        phaseRemainingMs: defeated
          ? CYCLOPS_GATE_OPEN_DURATION_MS
          : CYCLOPS_BLINDED_DURATION_MS,
        weakPoint: "blinded",
        weakPointRemainingMs: defeated
          ? CYCLOPS_GATE_OPEN_DURATION_MS
          : CYCLOPS_BLINDED_DURATION_MS,
      },
      events: [
        ...hit.events,
        { type: "vision-obscured", durationMs: CYCLOPS_BLINDED_DURATION_MS },
        ...(defeated
          ? []
          : ([{ type: "phase-changed", phase: "gate-open" }] as const)),
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
): FifthFloorMissionResult {
  return {
    state: {
      ...state,
      phase: "sleeping",
      phaseRemainingMs: CYCLOPS_SLEEP_DURATION_MS,
      weakPoint: "primed",
      weakPointRemainingMs: CYCLOPS_SLEEP_DURATION_MS,
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
