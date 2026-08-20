import { lazy, Suspense } from "react";
import { useGameStore } from "../store/game-store.js";
import { SelectScreen } from "./SelectScreen.js";
import { TitleScreen } from "./TitleScreen.js";

const GameScreen = lazy(() =>
  import("./GameScreen.js").then((module) => ({ default: module.GameScreen })),
);

export function App() {
  const screen = useGameStore((state) => state.snapshot.screen);

  if (screen === "select") return <SelectScreen />;
  if (screen === "game") {
    return (
      <Suspense fallback={<GameLoading />}>
        <GameScreen />
      </Suspense>
    );
  }
  return <TitleScreen />;
}

function GameLoading() {
  return (
    <main className="game-loading" aria-live="polite">
      <span>塔</span>
      <p>탑의 문을 여는 중…</p>
    </main>
  );
}
