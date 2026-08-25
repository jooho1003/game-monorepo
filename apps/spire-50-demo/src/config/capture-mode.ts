import type { WeaponId } from "../domain/model.js";

export type CaptureScene =
  | "title"
  | "loadout"
  | "dialogue"
  | "rest"
  | "battle"
  | "shop"
  | "boss";

export type CaptureHud = "full" | "clean" | "none";

export interface CaptureSettings {
  enabled: boolean;
  scene: CaptureScene;
  hud: CaptureHud;
  weapon: WeaponId;
  wandererRole: "ally" | "enemy";
}

const CAPTURE_SCENES = new Set<CaptureScene>([
  "title",
  "loadout",
  "dialogue",
  "rest",
  "battle",
  "shop",
  "boss",
]);

const CAPTURE_HUDS = new Set<CaptureHud>(["full", "clean", "none"]);
const WEAPONS = new Set<WeaponId>([
  "longsword",
  "dagger",
  "shield",
  "bow",
  "staff",
]);

export function readCaptureSettings(search: string): CaptureSettings {
  const params = new URLSearchParams(search);
  const scene = params.get("captureScene");
  const hud = params.get("captureHud");
  const weapon = params.get("captureWeapon");

  return {
    enabled: params.get("capture") === "trailer",
    scene: isCaptureScene(scene) ? scene : "title",
    hud: isCaptureHud(hud) ? hud : "clean",
    weapon: isWeaponId(weapon) ? weapon : "longsword",
    wandererRole: params.get("captureRole") === "enemy" ? "enemy" : "ally",
  };
}

export function applyCaptureDocumentMode(
  settings: CaptureSettings,
  documentElement: HTMLElement,
): void {
  if (!settings.enabled) return;
  documentElement.dataset.captureMode = "trailer";
  documentElement.dataset.captureHud = settings.hud;
}

function isCaptureScene(value: string | null): value is CaptureScene {
  return value !== null && CAPTURE_SCENES.has(value as CaptureScene);
}

function isCaptureHud(value: string | null): value is CaptureHud {
  return value !== null && CAPTURE_HUDS.has(value as CaptureHud);
}

function isWeaponId(value: string | null): value is WeaponId {
  return value !== null && WEAPONS.has(value as WeaponId);
}
