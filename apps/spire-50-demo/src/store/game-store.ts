import { create } from "zustand";
import {
  readCaptureSettings,
  type CaptureSettings,
} from "../config/capture-mode.js";
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
    | { id: number; type: "revoke-strategy" }
    | null;
  dispatch: (command: GameCommand) => void;
  clearEvents: () => void;
  setFifthFloorMission: (mission: FifthFloorMissionState | null) => void;
  requestFifthFloorStrategy: (stealth: boolean) => void;
  requestFifthFloorSacrificeToggle: (soldierId: number) => void;
  requestFifthFloorSacrificeCharge: () => void;
  requestFifthFloorStrategyRevoke: () => void;
  clearFifthFloorCommandRequest: () => void;
}

const initialEnvelope = readSave();
const restoredSnapshot = initialEnvelope
  ? { ...initialEnvelope.snapshot, screen: "title" as const }
  : createInitialSnapshot();
const captureSettings =
  typeof window === "undefined"
    ? readCaptureSettings("")
    : readCaptureSettings(window.location.search);
const initialSnapshot = createDevelopmentSnapshot(
  restoredSnapshot,
  captureSettings,
);

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
  requestFifthFloorStrategyRevoke: () =>
    set((state) => ({
      fifthFloorCommandRequest: {
        id: (state.fifthFloorCommandRequest?.id ?? 0) + 1,
        type: "revoke-strategy",
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

function createDevelopmentSnapshot(
  snapshot: GameSnapshot,
  settings: CaptureSettings,
): GameSnapshot {
  if (import.meta.env.DEV && settings.enabled) {
    return createCaptureSnapshot(settings);
  }
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

function createCaptureSnapshot(settings: CaptureSettings): GameSnapshot {
  const base: GameSnapshot = {
    ...createInitialSnapshot(),
    highestFloor: 5,
    weapon: settings.weapon,
    seed: 2_604_052,
    wandererRole: settings.wandererRole,
  };

  switch (settings.scene) {
    case "title":
      return base;
    case "loadout":
      return {
        ...base,
        screen: "select",
        notice: "등반에 사용할 무기를 선택하세요.",
      };
    case "dialogue":
      return {
        ...base,
        screen: "game",
        dialogueOpen: true,
        objective: "탑 관리자의 이야기를 들으세요.",
        notice: "탑의 모든 만남은 선택이 됩니다.",
      };
    case "rest":
      return {
        ...base,
        screen: "game",
        skillUnlocked: true,
        objective: "다음 층의 시련을 준비하세요.",
        notice: "휴식처에서 장비와 상태를 정비할 수 있습니다.",
      };
    case "battle":
      return {
        ...base,
        screen: "game",
        zone: "battle",
        skillUnlocked: true,
        objective: "적을 돌파하고 전리품을 회수하세요.",
        notice:
          settings.wandererRole === "ally"
            ? "방랑자가 전투에 합류했습니다."
            : "방랑자가 적으로 돌아섰습니다.",
      };
    case "shop":
      return {
        ...base,
        screen: "game",
        zone: "shop",
        skillUnlocked: true,
        gold: 120,
        hp: 58,
        objective: "다음 전투를 위한 보급품을 준비하세요.",
        notice: "탑의 상점은 매 층 새로운 선택을 제공합니다.",
      };
    case "boss":
      return {
        ...base,
        screen: "game",
        zone: "battle",
        floor: 5,
        skillUnlocked: true,
        objective: "외눈박이의 시야를 피해 바위문을 돌파하세요.",
        notice: "병사들과 함께 탈출 전략을 선택하세요.",
      };
  }
}
