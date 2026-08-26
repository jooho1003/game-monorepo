import { describe, expect, it } from "vitest";
import { weaponIds } from "../domain/model.js";
import {
  SECOND_SKILL_COMBAT,
  WEAPON_COMBAT,
  THIRD_SKILL_COMBAT,
  circleHitsCircle,
  circleHitsCone,
  circleHitsSegment,
} from "./weapon-combat.js";

describe("weapon combat profiles", () => {
  it("defines distinct positive reach and hit geometry for every weapon", () => {
    for (const weaponId of weaponIds) {
      const profile = WEAPON_COMBAT[weaponId];
      expect(profile.range).toBeGreaterThan(0);
      expect(profile.damage).toBeGreaterThan(0);
      expect(profile.cooldown).toBeGreaterThan(0);
      const secondSkill = SECOND_SKILL_COMBAT[weaponId];
      expect(secondSkill.range).toBeGreaterThan(0);
      expect(secondSkill.damage).toBeGreaterThan(profile.damage);
      expect(secondSkill.cooldown).toBeGreaterThan(profile.cooldown);
      const thirdSkill = THIRD_SKILL_COMBAT[weaponId];
      expect(thirdSkill.range).toBeGreaterThan(0);
      expect(thirdSkill.damage).toBeGreaterThan(profile.damage);
      expect(thirdSkill.cooldown).toBeGreaterThan(profile.cooldown);
      expect(thirdSkill.damage).toBeGreaterThan(secondSkill.damage);
    }
    expect(WEAPON_COMBAT.bow.range).toBeGreaterThan(WEAPON_COMBAT.staff.range);
    expect(WEAPON_COMBAT.staff.range).toBeGreaterThan(
      WEAPON_COMBAT.longsword.range,
    );
    expect(WEAPON_COMBAT.longsword.range).toBeGreaterThan(
      WEAPON_COMBAT.dagger.range,
    );
    expect(WEAPON_COMBAT.dagger.range).toBeGreaterThan(
      WEAPON_COMBAT.shield.range,
    );
  });

  it("counts a visible target body touching an arrow path as a hit", () => {
    const bow = WEAPON_COMBAT.bow;
    expect(
      circleHitsSegment(
        { x: 250, y: 34, radius: 24 },
        0,
        0,
        bow.range,
        0,
        bow.hitRadius,
      ),
    ).toBe(true);
    expect(
      circleHitsSegment(
        { x: 250, y: 36, radius: 24 },
        0,
        0,
        bow.range,
        0,
        bow.hitRadius,
      ),
    ).toBe(false);
  });

  it("includes target radius at the end of line, cone, and impact attacks", () => {
    expect(
      circleHitsSegment({ x: 108, y: 0, radius: 18 }, 0, 0, 92, 0, 0),
    ).toBe(true);
    expect(
      circleHitsCone({ x: 120, y: 10, radius: 18 }, 0, 0, 0, 105, 0.2),
    ).toBe(true);
    expect(circleHitsCircle({ x: 75, y: 0, radius: 20 }, 0, 0, 56)).toBe(true);
  });
});
