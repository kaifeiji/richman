import { RotateCcw, Trophy } from 'lucide-react';
import { totalAssets } from '../game/engine';
import { money } from '../game/format';

export default function GameOver({ game, onRestart }) {
  const winner = game.players.find((player) => player.id === game.winner);
  return <div className="modal-layer"><section className="modal-card game-over"><Trophy /><span className="kicker">JOURNEY COMPLETE</span><h2>{winner?.name} 获胜</h2><p>最终总资产 {money(winner ? totalAssets(winner) : 0)}，拥有 {winner?.properties.length || 0} 个国家。</p><button className="primary-button" onClick={onRestart}><RotateCcw />新游戏</button></section></div>;
}