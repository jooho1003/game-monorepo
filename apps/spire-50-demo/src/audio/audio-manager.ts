import { Howl, Howler } from "howler";
import type { WeaponId } from "../domain/model.js";

export type MusicContext =
  | "title"
  | "select"
  | "rest"
  | "shop"
  | "battle"
  | "boss";

export type SoundEffect =
  | "uiConfirm"
  | "footstep"
  | "weaponSwing"
  | "weaponHit"
  | "magicCast"
  | "monsterAttack"
  | "beetleAttack"
  | "wraithAttack"
  | "giantAlert"
  | "giantAttack"
  | "sheepBaa"
  | "rockGate"
  | "stoneDoor"
  | "pickup";

interface SoundOptions {
  volume?: number;
  rate?: number;
}

interface MusicDefinition {
  src: string;
  volume: number;
}

export const MUSIC_BY_CONTEXT: Record<MusicContext, MusicDefinition> = {
  title: { src: "/assets/audio/music/tower-labyrinth.ogg", volume: 0.13 },
  select: { src: "/assets/audio/music/tower-labyrinth.ogg", volume: 0.16 },
  rest: { src: "/assets/audio/music/rest-sanctuary.ogg", volume: 0.13 },
  shop: { src: "/assets/audio/music/rest-sanctuary.ogg", volume: 0.15 },
  battle: { src: "/assets/audio/music/tower-labyrinth.ogg", volume: 0.21 },
  boss: { src: "/assets/audio/music/cyclops-cavern.ogg", volume: 0.32 },
};

const SFX_SOURCES: Record<SoundEffect, readonly string[]> = {
  uiConfirm: ["/assets/audio/sfx/ui-confirm.wav"],
  footstep: [
    "/assets/audio/sfx/footstep-1.ogg",
    "/assets/audio/sfx/footstep-2.ogg",
  ],
  weaponSwing: [
    "/assets/audio/sfx/weapon-swing-1.wav",
    "/assets/audio/sfx/weapon-swing-2.wav",
    "/assets/audio/sfx/weapon-swing-3.wav",
  ],
  weaponHit: ["/assets/audio/sfx/weapon-hit.wav"],
  magicCast: ["/assets/audio/sfx/magic-cast.wav"],
  monsterAttack: ["/assets/audio/sfx/monster-growl.wav"],
  beetleAttack: ["/assets/audio/sfx/beetle-attack.wav"],
  wraithAttack: ["/assets/audio/sfx/wraith-attack.wav"],
  giantAlert: ["/assets/audio/sfx/giant-alert.wav"],
  giantAttack: ["/assets/audio/sfx/giant-attack.wav"],
  sheepBaa: ["/assets/audio/sfx/sheep-baa.ogg"],
  rockGate: ["/assets/audio/sfx/rock-gate.ogg"],
  stoneDoor: ["/assets/audio/sfx/stone-door.wav"],
  pickup: ["/assets/audio/sfx/pickup-coin.wav"],
};

const SFX_VOLUME: Record<SoundEffect, number> = {
  uiConfirm: 0.34,
  footstep: 0.16,
  weaponSwing: 0.36,
  weaponHit: 0.42,
  magicCast: 0.4,
  monsterAttack: 0.3,
  beetleAttack: 0.28,
  wraithAttack: 0.3,
  giantAlert: 0.58,
  giantAttack: 0.62,
  sheepBaa: 0.2,
  rockGate: 0.48,
  stoneDoor: 0.44,
  pickup: 0.3,
};

let unlocked = false;
let requestedMusic: MusicContext = "title";
let activeMusicSource: string | undefined;
let activeMusic: Howl | undefined;
let variationCounter = 0;
let nextVoiceAt = 0;
const musicCache = new Map<string, Howl>();
const sfxCache = new Map<string, Howl>();

export function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  Howler.volume(0.72);
  void Howler.ctx?.resume();
  syncMusic();
}

export function setMusicContext(context: MusicContext): void {
  requestedMusic = context;
  if (unlocked) syncMusic();
}

export function playSfx(
  effect: SoundEffect,
  options: SoundOptions = {},
): void {
  if (!unlocked) return;
  const sources = SFX_SOURCES[effect];
  const source = sources[variationCounter % sources.length]!;
  variationCounter += 1;
  let howl = sfxCache.get(source);
  if (!howl) {
    howl = new Howl({ src: [source], preload: true, pool: 5 });
    sfxCache.set(source, howl);
  }
  const id = howl.play();
  const pitchStep = ((variationCounter % 5) - 2) * 0.018;
  howl.volume(options.volume ?? SFX_VOLUME[effect], id);
  howl.rate(options.rate ?? 1 + pitchStep, id);
}

export function combatVoiceLine(
  action: "attack" | "skill",
  weaponId: WeaponId,
  index: number,
): string {
  const weaponOffset: Record<WeaponId, number> = {
    longsword: 0,
    dagger: 1,
    shield: 2,
    bow: 1,
    staff: 0,
  };
  const shouts =
    action === "skill"
      ? (["이얍!", "하앗!", "합!"] as const)
      : (["합!", "얍!", "하!"] as const);
  return shouts[(Math.abs(index) + weaponOffset[weaponId]) % shouts.length]!;
}

interface CombatVoiceCandidate {
  name: string;
  lang: string;
}

export function selectMaleKoreanVoice<T extends CombatVoiceCandidate>(
  voices: readonly T[],
): T | undefined {
  const koreanVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith("ko"),
  );
  const maleName =
    /(male|man|남성|injoon|인준|hyunsu|현수|woosik|우식|david|mark|daniel|guy)/i;
  const femaleName = /(female|woman|여성|heami|혜미|sunhi|선희|yuna|유나)/i;
  return (
    koreanVoices.find(
      (voice) => maleName.test(voice.name) && !femaleName.test(voice.name),
    ) ??
    voices.find(
      (voice) => maleName.test(voice.name) && !femaleName.test(voice.name),
    ) ??
    koreanVoices.find((voice) => !femaleName.test(voice.name))
  );
}

export function playCombatVoice(
  action: "attack" | "skill",
  weaponId: WeaponId,
): void {
  if (!unlocked || typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }
  const now = Date.now();
  if (now < nextVoiceAt) return;
  nextVoiceAt = now + (action === "skill" ? 900 : 620);
  const utterance = new SpeechSynthesisUtterance(
    combatVoiceLine(action, weaponId, variationCounter),
  );
  utterance.lang = "ko-KR";
  const maleVoice = selectMaleKoreanVoice(window.speechSynthesis.getVoices());
  if (maleVoice) utterance.voice = maleVoice;
  utterance.rate = action === "skill" ? 1.18 : 1.34;
  utterance.pitch = 0.58;
  utterance.volume = action === "skill" ? 0.72 : 0.52;
  window.speechSynthesis.speak(utterance);
}

function syncMusic(): void {
  const definition = MUSIC_BY_CONTEXT[requestedMusic];
  if (activeMusicSource === definition.src && activeMusic) {
    activeMusic.fade(activeMusic.volume(), definition.volume, 280);
    return;
  }

  const previous = activeMusic;
  if (previous) {
    previous.fade(previous.volume(), 0, 420);
    window.setTimeout(() => previous.pause(), 440);
  }

  let next = musicCache.get(definition.src);
  if (!next) {
    next = new Howl({
      src: [definition.src],
      loop: true,
      preload: true,
      volume: 0,
    });
    musicCache.set(definition.src, next);
  }
  activeMusicSource = definition.src;
  activeMusic = next;
  next.volume(0);
  if (!next.playing()) next.play();
  next.fade(0, definition.volume, 650);
}
