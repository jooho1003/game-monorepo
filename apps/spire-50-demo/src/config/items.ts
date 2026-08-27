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
  "warm-tea": {
    icon: "/assets/game/hud/items/warm-tea.svg",
    tone: "#c98f52",
  },
  "mana-tonic": {
    icon: "/assets/game/hud/items/mana-tonic.svg",
    tone: "#6f9ed8",
  },
  "tower-ration": {
    icon: "/assets/game/hud/items/tower-ration.svg",
    tone: "#b6a06a",
  },
};

const fallbackPresentation: ItemPresentation = {
  icon: "/assets/game/hud/items/unknown-item.svg",
  tone: "#8aa39a",
};

export function getItemPresentation(id: string): ItemPresentation {
  return itemPresentations[id] ?? fallbackPresentation;
}
