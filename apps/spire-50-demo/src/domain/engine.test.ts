import { describe, expect, it } from "vitest";
import {
  createInitialSnapshot,
  RESONANCE_MP_REFUND,
  transition,
  wandererRoleFromSeed,
} from "./engine.js";
import { getItemDefinition } from "./items.js";

describe("deterministic run shell", () => {
  it("derives the same wanderer role for the same seed", () => {
    expect(wandererRoleFromSeed(5025)).toBe(wandererRoleFromSeed(5025));
  });

  it("unlocks the first skill after the manager dialogue", () => {
    const started = transition(createInitialSnapshot(), {
      type: "START_RUN",
      weapon: "longsword",
      seed: 50,
    }).snapshot;

    const afterOne = transition(started, { type: "ADVANCE_DIALOGUE" }).snapshot;
    const afterTwo = transition(afterOne, {
      type: "ADVANCE_DIALOGUE",
    }).snapshot;
    const finished = transition(afterTwo, {
      type: "ADVANCE_DIALOGUE",
    }).snapshot;

    expect(finished.skillUnlocked).toBe(true);
    expect(finished.dialogueOpen).toBe(false);
  });

  it("spends gold and puts the bought item in the bag", () => {
    const bought = transition(createInitialSnapshot(), {
      type: "BUY_ITEM",
      itemId: "warm-tea",
    }).snapshot;

    expect(bought.gold).toBe(10);
    expect(bought.inventory.find((item) => item.id === "warm-tea")).toEqual({
      id: "warm-tea",
      name: "따뜻한 탑차",
      description: getItemDefinition("warm-tea")?.description,
      quantity: 1,
    });
  });

  it("stacks a repeat purchase instead of taking a new slot", () => {
    const rich = { ...createInitialSnapshot(), gold: 100 };
    const once = transition(rich, {
      type: "BUY_ITEM",
      itemId: "warm-tea",
    }).snapshot;
    const twice = transition(once, {
      type: "BUY_ITEM",
      itemId: "warm-tea",
    }).snapshot;

    expect(twice.gold).toBe(60);
    expect(
      twice.inventory.filter((item) => item.id === "warm-tea"),
    ).toHaveLength(1);
    expect(
      twice.inventory.find((item) => item.id === "warm-tea")?.quantity,
    ).toBe(2);
  });

  it("refuses a purchase the player cannot afford", () => {
    const broke = { ...createInitialSnapshot(), gold: 5 };
    const result = transition(broke, {
      type: "BUY_ITEM",
      itemId: "warm-tea",
    });

    expect(result.snapshot.gold).toBe(5);
    expect(result.snapshot.inventory).toEqual(broke.inventory);
    expect(result.snapshot.notice).toBe("골드가 부족합니다.");
  });

  it("consumes a bought item and restores health", () => {
    const damaged = transition(createInitialSnapshot(), {
      type: "TAKE_DAMAGE",
      amount: 40,
    }).snapshot;
    const bought = transition(damaged, {
      type: "BUY_ITEM",
      itemId: "warm-tea",
    }).snapshot;
    const used = transition(bought, {
      type: "USE_ITEM",
      itemId: "warm-tea",
    }).snapshot;

    expect(used.hp).toBe(90);
    expect(used.inventory.some((item) => item.id === "warm-tea")).toBe(false);
  });

  it("keeps a consumable when using it would recover nothing", () => {
    const full = {
      ...createInitialSnapshot(),
      inventory: [
        {
          id: "warm-tea",
          name: "따뜻한 탑차",
          description: "",
          quantity: 1,
        },
      ],
    };
    const result = transition(full, { type: "USE_ITEM", itemId: "warm-tea" });

    expect(result.snapshot.inventory[0]?.quantity).toBe(1);
    expect(result.events).toHaveLength(0);
  });

  it("refuses to use an item that has no effect", () => {
    const result = transition(createInitialSnapshot(), {
      type: "USE_ITEM",
      itemId: "tower-key",
    });

    expect(result.snapshot.inventory).toEqual(
      createInitialSnapshot().inventory,
    );
    expect(result.events).toHaveLength(0);
  });

  it("returns a defeated player to the rest area", () => {
    const battle = transition(createInitialSnapshot(), {
      type: "ENTER_ZONE",
      zone: "battle",
    }).snapshot;
    const defeated = transition(battle, {
      type: "TAKE_DAMAGE",
      amount: 100,
    }).snapshot;

    expect(defeated.zone).toBe("rest");
    expect(defeated.hp).toBe(100);
  });

  it("loads an existing run into the rest area", () => {
    const started = transition(createInitialSnapshot(), {
      type: "START_RUN",
      weapon: "bow",
      seed: 5026,
    }).snapshot;
    const loaded = transition(
      { ...started, screen: "title", zone: "battle" },
      { type: "LOAD_GAME" },
    ).snapshot;

    expect(loaded.screen).toBe("game");
    expect(loaded.zone).toBe("rest");
    expect(loaded.weapon).toBe("bow");
    expect(loaded.seed).toBe(5026);
  });

  it("keeps the title open when there is no run to load", () => {
    const loaded = transition(createInitialSnapshot(), {
      type: "LOAD_GAME",
    }).snapshot;

    expect(loaded.screen).toBe("title");
    expect(loaded.notice).toBe("불러올 여정이 없습니다.");
  });

  it("recovers hp and mp using per-minute rates", () => {
    const snapshot = { ...createInitialSnapshot(), hp: 40, mp: 20 };
    const recovered = transition(snapshot, {
      type: "RECOVER_RESOURCES",
      elapsedMs: 30_000,
    }).snapshot;

    expect(recovered.hp).toBe(43);
    expect(recovered.mp).toBe(26);
  });

  it("levels up and carries remaining experience", () => {
    const leveled = transition(createInitialSnapshot(), {
      type: "GAIN_EXPERIENCE",
      amount: 130,
    }).snapshot;

    expect(leveled.level).toBe(2);
    expect(leveled.experience).toBe(30);
    expect(leveled.experienceToNextLevel).toBe(145);
    expect(leveled.skillPoints).toBe(1);
  });

  it("opens the next floor only after a battle clear", () => {
    const battle = transition(createInitialSnapshot(), {
      type: "ENTER_ZONE",
      zone: "battle",
    }).snapshot;
    const completed = transition(battle, { type: "COMPLETE_FLOOR" }).snapshot;

    expect(completed.zone).toBe("rest");
    expect(completed.floor).toBe(2);
    expect(completed.highestFloor).toBe(2);
  });

  it("returns a failed fifth-floor mission to the rest area without progress", () => {
    const battle = {
      ...createInitialSnapshot(),
      floor: 5,
      highestFloor: 5,
      zone: "battle" as const,
      hp: 12,
    };
    const failed = transition(battle, {
      type: "FAIL_FIFTH_FLOOR",
      reason: "spotted",
    }).snapshot;

    expect(failed).toMatchObject({
      zone: "rest",
      floor: 5,
      highestFloor: 5,
      hp: 100,
      lastMissionResult: "failure-spotted",
    });
  });

  it("records failure when fewer than six soldiers reach the exit", () => {
    const battle = {
      ...createInitialSnapshot(),
      floor: 5,
      highestFloor: 5,
      zone: "battle" as const,
    };
    const failed = transition(battle, {
      type: "FAIL_FIFTH_FLOOR",
      reason: "too-few-survivors",
    }).snapshot;
    expect(failed.lastMissionResult).toBe("failure-too-few-survivors");
  });

  it("ignores fifth-floor failure commands outside its mission", () => {
    const initial = createInitialSnapshot();
    expect(
      transition(initial, {
        type: "FAIL_FIFTH_FLOOR",
        reason: "timeout",
      }).snapshot,
    ).toBe(initial);
  });
});

describe("skill node unlocks", () => {
  it("spends one skill point to unlock a node when the level is met", () => {
    const ready = { ...createInitialSnapshot(), level: 3, skillPoints: 2 };
    const result = transition(ready, {
      type: "UNLOCK_SKILL_NODE",
      node: "focus",
    });

    expect(result.snapshot.focusUnlocked).toBe(true);
    expect(result.snapshot.skillPoints).toBe(1);
    expect(result.events).toContainEqual({
      type: "skill-node-unlocked",
      node: "focus",
    });
  });

  it("refuses to unlock below the required level", () => {
    const early = { ...createInitialSnapshot(), level: 2, skillPoints: 3 };
    const result = transition(early, {
      type: "UNLOCK_SKILL_NODE",
      node: "focus",
    }).snapshot;

    expect(result.focusUnlocked).toBe(false);
    expect(result.skillPoints).toBe(3);
    expect(result.notice).toBe("두 번째 스킬 해금에는 레벨 3이 필요합니다.");
  });

  it("refuses to unlock without a skill point", () => {
    const broke = { ...createInitialSnapshot(), level: 5, skillPoints: 0 };
    const result = transition(broke, {
      type: "UNLOCK_SKILL_NODE",
      node: "resonance",
    }).snapshot;

    expect(result.resonanceUnlocked).toBe(false);
    expect(result.notice).toBe("스킬 포인트가 부족합니다.");
  });

  it("does not charge again for an already unlocked node", () => {
    const unlocked = {
      ...createInitialSnapshot(),
      level: 3,
      skillPoints: 1,
      focusUnlocked: true,
    };
    const result = transition(unlocked, {
      type: "UNLOCK_SKILL_NODE",
      node: "focus",
    }).snapshot;

    expect(result.skillPoints).toBe(1);
    expect(result.notice).toBe("이미 해금된 스킬입니다.");
  });

  it("refunds mana on skill use once resonance is unlocked", () => {
    const attuned = {
      ...createInitialSnapshot(),
      skillUnlocked: true,
      resonanceUnlocked: true,
      mp: 50,
    };
    const used = transition(attuned, {
      type: "USE_SKILL",
      manaCost: 25,
    }).snapshot;

    expect(used.mp).toBe(50 - 25 + RESONANCE_MP_REFUND);
  });

  it("requires the third node before spending mana on a third skill", () => {
    const locked = { ...createInitialSnapshot(), skillUnlocked: true, mp: 80 };
    const result = transition(locked, {
      type: "USE_THIRD_SKILL",
      manaCost: 45,
    });

    expect(result.snapshot.mp).toBe(80);
    expect(result.events).toEqual([]);
    expect(result.snapshot.notice).toContain("세 번째 스킬");
  });

  it("requires the focus node before spending mana on a second skill", () => {
    const locked = { ...createInitialSnapshot(), skillUnlocked: true, mp: 80 };
    const result = transition(locked, {
      type: "USE_SECOND_SKILL",
      manaCost: 32,
    });

    expect(result.snapshot.mp).toBe(80);
    expect(result.events).toEqual([]);
    expect(result.snapshot.notice).toContain("두 번째 스킬");
  });

  it("spends the configured mana and emits the second-skill event", () => {
    const unlocked = {
      ...createInitialSnapshot(),
      focusUnlocked: true,
      mp: 80,
    };
    const result = transition(unlocked, {
      type: "USE_SECOND_SKILL",
      manaCost: 32,
    });

    expect(result.snapshot.mp).toBe(48);
    expect(result.events).toEqual([{ type: "second-skill-used" }]);
  });

  it("spends the configured mana and emits the third-skill event", () => {
    const unlocked = {
      ...createInitialSnapshot(),
      resonanceUnlocked: true,
      mp: 80,
    };
    const result = transition(unlocked, {
      type: "USE_THIRD_SKILL",
      manaCost: 45,
    });

    expect(result.snapshot.mp).toBe(35);
    expect(result.events).toEqual([{ type: "third-skill-used" }]);
  });
});
