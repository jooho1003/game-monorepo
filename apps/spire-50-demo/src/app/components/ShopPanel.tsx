import { useGameStore } from "../../store/game-store.js";

export function ShopPanel() {
  const dispatch = useGameStore((state) => state.dispatch);

  return (
    <section className="shop-panel">
      <p className="eyebrow">RESTOCK BEFORE ASCENT</p>
      <h2>뿌리와 룬 상점</h2>
      <p>상인은 말없이 따뜻한 탑차를 내밉니다.</p>
      <button
        type="button"
        onClick={() => dispatch({ type: "BUY_HEAL", price: 20, amount: 35 })}
      >
        <span>따뜻한 탑차</span>
        <small>HP +35</small>
        <strong>◆ 20</strong>
      </button>
      <em>휴식처 포탈 위에서 W를 눌러 돌아가세요.</em>
    </section>
  );
}
