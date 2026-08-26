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
export const skillNodeSchema = z.enum(["focus", "resonance"]);
export const missionResultSchema = z
  .enum([
    "failure-timeout",
    "failure-spotted",
    "failure-too-few-survivors",
    "failure-gate-sealed",
  ])
  .nullable();

export type ScreenId = z.infer<typeof screenSchema>;
export type ZoneId = z.infer<typeof zoneSchema>;
export type WeaponId = z.infer<typeof weaponSchema>;
export type WandererRole = z.infer<typeof wandererRoleSchema>;
export type SkillNodeId = z.infer<typeof skillNodeSchema>;

export const gameSnapshotSchema = z.object({
  saveVersion: z.literal(1),
  screen: screenSchema,
  zone: zoneSchema,
  floor: z.number().int().min(1).max(50),
  highestFloor: z.number().int().min(1).max(50),
  level: z.number().int().min(1),
  experience: z.number().min(0).default(0),
  experienceToNextLevel: z.number().int().positive().default(100),
  skillPoints: z.number().int().min(0).default(0),
  weapon: weaponSchema,
  hp: z.number().min(0).max(100),
  mp: z.number().min(0).max(100),
  gold: z.number().int().min(0),
  inventory: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        quantity: z.number().int().min(0),
        description: z.string(),
      }),
    )
    .default([]),
  skillUnlocked: z.boolean(),
  focusUnlocked: z.boolean().default(false),
  resonanceUnlocked: z.boolean().default(false),
  dialogueOpen: z.boolean(),
  dialogueIndex: z.number().int().min(0),
  seed: z.number().int().nonnegative(),
  wandererRole: wandererRoleSchema,
  objective: z.string(),
  notice: z.string(),
  lastMissionResult: missionResultSchema.default(null),
});

export type GameSnapshot = z.infer<typeof gameSnapshotSchema>;

export type GameCommand =
  | { type: "OPEN_SELECT" }
  | { type: "LOAD_GAME" }
  | { type: "START_RUN"; weapon: WeaponId; seed: number }
  | { type: "ADVANCE_DIALOGUE" }
  | { type: "ENTER_ZONE"; zone: ZoneId }
  | { type: "TAKE_DAMAGE"; amount: number }
  | { type: "USE_SKILL"; manaCost: number }
  | { type: "USE_SECOND_SKILL"; manaCost: number }
  | { type: "USE_THIRD_SKILL"; manaCost: number }
  | { type: "UNLOCK_SKILL_NODE"; node: SkillNodeId }
  | { type: "RECOVER_RESOURCES"; elapsedMs: number }
  | { type: "GAIN_EXPERIENCE"; amount: number }
  | { type: "COMPLETE_FLOOR" }
  | {
      type: "FAIL_FIFTH_FLOOR";
      reason: "timeout" | "spotted" | "too-few-survivors" | "gate-sealed";
    }
  | { type: "ACK_MISSION_RESULT" }
  | { type: "COLLECT_GOLD"; amount: number }
  | { type: "BUY_HEAL"; price: number; amount: number }
  | { type: "RETURN_TITLE" };

export type GameEvent =
  | { type: "notice"; message: string }
  | { type: "skill-unlocked"; message: string }
  | { type: "skill-node-unlocked"; node: SkillNodeId }
  | { type: "zone-entered"; zone: ZoneId }
  | { type: "player-damaged"; amount: number }
  | { type: "skill-used" }
  | { type: "second-skill-used" }
  | { type: "third-skill-used" }
  | { type: "resources-recovered"; hp: number; mp: number }
  | { type: "experience-gained"; amount: number }
  | { type: "level-up"; level: number }
  | { type: "floor-cleared"; floor: number }
  | {
      type: "mission-failed";
      reason: "timeout" | "spotted" | "too-few-survivors" | "gate-sealed";
    }
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
