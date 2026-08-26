import { describe, expect, it } from "vitest";
import { skill2DamageMultiplier } from "../domain/engine.js";
import { weaponIds } from "../domain/model.js";
import {
  SKILL2_COOLDOWN_MS,
  SKILL2_DEFINITIONS,
  SKILL2_MANA_COST,
  skill2IconPath,
} from "./skills.js";

describe("skill-2 definitions", () => {
  it("cover every weapon with positive damage and pose duration", () => {
    for (const weapon of weaponIds) {
      const definition = SKILL2_DEFINITIONS[weapon];
      expect(definition.name.length).toBeGreaterThan(0);
      expect(definition.damage).toBeGreaterThan(0);
      expect(definition.poseDurationMs).toBeGreaterThan(200);
      expect(skill2IconPath(weapon)).toBe(
        `/assets/game/hud/skills/${weapon}-skill2-v1.png`,
      );
    }
  });

  it("define a coherent hit range per weapon shape", () => {
    const { longsword, dagger, shield, bow, staff } = SKILL2_DEFINITIONS;

    expect(longsword.shape).toMatchObject({ kind: "radial", radius: 190 });
    expect(dagger.shape).toMatchObject({
      kind: "fan",
      range: 260,
      blades: 5,
    });
    expect(shield.shape).toMatchObject({ kind: "radial", radius: 205 });
    expect(bow.shape).toMatchObject({
      kind: "projectile",
      range: 460,
      blastRadius: 120,
    });
    expect(staff.shape).toMatchObject({ kind: "beam", range: 420, width: 46 });

    // melee-class radii stay tighter than ranged reaches
    expect(longsword.shape.kind === "radial" && longsword.shape.radius).toBeLessThan(
      bow.shape.kind === "projectile" ? bow.shape.range : 0,
    );
  });

  it("share one mana cost and cooldown, with level scaling capped", () => {
    expect(SKILL2_MANA_COST).toBe(35);
    expect(SKILL2_COOLDOWN_MS).toBeGreaterThan(1_000);
    expect(skill2DamageMultiplier(0)).toBe(0);
    expect(skill2DamageMultiplier(1)).toBe(1);
    expect(skill2DamageMultiplier(2)).toBe(1.25);
    expect(skill2DamageMultiplier(3)).toBe(1.5);
    expect(skill2DamageMultiplier(9)).toBe(1.5);
  });
});
