import { useEffect, useRef, useState } from 'react';
import { Award, Building2, Crown, Medal, MapPinned, Star, TicketCheck, WalletCards, Wallet } from 'lucide-react';
import { totalBuildings } from '../game/engine';
import { money } from '../game/format';

function useCountedValue(target) {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);
  useEffect(() => {
    const startValue = valueRef.current;
    if (startValue === target) return undefined;
    const startedAt = performance.now();
    let frame;
    const animate = (now) => {
      const progress = Math.min((now - startedAt) / 550, 1);
      const eased = 1 - (1 - progress) ** 3;
      const nextValue = Math.round(startValue + (target - startValue) * eased);
      valueRef.current = nextValue;
      setValue(nextValue);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

export default function PlayerPanel({ player, active, moneyPulse, rank, displayedMoney, displayedAssets }) {
  const animatedMoney = useCountedValue(displayedMoney);
  const animatedAssets = useCountedValue(displayedAssets);
  const RankIcon = rank === 1 ? Crown : rank === 2 ? Medal : rank === 3 ? Award : Star;

  return <article className={`player-panel ${active ? 'is-active' : ''} ${player.bankrupt ? 'is-bankrupt' : ''}`} data-player-id={player.id}>
    <div className={`rank-badge rank-${rank} ${rank === 1 ? 'is-first' : ''}`} title={`第 ${rank} 名`}><RankIcon /><b>{rank}</b></div>
    <div className="avatar" style={{ background: player.color }} title={player.name}>{player.initials}</div>
    <div className={`jail-free-badge ${player.jailFreeCards > 0 ? 'has-cards' : 'is-empty'}`} title="免费获释卡"><TicketCheck /><b>{player.jailFreeCards}</b></div>
    <div className="player-stat-grid">
      <div className={`player-stat player-money ${moneyPulse ? `is-pulsing ${moneyPulse.delta > 0 ? 'is-gain' : 'is-loss'}` : ''}`}><Wallet /><span>现金</span><b>{money(animatedMoney)}</b></div>
      <div className={`player-stat player-total-assets ${moneyPulse ? 'is-pulsing' : ''}`}><WalletCards /><span>总资产</span><b>{money(animatedAssets)}</b></div>
      <div className="player-stat"><MapPinned /><span>土地</span><b>{player.properties.length}</b></div>
      <div className="player-stat"><Building2 /><span>房屋</span><b>{totalBuildings(player)}</b></div>
    </div>
  </article>;
}