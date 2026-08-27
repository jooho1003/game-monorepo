import { getItemPresentation } from "../../config/items.js";
import { getShopStock } from "../../domain/items.js";
import { useGameStore } from "../../store/game-store.js";

const shopStock = getShopStock();

export function ShopPanel() {
  const dispatch = useGameStore((state) => state.dispatch);
  const gold = useGameStore((state) => state.snapshot.gold);
  const inventory = useGameStore((state) => state.snapshot.inventory);

  return (
    <section className="shop-panel">
      <p className="eyebrow">RESTOCK BEFORE ASCENT</p>
      <h2>뿌리와 룬 상점</h2>
      <div className="shop-panel__purse">
        <span>소지 골드</span>
        <strong>◆ {gold}</strong>
      </div>
      <ul className="shop-stock">
        {shopStock.map((item) => {
          const owned =
            inventory.find((entry) => entry.id === item.id)?.quantity ?? 0;
          const affordable = gold >= item.price;
          return (
            <li key={item.id}>
              <button
                type="button"
                disabled={!affordable}
                onClick={() => dispatch({ type: "BUY_ITEM", itemId: item.id })}
              >
                <span
                  className="shop-stock__icon"
                  style={{ borderColor: getItemPresentation(item.id).tone }}
                >
                  <img src={getItemPresentation(item.id).icon} alt="" />
                </span>
                <span className="shop-stock__body">
                  <strong>{item.name}</strong>
                  <small>{item.description}</small>
                </span>
                <span className="shop-stock__price">
                  <b>◆ {item.price}</b>
                  {owned > 0 ? <i>보유 {owned}</i> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <em>산 물건은 I 키 · 아이템 가방에서 사용할 수 있습니다.</em>
      <em>휴식처 포탈 위에서 W를 눌러 돌아가세요.</em>
    </section>
  );
}
