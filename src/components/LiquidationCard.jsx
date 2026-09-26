import { Building2, Landmark, WalletCards } from 'lucide-react';
import { BOARD } from '../game/board';
import { buildingLevel, liquidationOptions } from '../game/engine';
import { money } from '../game/format';

export default function LiquidationCard({ game, onSellBuilding, onSellProperty }) {
  const debt = game.pendingDebt;
  const player = game.players.find((item) => item.id === debt.playerId);
  const shortfall = Math.max(0, debt.amount - player.money);
  return <article className="liquidation-card">
    <header><WalletCards /><div><small>现金不足</small><h2>变卖资产</h2></div></header>
    <div className="debt-summary"><span>应付 <b>{money(debt.amount)}</b></span><span>现金 <b>{money(player.money)}</b></span><span>还差 <b>{money(shortfall)}</b></span></div>
    <p>房屋和土地按原价五折出售。土地上的房屋必须先逐层出售。</p>
    <div className="asset-sale-list">
      {liquidationOptions(player).map(({ type, position, amount }) => {
        const tile = BOARD[position];
        const level = buildingLevel(player, position);
        return <div className="asset-sale-row" key={position}>
          <div><strong>{tile.name}</strong><span>{level ? `${level} 层房屋` : '仅土地'}</span></div>
          {type === 'building'
            ? <button onClick={() => onSellBuilding(position)}><Building2 />卖一层 +{money(amount)}</button>
            : <button onClick={() => onSellProperty(position)}><Landmark />卖土地 +{money(amount)}</button>}
        </div>;
      })}
    </div>
  </article>;
}
