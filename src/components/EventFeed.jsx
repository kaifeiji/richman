import { ScrollText, Sparkles, X } from 'lucide-react';

export default function EventFeed({ game, onClose }) {
  return <aside className="event-panel">
    <div className="panel-heading"><div><span className="kicker">TRAVEL LOG</span><h2>旅程记录</h2></div>{onClose ? <button className="log-close" onClick={onClose} title="关闭旅程记录"><X /></button> : <ScrollText />}</div>
    {game.lastCard && <div className={`card-reveal card-${game.lastCard.kind}`}><Sparkles /><div><b>{game.lastCard.title}</b><span>{game.lastCard.text}</span></div></div>}
    <div className="feed-list">{game.log.map((item, index) => {
      const player = game.players.find((candidate) => item.includes(candidate.name));
      return <div className="feed-item" key={`${index}-${item}`}><i style={{ background: player?.color || '#8b9690' }} />{item}</div>;
    })}</div>
  </aside>;
}