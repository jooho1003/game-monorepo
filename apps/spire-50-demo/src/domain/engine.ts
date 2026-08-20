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
    weapon: "longsword",
    hp: 100,
    mp: 100,
    gold: 30,
    skillUnlocked: false,
    dialogueOpen: false,
    dialogueIndex: 0,
    seed: 0,
    wandererRole: "ally",
    objective: "게임 시작을 눌러 탑에 도전하세요.",
    notice: "종말의 탑이 도전자를 기다립니다.",
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
          ? "적을 쓰러뜨리고 Z로 전리품을 회수하세요."
          : command.zone === "shop"
            ? "골드로 회복한 뒤 휴식처로 돌아가세요."
            : "전투 포탈 또는 상점 포탈을 이용하세요.";
      return {
        snapshot: {
          ...snapshot,
          zone: command.zone,
          objective,
          notice: `${zoneLabel(command.zone)}에 진입했습니다.`,
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
