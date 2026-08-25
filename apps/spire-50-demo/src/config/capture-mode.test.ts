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
    });
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
    });
  });
});
