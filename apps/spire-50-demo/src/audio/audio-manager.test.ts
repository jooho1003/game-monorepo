import { describe, expect, it } from "vitest";
import {
  MUSIC_BY_CONTEXT,
  combatVoiceLine,
  selectMaleKoreanVoice,
} from "./audio-manager.js";

describe("game audio contexts", () => {
  it("never reuses the rest-area BGM in a combat area", () => {
    expect(MUSIC_BY_CONTEXT.rest.src).not.toBe(MUSIC_BY_CONTEXT.battle.src);
    expect(MUSIC_BY_CONTEXT.rest.src).not.toBe(MUSIC_BY_CONTEXT.boss.src);
  });

  it("uses short Korean combat shouts for attacks and skills", () => {
    const lines = [
      combatVoiceLine("skill", "longsword", 0),
      combatVoiceLine("skill", "dagger", 0),
      combatVoiceLine("skill", "shield", 0),
      combatVoiceLine("attack", "longsword", 0),
    ];
    expect(lines).toEqual(["이얍!", "하앗!", "합!", "합!"]);
  });

  it("prefers a Korean male voice and rejects a named female fallback", () => {
    const voices = [
      { name: "Microsoft Heami", lang: "ko-KR" },
      { name: "Microsoft InJoon Online", lang: "ko-KR" },
      { name: "David", lang: "en-US" },
    ];
    expect(selectMaleKoreanVoice(voices)?.name).toBe(
      "Microsoft InJoon Online",
    );
    expect(selectMaleKoreanVoice([voices[0]!, voices[2]!])?.name).toBe(
      "David",
    );
  });
});
