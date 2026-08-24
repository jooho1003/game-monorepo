import { describe, expect, it } from "vitest";
import { MUSIC_BY_CONTEXT, combatVoiceLine } from "./audio-manager.js";

describe("game audio contexts", () => {
  it("never reuses the rest-area BGM in a combat area", () => {
    expect(MUSIC_BY_CONTEXT.rest.src).not.toBe(MUSIC_BY_CONTEXT.battle.src);
    expect(MUSIC_BY_CONTEXT.rest.src).not.toBe(MUSIC_BY_CONTEXT.boss.src);
  });

  it("has a distinct spoken line for every skill", () => {
    const lines = [
      combatVoiceLine("skill", "longsword", 0),
      combatVoiceLine("skill", "dagger", 0),
      combatVoiceLine("skill", "shield", 0),
      combatVoiceLine("skill", "bow", 0),
      combatVoiceLine("skill", "staff", 0),
    ];
    expect(new Set(lines).size).toBe(5);
  });
});
