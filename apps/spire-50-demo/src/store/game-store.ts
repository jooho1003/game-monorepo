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

const SAVE_KEY = "spire-50-demo.save.v1";
const MAX_COMMANDS = 500;

interface GameStore {
  snapshot: GameSnapshot;
  events: GameEvent[];
  commandHistory: CommandRecord[];
  dispatch: (command: GameCommand) => void;
  clearEvents: () => void;
}

const initialEnvelope = readSave();

export const useGameStore = create<GameStore>((set, get) => ({
  snapshot: initialEnvelope?.snapshot ?? createInitialSnapshot(),
  events: [],
  commandHistory: initialEnvelope?.commandHistory ?? [],
  dispatch: (command) => {
    const state = get();
    const result = transition(state.snapshot, command);
    const commandHistory = [
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
