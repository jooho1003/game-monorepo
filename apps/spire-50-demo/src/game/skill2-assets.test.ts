import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { weaponIds } from "../domain/model.js";
import { PLAYER_DIRECTIONS } from "./player-animation.js";

const ASSETS = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../public/assets",
);
const SPRITE_SIZE = 112;

interface DecodedPng {
  width: number;
  height: number;
  channels: number;
  pixels: Uint8Array;
}

function decodePng(path: string): DecodedPng {
  const buffer = readFileSync(path);
  expect(buffer.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8]!;
      colorType = data[9]!;
      expect(data[12]).toBe(0); // no interlace
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  expect(bitDepth).toBe(8);
  expect([2, 6]).toContain(colorType);
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = new Uint8Array(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!;
    const rowStart = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[rowStart + x]!;
      const left = x >= channels ? pixels[y * stride + x - channels]! : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x]! : 0;
      const upLeft =
        y > 0 && x >= channels
          ? pixels[(y - 1) * stride + x - channels]!
          : 0;
      let reconstructed: number;
      switch (filter) {
        case 0:
          reconstructed = value;
          break;
        case 1:
          reconstructed = value + left;
          break;
        case 2:
          reconstructed = value + up;
          break;
        case 3:
          reconstructed = value + Math.floor((left + up) / 2);
          break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          const paeth = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
          reconstructed = value + paeth;
          break;
        }
        default:
          throw new Error(`unsupported PNG filter ${filter}`);
      }
      pixels[y * stride + x] = reconstructed & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

function spritePath(kind: "skill" | "skill2", weapon: string, name: string) {
  return join(ASSETS, `game/world/player-v2/${kind}/${weapon}/${name}.png`);
}

describe("skill-2 motion sprites", () => {
  it("exist for every weapon in all 8 directions with a uniform size", () => {
    for (const weapon of weaponIds) {
      for (const direction of PLAYER_DIRECTIONS) {
        for (const frame of [0, 1] as const) {
          const png = decodePng(
            spritePath("skill2", weapon, `${direction}-${frame}`),
          );
          expect(png.width, `${weapon}/${direction}-${frame}`).toBe(
            SPRITE_SIZE,
          );
          expect(png.height, `${weapon}/${direction}-${frame}`).toBe(
            SPRITE_SIZE,
          );
          expect(png.channels).toBe(4);
        }
      }
    }
  });

  it("keeps the exact skill-1 character pose per direction (direction accuracy)", () => {
    for (const weapon of weaponIds) {
      for (const direction of PLAYER_DIRECTIONS) {
        for (const frame of [0, 1] as const) {
          const source = decodePng(
            spritePath("skill", weapon, `${direction}-${frame}`),
          );
          const derived = decodePng(
            spritePath("skill2", weapon, `${direction}-${frame}`),
          );
          expect(derived.width).toBe(source.width);
          expect(derived.height).toBe(source.height);
          // Every solid character pixel of the source pose must remain
          // solid in the skill-2 sprite: the aura only adds pixels, it
          // never moves or erases the pose, so the direction cannot drift.
          let solid = 0;
          let preserved = 0;
          for (let i = 0; i < source.width * source.height; i += 1) {
            if (source.pixels[i * 4 + 3]! > 200) {
              solid += 1;
              if (derived.pixels[i * 4 + 3]! > 200) preserved += 1;
            }
          }
          expect(solid).toBeGreaterThan(400);
          expect(preserved / solid, `${weapon}/${direction}-${frame}`,
          ).toBeGreaterThan(0.995);
        }
      }
    }
  });

  it("renders 8 distinct directional poses per weapon", () => {
    for (const weapon of weaponIds) {
      for (const frame of [0, 1] as const) {
        const signatures = new Set<string>();
        for (const direction of PLAYER_DIRECTIONS) {
          const png = decodePng(
            spritePath("skill2", weapon, `${direction}-${frame}`),
          );
          let hash = 0n;
          for (let i = 0; i < png.width * png.height; i += 1) {
            if (png.pixels[i * 4 + 3]! > 200) {
              hash = (hash * 131n + BigInt(i)) % 1_000_000_007n;
            }
          }
          signatures.add(hash.toString());
        }
        expect(signatures.size, `${weapon} frame ${frame}`).toBe(
          PLAYER_DIRECTIONS.length,
        );
      }
    }
  });
});

describe("skill-2 icons", () => {
  it("exist for every weapon as square PNGs", () => {
    for (const weapon of weaponIds) {
      const png = decodePng(
        join(ASSETS, `game/hud/skills/${weapon}-skill2-v1.png`),
      );
      expect(png.width).toBeGreaterThanOrEqual(256);
      expect(png.width).toBe(png.height);
    }
  });
});

describe("skill-2 cast sounds", () => {
  it("are valid 44.1kHz PCM WAV files for every weapon", () => {
    for (const weapon of weaponIds) {
      const wav = readFileSync(
        join(ASSETS, `audio/sfx/skill2-${weapon}.wav`),
      );
      expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
      expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
      expect(wav.readUInt32LE(24)).toBe(44_100);
      expect(wav.length).toBeGreaterThan(20_000);
    }
  });
});
