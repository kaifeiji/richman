import { Award, Building2, Crown, Medal, MapPinned, Star, TicketCheck, WalletCards, Wallet } from 'lucide-react';
import { totalAssets, totalBuildings } from '../game/engine';
import { money } from '../game/format';

export default function PlayerPanel({ player, active, moneyPulse, rank }) {
  const RankIcon = rank === 1 ? Crown : rank === 2 ? Medal : rank === 3 ? Award : Star;
  return <article className={`player-panel ${active ? 'is-active' : ''} ${player.bankrupt ? 'is-bankrupt' : ''}`} data-player-id={player.id}>
    <div className={`rank-badge rank-${rank} ${rank === 1 ? 'is-first' : ''}`} title={`第 ${rank} 名`}><RankIcon /><b>{rank}</b></div>
    <div className="avatar" style={{ background: player.color }} title={player.name}>{player.initials}</div>
    <div className={`jail-free-badge ${player.jailFreeCards > 0 ? 'has-cards' : 'is-empty'}`} title="免费获释卡"><TicketCheck /><b>{player.jailFreeCards}</b></div>
    <div className="player-stat-grid">
      <div className={`player-stat player-money ${moneyPulse ? `is-pulsing ${moneyPulse.delta > 0 ? 'is-gain' : 'is-loss'}` : ''}`}><Wallet /><span>现金</span><b>{money(player.money)}</b></div>
      <div className="player-stat"><WalletCards /><span>总资产</span><b>{money(totalAssets(player))}</b></div>
      <div className="player-stat"><MapPinned /><span>土地</span><b>{player.properties.length}</b></div>
      <div className="player-stat"><Building2 /><span>房屋</span><b>{totalBuildings(player)}</b></div>
    </div>
  </article>;
}