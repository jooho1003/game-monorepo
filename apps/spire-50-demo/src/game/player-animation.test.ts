import { describe, expect, it } from "vitest";
import { weaponIds } from "../domain/model.js";
import {
  PLAYER_DIRECTIONS,
  directionFromAxes,
  directionFromAngle,
  playerActionTextureFrame,
  playerActionTextureKey,
  playerLocomotionTextureFrame,
  playerWalkTextureFrame,
} from "./player-animation.js";

describe("player directional action textures", () => {
  it("uses authored attacks and mirrors skills symmetrically on the west side", () => {
    for (const weaponId of weaponIds) {
      expect(playerActionTextureFrame("attack", weaponId, "west", 1)).toEqual({
        key: `player-attack-${weaponId}-west-1`,
        flipX: false,
      });
      expect(playerActionTextureFrame("skill", weaponId, "west", 1)).toEqual({
        key: `player-skill-${weaponId}-east-1`,
        flipX: true,
      });
      expect(
        playerActionTextureFrame("skill", weaponId, "north-west", 1),
      ).toEqual({
        key: `player-skill-${weaponId}-north-east-1`,
        flipX: true,
      });
      expect(
        playerActionTextureFrame("skill", weaponId, "south-west", 1),
      ).toEqual({
        key: `player-skill-${weaponId}-south-east-1`,
        flipX: true,
      });
    }
  });

  it("uses authored skill-2 frames for all 8 directions without mirroring", () => {
    for (const weaponId of weaponIds) {
      for (const direction of PLAYER_DIRECTIONS) {
        expect(
          playerActionTextureFrame("skill2", weaponId, direction, 1),
        ).toEqual({
          key: `player-skill2-${weaponId}-${direction}-1`,
          flipX: false,
        });
      }
    }
  });

  it("keeps attack and skill keys distinct for every weapon", () => {
    expect(playerActionTextureKey("attack", "bow", "east", 1)).toBe(
      "player-attack-bow-east-1",
    );
    expect(playerActionTextureKey("skill", "staff", "north", 1)).toBe(
      "player-skill-staff-north-1",
    );
  });

  it("keeps every authored attack frame unflipped", () => {
    for (const direction of PLAYER_DIRECTIONS) {
      expect(
        playerActionTextureFrame("attack", "shield", direction, 0).flipX,
      ).toBe(false);
    }
  });

  it("uses reciprocal bare walk frames and mirrors west locomotion", () => {
    expect(playerWalkTextureFrame("east", 0)).toEqual({
      key: "player-walk-east-0",
      flipX: false,
    });
    expect(playerWalkTextureFrame("west", 1)).toEqual({
      key: "player-walk-east-1",
      flipX: true,
    });
  });

  it("uses the armed reciprocal gait so the legs visibly alternate", () => {
    expect(playerLocomotionTextureFrame("longsword", "north", 0)).toEqual({
      key: "player-stance-longsword-north-0",
      flipX: false,
    });
    expect(playerLocomotionTextureFrame("longsword", "north", 1)).toEqual({
      key: "player-stance-longsword-north-1",
      flipX: false,
    });
  });

  it("preserves the dash direction when no movement key remains held", () => {
    expect(directionFromAxes(0, 0, "north")).toBe("north");
    expect(directionFromAxes(0, -1, "east")).toBe("north");
  });

  it("maps cursor angles to all authored action directions", () => {
    expect(directionFromAngle(-Math.PI / 2)).toBe("north");
    expect(directionFromAngle(Math.PI)).toBe("west");
    expect(directionFromAngle(Math.PI / 4)).toBe("south-east");
  });
});
