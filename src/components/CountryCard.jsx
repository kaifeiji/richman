import { Building2, KeyRound } from 'lucide-react';
import { money } from '../game/format';

export default function CountryCard({ tile, owner, level = 0, fees, actionStatus }) {
  if (tile.type !== 'property') return <div className={`special-detail detail-${tile.type}`}>
    <span>{tile.name}</span><strong>{tile.description}</strong>
  </div>;
  return <article className="country-card" style={{ '--region-color': tile.regionColor }}>
    <header><div><span>{tile.english}</span><h2>{tile.name}</h2></div><b>{tile.city}</b></header>
    {actionStatus && <div className={`property-action-status ${actionStatus === '可购买' || actionStatus === '可盖房' ? 'is-available' : ''}`}>{actionStatus}</div>}
    <div className="country-owner"><KeyRound size={16} /><span>{owner ? `${owner.name} 已购买` : '无人购买'}</span><em style={{ background: tile.regionColor }}>{tile.regionName}</em>{fees.completeRegion && <b>整区 ×2</b>}{level > 0 && <b>{level} 层</b>}</div>
    <dl>
      <div><dt>所有权</dt><dd>{money(tile.ownership)}</dd></div>
      <div><dt>盖房 / 层</dt><dd>{money(tile.buildCost)}</dd></div>
      <div><dt>当前通关费</dt><dd>{money(fees.passFee)}</dd></div>
      <div><dt>当前住宿费</dt><dd>{money(fees.stayFee)}</dd></div>
    </dl>
    <div className="stay-fees">
      {tile.stayFees.map((fee, index) => <div className={level === index + 1 ? 'active' : ''} key={fee}><Building2 size={15} /><span>{index + 1} 层</span><b>{money(fee * fees.multiplier)}</b></div>)}
    </div>
  </article>;
}