import { Building2, Check, Dice5, Flag, KeyRound, TicketCheck, WalletCards } from 'lucide-react';
import { BOARD } from '../game/board';
import { buildingLevel, currentPlayer, hasBuildingsOn, hasOptionalPropertyAction, JAIL_RELEASE_FEE, ownerOf } from '../game/engine';
import { money } from '../game/format';
import DiceFace from './DiceFace';

export default function ActionBar({ game, animation, paused = false, canAct = true, onRoll, onBuy, onBuild, onEnd, onRelease, onDraw, onMechanismRoll, onResolve }) {
  const animating = animation.active || paused;
  const disabled = animating || !canAct;
  const player = currentPlayer(game);
  const tile = BOARD[player.position];
  const owner = ownerOf(game, tile.id);
  const level = tile.type === 'property' ? buildingLevel(player, tile.id) : 0;
  const canBuy = !animating && game.phase === 'action' && tile.type === 'property' && !owner && !hasBuildingsOn(game, tile.id) && player.money >= tile.ownership;
  const canBuild = !animating && game.phase === 'action' && !game.builtThisTurn && tile.type === 'property' && owner?.id === player.id && level < 3 && player.money >= tile.buildCost;
  const hasChoice = hasOptionalPropertyAction(game);
  let title = '等待操作';
  let description = tile.name;
  if (animation.moving) { title = '移动中'; description = ''; }
  else if (animation.rolling) { title = '掷骰中'; description = ''; }
  else if (animation.active && game.phase === 'roll') { title = `${animation.dice} 点`; description = ''; }
  else if (game.phase === 'roll') {
    title = player.jailed ? `${player.name} 被逮捕` : `轮到 ${player.name} 了`;
    description = player.jailed
      ? `${player.jailTurns > 1 ? `剩余 ${player.jailTurns} 次停玩 · ` : ''}${player.jailFreeCards > 0 ? '按 Alt 使用获释卡' : player.money >= JAIL_RELEASE_FEE ? `按 Alt 支付 ${money(JAIL_RELEASE_FEE)} 保释并行动` : '余额不足，选择跳过本回合'}`
      : '按空格掷骰出发';
  }
  else if (game.pendingEffect?.type === 'drawCard') { title = game.pendingEffect.kind === 'chance' ? '机会来了' : '发生大事件'; description = ''; }
  else if (game.pendingEffect?.requiresRoll && game.pendingEffect.specialRoll === null) { title = '再次掷骰'; description = game.pendingEffect.text; }
  else if (game.phase === 'resolve') {
    const resolveTitles = { card: '确认', payment: '支付费用', tax: '缴纳税款', environment: '支持环保', market: '结算盈亏', arrest: '停止 2 回合', harbor: '停止 1 回合' };
    title = resolveTitles[game.pendingEffect?.type] || '继续旅程';
    if (game.pendingEffect?.type === 'tax') title = game.pendingEffect.outcome === 'fine' ? '支付罚款' : game.pendingEffect.outcome === 'business' ? '暂停 2 回合' : '领取退税';
    if (game.pendingEffect?.type === 'environment') title = game.pendingEffect.outcome === 'cleanup' ? '升级系统' : '领取补贴';
    if (game.pendingEffect?.type === 'market') title = game.pendingEffect.outcome === 'bear' ? '支付亏损' : game.pendingEffect.outcome === 'closed' ? '休市 1 回合' : '领取盈利';
    if (game.pendingEffect?.type === 'payment') title = game.pendingEffect.text;
    description = '按空格';
  }
  else if (canBuy) { title = `买下 ${tile.name}？`; description = `取得所有权 · ${money(tile.ownership)} · 按 Alt` ; }
  else if (canBuild) { title = `盖 ${level + 1} 层楼`; description = `${tile.name} · ${money(tile.buildCost)} · 按 Alt`; }
  else if (game.phase === 'action') { title = ''; description = ''; }
  const showDice = animation.rolling || animation.revealing || (animation.moving && animation.movementKind === 'dice');
  const mechanismMode = Boolean(game.pendingEffect);
  const hasActionButtons = !showDice && ((game.phase === 'roll')
    || (game.phase === 'resolve' && (game.pendingEffect?.type === 'drawCard' || (game.pendingEffect?.requiresRoll && game.pendingEffect.specialRoll === null) || game.pendingEffect?.type !== 'drawCard'))
    || canBuy || canBuild || (game.phase === 'action' && hasChoice));
  return <section className={`card-actions ${showDice ? 'has-dice' : ''} ${!hasActionButtons ? 'no-actions' : ''} ${mechanismMode ? 'is-mechanism-actions' : ''}`}>
    {showDice ? <div className="operation-status dice-only"><div className={`action-dice ${animation.rolling ? 'is-rolling' : ''}`}><DiceFace value={animation.dice ?? 1} /></div></div> : !mechanismMode && <div className="operation-status">
        <div className="operation-heading"><h2>{title}</h2>{description && <p>{description}</p>}</div>
        {(canBuy || canBuild) && <div className={`property-progress ${canBuy ? 'is-buying' : 'is-building'}`}>
          {['土地', '1 层', '2 层', '3 层'].map((label, index) => {
            const completed = canBuild && index <= level;
            const current = canBuy ? index === 0 : index === level + 1;
            return <span className={`${completed ? 'is-complete' : ''} ${current ? 'is-current' : ''}`} key={label}><i>{completed ? '✓' : index === 0 ? <KeyRound /> : <Building2 />}</i><b>{index === 0 ? label : `${label}楼`}</b></span>;
          })}
        </div>}
      </div>}
    {hasActionButtons && <div className="action-buttons">
      {game.phase === 'roll' && !player.jailed && <button className="primary-button action-aggressive dice-button" onClick={onRoll} disabled={disabled} aria-label="掷骰出发"><Dice5 /></button>}
      {game.phase === 'roll' && player.jailed && <>
        {player.jailFreeCards > 0
          ? <button className="secondary-button action-aggressive" onClick={() => onRelease('alt')} disabled={disabled}><TicketCheck />获释卡 · Alt</button>
          : player.money >= JAIL_RELEASE_FEE && <button className="secondary-button action-aggressive" onClick={() => onRelease('alt')} disabled={disabled}><WalletCards />支付 {money(JAIL_RELEASE_FEE)} · Alt</button>}
        <button className="ghost-button action-conservative" onClick={() => onRelease('skip')} disabled={disabled}>跳过本回合</button>
      </>}
      {game.phase === 'resolve' && game.pendingEffect?.type === 'drawCard' && <button className="primary-button action-aggressive confirm-button" onClick={onDraw} disabled={disabled} aria-label="确认"><Check /></button>}
      {game.phase === 'resolve' && game.pendingEffect?.requiresRoll && game.pendingEffect.specialRoll === null && <button className="primary-button action-aggressive dice-button" onClick={onMechanismRoll} disabled={disabled} aria-label="机制掷骰"><Dice5 /></button>}
      {game.phase === 'resolve' && game.pendingEffect?.type !== 'drawCard' && (!game.pendingEffect?.requiresRoll || game.pendingEffect.specialRoll !== null) && <button className="primary-button action-aggressive confirm-button" onClick={onResolve} disabled={disabled}><Check /></button>}
      {canBuy && <button className="secondary-button action-aggressive" onClick={onBuy} disabled={disabled}><WalletCards />买</button>}
      {canBuild && <button className="secondary-button action-aggressive" onClick={onBuild} disabled={disabled}><Building2 />盖 {level + 1} 层楼</button>}
      {game.phase === 'action' && hasChoice && <button className="ghost-button action-conservative" onClick={onEnd} disabled={disabled}><Flag />结束回合</button>}
    </div>}
  </section>;
}