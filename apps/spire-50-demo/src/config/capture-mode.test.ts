import { describe, expect, it } from "vitest";
import { readCaptureSettings } from "./capture-mode.js";

describe("readCaptureSettings", () => {
  it("uses trailer-safe defaults", () => {
    expect(readCaptureSettings("?capture=trailer")).toEqual({
      enabled: true,
      scene: "title",
      hud: "clean",
      weapon: "longsword",
      wandererRole: "ally",
      skill2Level: 0,
    });
  });

  it("accepts supported scene controls", () => {
    expect(
      readCaptureSettings(
        "?capture=trailer&captureScene=boss&captureHud=none&captureWeapon=staff&captureRole=enemy",
      ),
    ).toEqual({
      enabled: true,
      scene: "boss",
      hud: "none",
      weapon: "staff",
      wandererRole: "enemy",
      skill2Level: 0,
    });
  });

  it("clamps the captureSkill2 level into the valid range", () => {
    expect(
      readCaptureSettings("?capture=trailer&captureSkill2=2").skill2Level,
    ).toBe(2);
    expect(
      readCaptureSettings("?capture=trailer&captureSkill2=9").skill2Level,
    ).toBe(3);
    expect(
      readCaptureSettings("?capture=trailer&captureSkill2=-1").skill2Level,
    ).toBe(0);
    expect(
      readCaptureSettings("?capture=trailer&captureSkill2=abc").skill2Level,
    ).toBe(0);
  });

  it("rejects unsupported capture values", () => {
    expect(
      readCaptureSettings(
        "?capture=yes&captureScene=credits&captureHud=tiny&captureWeapon=axe",
      ),
    ).toEqual({
      enabled: false,
      scene: "title",
      hud: "clean",
      weapon: "longsword",
      wandererRole: "ally",
      skill2Level: 0,
    });
  });
});
