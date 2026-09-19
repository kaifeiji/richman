import { Landmark, Leaf, Sparkles, TrendingUp } from 'lucide-react';

export default function MechanismCard({ pending, animating }) {
  const isCard = pending.type === 'card';
  const kind = pending.card?.kind;
  const isDeck = pending.type === 'drawCard';
  const diceResult = (pending.type === 'market' || pending.type === 'environment' || pending.type === 'tax') && pending.specialRoll !== null;
  const MechanismIcon = pending.type === 'market' ? TrendingUp : pending.type === 'environment' ? Leaf : pending.type === 'tax' ? Landmark : Sparkles;
  const resultTitle = pending.type === 'market'
    ? pending.outcome === 'bear' ? '熊市' : pending.outcome === 'closed' ? '休市' : '牛市'
    : pending.type === 'environment'
      ? pending.outcome === 'cleanup' ? '系统升级' : '绿色能源'
      : pending.outcome === 'fine' ? '罚款' : pending.outcome === 'business' ? '办理业务' : '退税';
  const resultDetail = pending.amount === 0
    ? `暂停 ${pending.type === 'tax' ? 2 : 1} 回合`
    : `${pending.amount > 0 ? '获得' : '支付'} ¥${Math.abs(pending.amount).toLocaleString('zh-CN')}`;
  const title = isDeck
    ? pending.kind === 'chance' ? '机会来了' : '发生大事件'
    : isCard
      ? pending.card.title
      : diceResult
        ? resultTitle
        : pending.type === 'payment' ? pending.text.replace(` ${pending.countryName}`, '') : pending.title;
  const description = isDeck
    ? ''
    : isCard
      ? pending.card.text
      : diceResult
        ? `掷出 ${pending.specialRoll} 点 · ${resultDetail}`
        : pending.type === 'payment' ? pending.countryName : pending.text;
  return <article className={`mechanism-card mechanism-${kind || pending.kind || pending.type} ${isCard ? 'is-card' : ''} ${isDeck ? 'is-deck' : ''} ${animating ? 'is-resolving' : ''}`}>
    <div className="mechanism-copy">
      <MechanismIcon className="mechanism-icon" />
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
    {!diceResult && pending.specialRoll !== null && pending.specialRoll !== undefined && <strong className="mechanism-roll">{pending.specialRoll} 点</strong>}
  </article>;
}