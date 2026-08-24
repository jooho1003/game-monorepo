export interface ItemPresentation {
  icon: string;
  tone: string;
}

const itemPresentations: Record<string, ItemPresentation> = {
  "small-potion": {
    icon: "/assets/game/hud/items/small-potion.svg",
    tone: "#d76861",
  },
  "tower-key": {
    icon: "/assets/game/hud/items/tower-key.svg",
    tone: "#dfc477",
  },
};

const fallbackPresentation: ItemPresentation = {
  icon: "/assets/game/hud/items/unknown-item.svg",
  tone: "#8aa39a",
};

export function getItemPresentation(id: string): ItemPresentation {
  return itemPresentations[id] ?? fallbackPresentation;
}
