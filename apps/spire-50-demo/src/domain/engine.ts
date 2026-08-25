import { clamp, createRng } from "@game/core";
import type {
  GameCommand,
  GameEvent,
  GameSnapshot,
  WandererRole,
} from "./model.js";

export interface TransitionResult {
  snapshot: GameSnapshot;
  events: GameEvent[];
}

export const HP_REGEN_PER_MINUTE = 6;
export const MP_REGEN_PER_MINUTE = 12;

export function experienceRequiredForLevel(level: number): number {
  return 100 + Math.max(0, level - 1) * 45;
}

export function wandererRoleFromSeed(seed: number): WandererRole {
  const relationRng = createRng((seed ^ 0x5f3759df) >>> 0);
  return relationRng.next() < 0.55 ? "ally" : "enemy";
}

export function createInitialSnapshot(): GameSnapshot {
  return {
    saveVersion: 1,
    screen: "title",
    zone: "rest",
    floor: 1,
    highestFloor: 1,
    level: 1,
    experience: 0,
    experienceToNextLevel: experienceRequiredForLevel(1),
    skillPoints: 0,
    weapon: "longsword",
    hp: 100,
    mp: 100,
    gold: 30,
    inventory: [
      {
        id: "small-potion",
        name: "작은 회복약",
        quantity: 2,
        description: "전투 사이에 체력을 보충하는 붉은 약입니다.",
      },
      {
        id: "tower-key",
        name: "낡은 탑 열쇠",
        quantity: 1,
        description: "오르반에게 받은 층계 게이트의 열쇠입니다.",
      },
    ],
    skillUnlocked: false,
    dialogueOpen: false,
    dialogueIndex: 0,
    seed: 0,
    wandererRole: "ally",
    objective: "게임 시작을 눌러 탑에 도전하세요.",
    notice: "The End's Tower가 도전자를 기다립니다.",
    lastMissionResult: null,
  };
}

export function transition(
  snapshot: GameSnapshot,
  command: GameCommand,
): TransitionResult {
  switch (command.type) {
    case "OPEN_SELECT":
      return {
        snapshot: {
          ...snapshot,
          screen: "select",
          notice: "무기 하나를 선택하세요.",
        },
        events: [],
      };

    case "LOAD_GAME":
      if (snapshot.seed === 0) {
        return {
          snapshot: {
            ...snapshot,
            screen: "title",
            notice: "불러올 여정이 없습니다.",
          },
          events: [],
        };
      }
      return {
        snapshot: {
          ...snapshot,
          screen: "game",
          zone: "rest",
          dialogueOpen: false,
          notice: "저장된 여정을 불러왔습니다.",
        },
        events: [{ type: "zone-entered", zone: "rest" }],
      };

    case "START_RUN": {
      const seed = command.seed >>> 0;
      const wandererRole = wandererRoleFromSeed(seed);
      return {
        snapshot: {
          ...createInitialSnapshot(),
          screen: "game",
          weapon: command.weapon,
          seed,
          wandererRole,
          dialogueOpen: true,
          objective: "탑 관리자의 설명을 들으세요.",
          notice: `런 시드 ${seed} · 방랑자의 운명이 정해졌습니다.`,
        },
        events: [{ type: "zone-entered", zone: "rest" }],
      };
    }

    case "ADVANCE_DIALOGUE":
      if (!snapshot.dialogueOpen) return { snapshot, events: [] };
      if (snapshot.dialogueIndex < 2) {
        return {
          snapshot: {
            ...snapshot,
            dialogueIndex: snapshot.dialogueIndex + 1,
          },
          events: [],
        };
      }
      return {
        snapshot: {
          ...snapshot,
          dialogueOpen: false,
          skillUnlocked: true,
          objective: "전투 포탈로 이동해 1층의 적을 모두 쓰러뜨리세요.",
          notice: "첫 스킬이 해금되었습니다. 숫자 1로 사용하세요.",
        },
        events: [
          {
            type: "skill-unlocked",
            message: "첫 스킬 해금 · 숫자 1",
          },
        ],
      };

    case "ENTER_ZONE": {
      const objective =
        command.zone === "battle"
          ? snapshot.floor === 5
            ? "외눈박이의 시야를 막고 바위문 너머 바닷가 게이트로 탈출하세요."
            : "적을 쓰러뜨리고 Z로 전리품을 회수하세요."
          : command.zone === "shop"
            ? "골드로 회복한 뒤 휴식처로 돌아가세요."
            : "전투 포탈 또는 상점 포탈을 이용하세요.";
      return {
        snapshot: {
          ...snapshot,
          zone: command.zone,
          objective,
          notice: `${zoneLabel(command.zone)}에 진입했습니다.`,
          lastMissionResult: null,
        },
        events: [{ type: "zone-entered", zone: command.zone }],
      };
    }

    case "TAKE_DAMAGE": {
      const amount = Math.max(0, command.amount);
      const hp = clamp(snapshot.hp - amount, 0, 100);
      if (hp === 0) {
        return {
          snapshot: {
            ...snapshot,
            zone: "rest",
            hp: 100,
            objective: "전투 포탈 또는 상점 포탈을 이용하세요.",
            notice: "쓰러져 휴식처로 귀환했습니다. 체력이 회복되었습니다.",
          },
          events: [
            { type: "player-damaged", amount },
            { type: "zone-entered", zone: "rest" },
          ],
        };
      }
      return {
        snapshot: {
          ...snapshot,
          hp,
          notice: snapshot.notice,
        },
        events: [{ type: "player-damaged", amount }],
      };
    }

    case "USE_SKILL":
      if (!snapshot.skillUnlocked || snapshot.mp < command.manaCost) {
        return {
          snapshot: {
            ...snapshot,
            notice: snapshot.skillUnlocked
              ? "마력이 부족합니다."
              : "관리자와 대화해 스킬을 먼저 해금하세요.",
          },
          events: [],
        };
      }
      return {
        snapshot: {
          ...snapshot,
          mp: clamp(snapshot.mp - command.manaCost, 0, 100),
          notice: "스킬을 사용했습니다.",
        },
        events: [{ type: "skill-used" }],
      };

    case "RECOVER_RESOURCES": {
      const elapsedMinutes = Math.max(0, command.elapsedMs) / 60_000;
      const hp = clamp(
        snapshot.hp + HP_REGEN_PER_MINUTE * elapsedMinutes,
        0,
        100,
      );
      const mp = clamp(
        snapshot.mp + MP_REGEN_PER_MINUTE * elapsedMinutes,
        0,
        100,
      );
      if (hp === snapshot.hp && mp === snapshot.mp) {
        return { snapshot, events: [] };
      }
      return {
        snapshot: { ...snapshot, hp, mp },
        events: [
          {
            type: "resources-recovered",
            hp: hp - snapshot.hp,
            mp: mp - snapshot.mp,
          },
        ],
      };
    }

    case "GAIN_EXPERIENCE": {
      const amount = Math.max(0, Math.floor(command.amount));
      if (amount === 0) return { snapshot, events: [] };
      let experience = snapshot.experience + amount;
      let level = snapshot.level;
      let experienceToNextLevel = snapshot.experienceToNextLevel;
      let levelsGained = 0;
      while (experience >= experienceToNextLevel) {
        experience -= experienceToNextLevel;
        level += 1;
        levelsGained += 1;
        experienceToNextLevel = experienceRequiredForLevel(level);
      }
      const events: GameEvent[] = [{ type: "experience-gained", amount }];
      if (levelsGained > 0) events.push({ type: "level-up", level });
      return {
        snapshot: {
          ...snapshot,
          experience,
          experienceToNextLevel,
          level,
          skillPoints: snapshot.skillPoints + levelsGained,
          hp: levelsGained > 0 ? 100 : snapshot.hp,
          mp: levelsGained > 0 ? 100 : snapshot.mp,
          notice:
            levelsGained > 0
              ? `레벨 ${level} 달성! 스킬 포인트 ${levelsGained}을 획득했습니다.`
              : `${amount} 경험치를 획득했습니다.`,
        },
        events,
      };
    }

    case "COMPLETE_FLOOR": {
      if (snapshot.zone !== "battle") return { snapshot, events: [] };
      const clearedFloor = snapshot.floor;
      const nextFloor = Math.min(50, clearedFloor + 1);
      return {
        snapshot: {
          ...snapshot,
          zone: "rest",
          floor: nextFloor,
          highestFloor: Math.max(snapshot.highestFloor, nextFloor),
          objective:
            clearedFloor >= 50
              ? "탑 정상 정복을 완료했습니다."
              : `${nextFloor}층 공략 게이트로 이동하세요.`,
          notice:
            clearedFloor >= 50
              ? "50층의 시련을 모두 끝냈습니다."
              : `${clearedFloor}층 클리어 · ${nextFloor}층이 열렸습니다.`,
          lastMissionResult: null,
        },
        events: [
          { type: "floor-cleared", floor: clearedFloor },
          { type: "zone-entered", zone: "rest" },
        ],
      };
    }

    case "FAIL_FIFTH_FLOOR": {
      if (snapshot.zone !== "battle" || snapshot.floor !== 5) {
        return { snapshot, events: [] };
      }
      const failureNotices = {
        spotted: "외눈박이의 손에 붙잡혀 사망한 뒤 휴식처로 귀환했습니다.",
        "too-few-survivors": "탈출 병사가 6명 미만이라 임무에 실패했습니다.",
        "gate-sealed":
          "바위문이 닫힌 채 외눈박이가 쓰러져 출구가 막혔습니다.",
        timeout: "5분 안에 탈출하지 못해 휴식처로 귀환했습니다.",
      } as const;
      return {
        snapshot: {
          ...snapshot,
          zone: "rest",
          hp: 100,
          objective: "5층 공략 게이트에서 외눈박이의 동굴에 다시 도전하세요.",
          notice: failureNotices[command.reason],
          lastMissionResult: `failure-${command.reason}`,
        },
        events: [
          { type: "mission-failed", reason: command.reason },
          { type: "zone-entered", zone: "rest" },
        ],
      };
    }

    case "ACK_MISSION_RESULT":
      if (snapshot.lastMissionResult === null) return { snapshot, events: [] };
      return {
        snapshot: { ...snapshot, lastMissionResult: null },
        events: [],
      };

    case "COLLECT_GOLD":
      return {
        snapshot: {
          ...snapshot,
          gold: snapshot.gold + Math.max(0, command.amount),
          notice: `${command.amount} 골드를 회수했습니다.`,
        },
        events: [{ type: "gold-collected", amount: command.amount }],
      };

    case "BUY_HEAL":
      if (snapshot.gold < command.price) {
        return {
          snapshot: { ...snapshot, notice: "골드가 부족합니다." },
          events: [],
        };
      }
      if (snapshot.hp >= 100) {
        return {
          snapshot: { ...snapshot, notice: "이미 체력이 가득합니다." },
          events: [],
        };
      }
      return {
        snapshot: {
          ...snapshot,
          gold: snapshot.gold - command.price,
          hp: clamp(snapshot.hp + command.amount, 0, 100),
          notice: "따뜻한 탑차를 마시고 체력을 회복했습니다.",
        },
        events: [{ type: "notice", message: "체력이 회복되었습니다." }],
      };

    case "RETURN_TITLE":
      return {
        snapshot: {
          ...snapshot,
          screen: "title",
          zone: "rest",
          dialogueOpen: false,
          notice: "타이틀로 돌아왔습니다.",
        },
        events: [],
      };
  }
}

function zoneLabel(zone: GameSnapshot["zone"]): string {
  if (zone === "battle") return "탑 공략장소";
  if (zone === "shop") return "아이템 상점";
  return "탑 휴식처";
}
