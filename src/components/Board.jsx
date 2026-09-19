import { useEffect, useRef, useState } from 'react';
import { Anchor, CircleAlert, CircleHelp, Flag, Landmark, Leaf, LockKeyhole, MapPin, Pause, Play, RotateCcw, TrendingUp } from 'lucide-react';
import { BOARD } from '../game/board';
import { buildingLevel, currentFees, hasBuildingsOn, ownerOf } from '../game/engine';
import { money } from '../game/format';
import CountryCard from './CountryCard';
import MechanismCard from './MechanismCard';
import ActionBar from './ActionBar';
import EventFeed from './EventFeed';
import ActionFeedback from './ActionFeedback';
import LiquidationCard from './LiquidationCard';

function boardPosition(index) {
  if (index <= 11) return { gridRow: 10, gridColumn: 12 - index };
  if (index <= 20) return { gridRow: 21 - index, gridColumn: 1 };
  if (index <= 31) return { gridRow: 1, gridColumn: index - 19 };
  return { gridRow: index - 30, gridColumn: 12 };
}

function piecePosition(position, offsetX, offsetY) {
  const corners = {
    0: { '--piece-x': `calc((100% / 12) * 11 + 26px + ${offsetX}px)`, '--piece-y': `calc((100% / 10) * 9 + 26px + ${offsetY}px)` },
    11: { '--piece-x': `calc((100% / 12) - 26px + ${offsetX}px)`, '--piece-y': `calc((100% / 10) * 9 + 26px + ${offsetY}px)` },
    20: { '--piece-x': `calc((100% / 12) - 26px + ${offsetX}px)`, '--piece-y': `calc((100% / 10) - 26px + ${offsetY}px)` },
    31: { '--piece-x': `calc((100% / 12) * 11 + 26px + ${offsetX}px)`, '--piece-y': `calc((100% / 10) - 26px + ${offsetY}px)` },
  };
  if (corners[position]) return corners[position];
  if (position <= 11) return { '--piece-x': `calc((100% / 12) * ${11.5 - position} + ${offsetX}px)`, '--piece-y': `calc(100% - (100% / 10) - 17px + ${offsetY}px)` };
  if (position <= 20) return { '--piece-x': `calc((100% / 12) + 17px + ${offsetX}px)`, '--piece-y': `calc((100% / 10) * ${20.5 - position} + ${offsetY}px)` };
  if (position <= 31) return { '--piece-x': `calc((100% / 12) * ${position - 19.5} + ${offsetX}px)`, '--piece-y': `calc((100% / 10) + 17px + ${offsetY}px)` };
  return { '--piece-x': `calc(100% - (100% / 12) - 17px + ${offsetX}px)`, '--piece-y': `calc((100% / 10) * ${position - 30.5} + ${offsetY}px)` };
}

function pieceOffset(index, count) {
  const layouts = {
    1: [[0, 0]],
    2: [[-27, 0], [27, 0]],
    3: [[-27, -20], [27, -20], [0, 25]],
    4: [[-27, -27], [27, -27], [-27, 27], [27, 27]],
  };
  return layouts[count]?.[index] || [0, 0];
}

export default function Board({ game, displayPositions, animation, actionFeedback, paused, onTogglePause, onLogOpen, onLogClose, onRestart, onRoll, onBuy, onBuild, onEnd, onRelease, onDraw, onMechanismRoll, onResolve, onSellBuilding, onSellProperty }) {
  const boardRef = useRef(null);
  const [showLog, setShowLog] = useState(false);
  const [countryTip, setCountryTip] = useState(null);
  const [focusLine, setFocusLine] = useState(null);
  const activePlayer = game.players[game.current];
  const activePosition = displayPositions[activePlayer.id] ?? activePlayer.position;
  const selectedTile = BOARD[activePosition];
  const selectedOwner = ownerOf(game, activePosition);
  const selectedFees = currentFees(game, selectedTile);
  const selectedLevel = selectedOwner ? buildingLevel(selectedOwner, activePosition) : 0;
  const selectedHasBuildings = hasBuildingsOn(game, activePosition);
  useEffect(() => {
    let animationFrame;
    const updateLine = () => {
      const board = boardRef.current;
      const piece = board?.querySelector('.game-piece.is-current');
      const operationCard = board?.querySelector('.central-play-card');
      if (!board || !piece || !operationCard) { setFocusLine(null); return; }
      const boardRect = board.getBoundingClientRect();
      const pieceRect = piece.getBoundingClientRect();
      const operationRect = operationCard.getBoundingClientRect();
      const pieceCenterX = pieceRect.left + pieceRect.width / 2 - boardRect.left;
      const pieceCenterY = pieceRect.top + pieceRect.height / 2 - boardRect.top;
      const operationCenterX = operationRect.left + operationRect.width / 2 - boardRect.left;
      const operationCenterY = operationRect.top + operationRect.height / 2 - boardRect.top;
      const deltaX = pieceCenterX - operationCenterX;
      const deltaY = pieceCenterY - operationCenterY;
      const horizontalSide = Math.abs(deltaX) / operationRect.width > Math.abs(deltaY) / operationRect.height;
      const startX = horizontalSide ? (deltaX < 0 ? operationRect.left : operationRect.right) - boardRect.left : operationCenterX;
      const startY = horizontalSide ? operationCenterY : (deltaY < 0 ? operationRect.top : operationRect.bottom) - boardRect.top;
      const distance = Math.hypot(pieceCenterX - startX, pieceCenterY - startY) || 1;
      const clearance = pieceRect.width / 2 + 6;
      const arrowX = pieceCenterX - ((pieceCenterX - startX) / distance) * clearance;
      const arrowY = pieceCenterY - ((pieceCenterY - startY) / distance) * clearance;
      setFocusLine({ x1: arrowX, y1: arrowY, x2: startX, y2: startY });
      if (animation.moving) animationFrame = requestAnimationFrame(updateLine);
    };
    animationFrame = requestAnimationFrame(updateLine);
    window.addEventListener('resize', updateLine);
    return () => { cancelAnimationFrame(animationFrame); window.removeEventListener('resize', updateLine); };
  }, [activePosition, game.current, animation.moving]);
  let actionStatus = null;
  if (selectedTile.type === 'property' && game.phase === 'action' && !animation.active) {
    if (!selectedOwner && !selectedHasBuildings) actionStatus = activePlayer.money >= selectedTile.ownership ? '可购买' : '购买资金不足';
    else if (!selectedOwner) actionStatus = '有房屋，暂不可购买';
    else if (selectedOwner.id !== activePlayer.id) actionStatus = `已被 ${selectedOwner.name} 购买`;
    else if (selectedLevel >= 3) actionStatus = '已建满 3 层';
    else if (game.builtThisTurn) actionStatus = '本回合已建设';
    else actionStatus = activePlayer.money >= selectedTile.buildCost ? '可盖房' : '盖房资金不足';
  }
  return <section className="board-wrap" aria-label="环球棋盘">
    <div className={`board ${animation.moving ? 'is-moving' : ''}`} ref={boardRef}>
      {BOARD.map((tile) => {
        const owner = ownerOf(game, tile.id);
        const occupants = game.players.filter((player) => !player.bankrupt && (displayPositions[player.id] ?? player.position) === tile.id);
        const TileIcon = TILE_ICONS[tile.type];
        return <div
          className={`tile tile-${tile.type} ${activePosition === tile.id ? 'tile-selected' : ''}`}
          style={{ ...boardPosition(tile.id), '--tile-accent': tile.regionColor || tile.color }} key={tile.id}
          onMouseMove={tile.type === 'property' ? (event) => setCountryTip({ tile, x: Math.max(8, Math.min(event.clientX + 16, window.innerWidth - 354)), y: Math.max(8, Math.min(event.clientY + 16, window.innerHeight - 390)) }) : undefined}
          onMouseLeave={tile.type === 'property' ? () => setCountryTip(null) : undefined}
        >
          {owner && <span className="tile-owner-avatar" style={{ background: owner.color }}>{owner.initials}</span>}
          <span className="tile-icon">{TileIcon && <TileIcon />}</span>
          <strong>{tile.name}</strong>
          {owner && buildingLevel(owner, tile.id) > 0 && <b className="level-marker">{buildingLevel(owner, tile.id)}F</b>}
        </div>;
      })}
      <div className="piece-layer" aria-label="玩家位置">
        {game.players.filter((player) => !player.bankrupt).map((player) => {
          const position = displayPositions[player.id] ?? player.position;
          const colocated = game.players.filter((item) => !item.bankrupt && (displayPositions[item.id] ?? item.position) === position);
          const [offsetX, offsetY] = pieceOffset(colocated.findIndex((item) => item.id === player.id), colocated.length);
          const moving = player.id === activePlayer.id && animation.moving;
          return <span className={`game-piece ${player.id === activePlayer.id ? 'is-current' : ''} ${moving ? 'is-moving' : ''}`} style={{ ...piecePosition(position, offsetX, offsetY), '--piece-color': player.color }} key={player.id} title={player.name}><i className="piece-core" key={moving ? position : 'static'}>{player.initials}</i></span>;
        })}
      </div>
      {focusLine && <svg className="player-focus-line" aria-hidden="true"><defs><marker id="player-focus-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,4 L0,8 Z" style={{ fill: activePlayer.color }} /></marker></defs><line x1={focusLine.x2} y1={focusLine.y2} x2={focusLine.x1} y2={focusLine.y1} style={{ '--focus-color': activePlayer.color }} markerEnd="url(#player-focus-arrow)" /></svg>}
      <div className="board-center">
        <div className="board-title">
          <span>AROUND THE WORLD</span><h1>环球大富翁</h1>
          <div className="round-counter">第 {game.round} 轮</div>
          <div className="board-tools"><button onClick={onRestart} disabled={animation.active}>重新开局</button><button onClick={onTogglePause} disabled={animation.active} aria-label={paused ? '继续游戏' : '暂停游戏'}>{paused ? '继续游戏' : '暂停游戏'}</button><button onClick={() => { setShowLog(true); onLogOpen(); }} aria-expanded={showLog}>旅程记录</button></div>
          {showLog && <div className="journey-popover"><EventFeed game={game} onClose={() => { setShowLog(false); onLogClose(); }} /></div>}
        </div>
        <div className="central-play-card" style={{ '--active-player-color': activePlayer.color }}>
          <div className={`play-card-body ${game.pendingEffect && !animation.rolling && !animation.revealing && !animation.moving ? 'has-mechanism' : ''} ${game.phase === 'liquidate' ? 'has-liquidation' : ''}`}>
            {game.phase === 'liquidate' && game.pendingDebt
              ? <LiquidationCard game={game} onSellBuilding={onSellBuilding} onSellProperty={onSellProperty} />
              : game.pendingEffect && !(animation.rolling || animation.revealing)
              ? <><MechanismCard pending={game.pendingEffect} animating={animation.active} /><ActionBar game={game} animation={animation} paused={paused} onRoll={onRoll} onBuy={onBuy} onBuild={onBuild} onEnd={onEnd} onRelease={onRelease} onDraw={onDraw} onMechanismRoll={onMechanismRoll} onResolve={onResolve} /></>
              : <ActionBar game={game} animation={animation} paused={paused} onRoll={onRoll} onBuy={onBuy} onBuild={onBuild} onEnd={onEnd} onRelease={onRelease} onDraw={onDraw} onMechanismRoll={onMechanismRoll} onResolve={onResolve} />}
            {actionFeedback && <div className="feedback-overlay"><ActionFeedback feedback={actionFeedback} /></div>}
          </div>
        </div>
      </div>
    </div>
      {countryTip && (() => {
        const owner = ownerOf(game, countryTip.tile.id);
        const level = owner ? buildingLevel(owner, countryTip.tile.id) : 0;
        const fees = currentFees(game, countryTip.tile);
        return <aside className="country-popper" style={{ left: countryTip.x, top: countryTip.y }}>
          <header style={{ borderColor: countryTip.tile.regionColor }}><div><strong>{countryTip.tile.name}</strong><small>{countryTip.tile.english} · {countryTip.tile.city}</small></div><span style={{ background: countryTip.tile.regionColor }}>{countryTip.tile.regionName}</span></header>
          <div className="popper-owner">{owner ? <><i style={{ background: owner.color }} />{owner.name} 已购买 · {level ? `${level} 层房屋` : '暂无房屋'}{fees.completeRegion ? ' · 整区 ×2' : ''}</> : '尚无所有者 · 无房屋'}</div>
          {fees.suspended && <div className="popper-suspended">所有者被逮捕，当前暂停收费</div>}
          <dl><div><dt>所有权</dt><dd>{money(countryTip.tile.ownership)}</dd></div><div><dt>盖房/层</dt><dd>{money(countryTip.tile.buildCost)}</dd></div><div><dt>基础通关费</dt><dd>{money(countryTip.tile.passFee)}</dd></div></dl>
          <div className="popper-current"><span>当前通关费 <b>{money(fees.passFee)}</b></span><span>当前住宿费 <b>{money(fees.stayFee)}</b></span></div>
          <div className="popper-stays">{countryTip.tile.stayFees.map((fee, index) => <span key={fee}>{index + 1} 层住宿 <b>{money(fee * fees.multiplier)}</b></span>)}</div>
        </aside>;
      })()}
  </section>;
}

const TILE_ICONS = {
  start: Flag,
  property: MapPin,
  harbor: Anchor,
  chance: CircleHelp,
  event: CircleAlert,
  market: TrendingUp,
  environment: Leaf,
  arrest: LockKeyhole,
  tax: Landmark,
};