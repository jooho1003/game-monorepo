import { z } from "zod";

export const weaponIds = [
  "longsword",
  "dagger",
  "shield",
  "bow",
  "staff",
] as const;

export const screenSchema = z.enum(["title", "select", "game"]);
export const zoneSchema = z.enum(["rest", "battle", "shop"]);
export const weaponSchema = z.enum(weaponIds);
export const wandererRoleSchema = z.enum(["ally", "enemy"]);

export type ScreenId = z.infer<typeof screenSchema>;
export type ZoneId = z.infer<typeof zoneSchema>;
export type WeaponId = z.infer<typeof weaponSchema>;
export type WandererRole = z.infer<typeof wandererRoleSchema>;

export const gameSnapshotSchema = z.object({
  saveVersion: z.literal(1),
  screen: screenSchema,
  zone: zoneSchema,
  floor: z.number().int().min(1).max(50),
  highestFloor: z.number().int().min(1).max(50),
  level: z.number().int().min(1),
  weapon: weaponSchema,
  hp: z.number().min(0).max(100),
  mp: z.number().min(0).max(100),
  gold: z.number().int().min(0),
  skillUnlocked: z.boolean(),
  dialogueOpen: z.boolean(),
  dialogueIndex: z.number().int().min(0),
  seed: z.number().int().nonnegative(),
  wandererRole: wandererRoleSchema,
  objective: z.string(),
  notice: z.string(),
});

export type GameSnapshot = z.infer<typeof gameSnapshotSchema>;

export type GameCommand =
  | { type: "OPEN_SELECT" }
  | { type: "START_RUN"; weapon: WeaponId; seed: number }
  | { type: "ADVANCE_DIALOGUE" }
  | { type: "ENTER_ZONE"; zone: ZoneId }
  | { type: "TAKE_DAMAGE"; amount: number }
  | { type: "USE_SKILL"; manaCost: number }
  | { type: "COLLECT_GOLD"; amount: number }
  | { type: "BUY_HEAL"; price: number; amount: number }
  | { type: "RETURN_TITLE" };

export type GameEvent =
  | { type: "notice"; message: string }
  | { type: "skill-unlocked"; message: string }
  | { type: "zone-entered"; zone: ZoneId }
  | { type: "player-damaged"; amount: number }
  | { type: "skill-used" }
  | { type: "gold-collected"; amount: number };

export const commandRecordSchema = z.object({
  type: z.string(),
  at: z.number().int().nonnegative(),
});

export const saveEnvelopeSchema = z.object({
  saveVersion: z.literal(1),
  snapshot: gameSnapshotSchema,
  commandHistory: z.array(commandRecordSchema).max(500),
});

export type CommandRecord = z.infer<typeof commandRecordSchema>;
export type SaveEnvelope = z.infer<typeof saveEnvelopeSchema>;
