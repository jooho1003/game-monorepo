import { create } from "zustand";
import { createInitialSnapshot, transition } from "../domain/engine.js";
import {
  saveEnvelopeSchema,
  type CommandRecord,
  type GameCommand,
  type GameEvent,
  type GameSnapshot,
  type SaveEnvelope,
} from "../domain/model.js";
import type { FifthFloorMissionState } from "../domain/fifth-floor-mission.js";

const SAVE_KEY = "spire-50-demo.save.v1";
const MAX_COMMANDS = 500;

interface GameStore {
  snapshot: GameSnapshot;
  events: GameEvent[];
  commandHistory: CommandRecord[];
  fifthFloorMission: FifthFloorMissionState | null;
  fifthFloorCommandRequest:
    | { id: number; type: "strategy"; stealth: boolean }
    | { id: number; type: "toggle-sacrifice"; soldierId: number }
    | { id: number; type: "confirm-sacrifice" }
    | null;
  dispatch: (command: GameCommand) => void;
  clearEvents: () => void;
  setFifthFloorMission: (mission: FifthFloorMissionState | null) => void;
  requestFifthFloorStrategy: (stealth: boolean) => void;
  requestFifthFloorSacrificeToggle: (soldierId: number) => void;
  requestFifthFloorSacrificeCharge: () => void;
  clearFifthFloorCommandRequest: () => void;
}

const initialEnvelope = readSave();
const restoredSnapshot = initialEnvelope
  ? { ...initialEnvelope.snapshot, screen: "title" as const }
  : createInitialSnapshot();
const initialSnapshot = createDevelopmentSnapshot(restoredSnapshot);

export const useGameStore = create<GameStore>((set, get) => ({
  snapshot: initialSnapshot,
  events: [],
  commandHistory: initialEnvelope?.commandHistory ?? [],
  fifthFloorMission: null,
  fifthFloorCommandRequest: null,
  dispatch: (command) => {
    const state = get();
    const result = transition(state.snapshot, command);
    const commandHistory =
      command.type === "RECOVER_RESOURCES"
        ? state.commandHistory
        : [
            ...state.commandHistory,
            { type: command.type, at: Date.now() },
          ].slice(-MAX_COMMANDS);

    set({
      snapshot: result.snapshot,
      events: [...state.events, ...result.events].slice(-40),
      commandHistory,
    });

    writeSave({
      saveVersion: 1,
      snapshot: result.snapshot,
      commandHistory,
    });
  },
  clearEvents: () => set({ events: [] }),
  setFifthFloorMission: (fifthFloorMission) => set({ fifthFloorMission }),
  requestFifthFloorStrategy: (stealth) =>
    set((state) => ({
      fifthFloorCommandRequest: {
        id: (state.fifthFloorCommandRequest?.id ?? 0) + 1,
        type: "strategy",
        stealth,
      },
    })),
  requestFifthFloorSacrificeToggle: (soldierId) =>
    set((state) => ({
      fifthFloorCommandRequest: {
        id: (state.fifthFloorCommandRequest?.id ?? 0) + 1,
        type: "toggle-sacrifice",
        soldierId,
      },
    })),
  requestFifthFloorSacrificeCharge: () =>
    set((state) => ({
      fifthFloorCommandRequest: {
        id: (state.fifthFloorCommandRequest?.id ?? 0) + 1,
        type: "confirm-sacrifice",
      },
    })),
  clearFifthFloorCommandRequest: () => set({ fifthFloorCommandRequest: null }),
}));

function readSave(): SaveEnvelope | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem(SAVE_KEY);
  if (!raw) return undefined;

  try {
    return saveEnvelopeSchema.parse(JSON.parse(raw));
  } catch {
    window.localStorage.setItem(`${SAVE_KEY}.invalid`, raw);
    window.localStorage.removeItem(SAVE_KEY);
    return undefined;
  }
}

function writeSave(envelope: SaveEnvelope): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(envelope));
}

function createDevelopmentSnapshot(snapshot: GameSnapshot): GameSnapshot {
  if (
    typeof window === "undefined" ||
    !import.meta.env.DEV ||
    new URLSearchParams(window.location.search).get("debugFloor") !== "5"
  ) {
    return snapshot;
  }
  return {
    ...createInitialSnapshot(),
    screen: "game",
    zone: "battle",
    floor: 5,
    highestFloor: 5,
    seed: 5,
    skillUnlocked: true,
    dialogueOpen: false,
    objective: "외눈박이의 시야를 막고 바위문 너머 바닷가 게이트로 탈출하세요.",
    notice: "개발 검증용 5층 직접 진입",
  };
}
