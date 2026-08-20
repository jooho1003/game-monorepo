import { Howler } from "howler";

let unlocked = false;

export function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  Howler.volume(0.7);
}
