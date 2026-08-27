export interface ItemEffect {
  hp?: number;
  mp?: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  /** 상점에서 파는 가격. null이면 상점에 진열되지 않습니다. */
  price: number | null;
  /** 사용 시 회복량. null이면 사용할 수 없는 소지품입니다. */
  effect: ItemEffect | null;
}

export type ShopItemDefinition = ItemDefinition & { price: number };

export const INVENTORY_SLOT_LIMIT = 6;
export const INVENTORY_STACK_LIMIT = 9;

export const itemCatalog: readonly ItemDefinition[] = [
  {
    id: "warm-tea",
    name: "따뜻한 탑차",
    description:
      "상인이 말없이 내미는 김 오르는 차입니다. 체력 30을 회복합니다.",
    price: 20,
    effect: { hp: 30 },
  },
  {
    id: "small-potion",
    name: "작은 회복약",
    description:
      "전투 사이에 체력을 보충하는 붉은 약입니다. 체력 55를 회복합니다.",
    price: 35,
    effect: { hp: 55 },
  },
  {
    id: "mana-tonic",
    name: "룬 마력수",
    description: "룬을 우려낸 푸른 물입니다. 마력 45를 회복합니다.",
    price: 30,
    effect: { mp: 45 },
  },
  {
    id: "tower-ration",
    name: "탑의 건량",
    description:
      "등반자를 위한 마른 식량입니다. 체력과 마력을 30씩 회복합니다.",
    price: 55,
    effect: { hp: 30, mp: 30 },
  },
  {
    id: "tower-key",
    name: "낡은 탑 열쇠",
    description: "오르반에게 받은 층계 게이트의 열쇠입니다.",
    price: null,
    effect: null,
  },
];

const catalogById = new Map(itemCatalog.map((item) => [item.id, item]));

export function getItemDefinition(id: string): ItemDefinition | undefined {
  return catalogById.get(id);
}

export function getShopStock(): ShopItemDefinition[] {
  return itemCatalog.filter(
    (item): item is ShopItemDefinition => item.price !== null,
  );
}
