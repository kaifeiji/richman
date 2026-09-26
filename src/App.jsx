import { useEffect, useRef, useState } from 'react';
import Board from './components/Board';
import GameOver from './components/GameOver';
import PlayerPanel from './components/PlayerPanel';
import SetupScreen from './components/SetupScreen';
import { BOARD } from './game/board';
import { buildProperty, buyProperty, createGame, drawPendingCard, endTurn, hasOptionalPropertyAction, ownerOf, releaseFromJail, resolvePending, rollDice, rollPendingEffect, sellBuilding, sellProperty, totalAssets } from './game/engine';
import { money } from './game/format';
import { createMovementPath } from './game/movement';

const STORAGE_KEY = 'richman-local-game-v1';
const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
const ROLL_TIMING = [80, 80, 90, 90, 100, 110, 120, 140, 160, 190, 220];
const DICE_REVEAL_DELAY = 1700;
const MOVE_STEP_DELAY = 600;
const MAX_MOVE_DURATION = MOVE_STEP_DELAY * 6;
const CARD_DRAW_DELAY = 1300;
const EFFECT_DELAY = 1000;
const AUTO_ACTION_TIMEOUT = 30000;
const MONEY_EFFECT_DURATION = 1500;
const MONEY_COUNT_DURATION = 550;
const movementStepDelay = (stepCount) => Math.min(MOVE_STEP_DELAY, MAX_MOVE_DURATION / Math.max(1, stepCount));
const kidMoneyParam = Number(new URLSearchParams(window.location.search).get('kid'));
const kidStartingMoney = new URLSearchParams(window.location.search).has('kid') && Number.isFinite(kidMoneyParam) && kidMoneyParam >= 0
  ? kidMoneyParam
  : undefined;

function loadGame() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

export default function App() {
  const [names, setNames] = useState(['玩家 1', '玩家 2']);
  const [game, setGame] = useState(loadGame);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [paused, setPaused] = useState(false);
  const logPausedRef = useRef(false);
  const [animation, setAnimation] = useState({ active: false, rolling: false, revealing: false, moving: false, dice: null });
  const [displayPositions, setDisplayPositions] = useState({});
  const [movingPlayerId, setMovingPlayerId] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [moneyEffects, setMoneyEffects] = useState([]);
  const [moneyPulses, setMoneyPulses] = useState({});
  const [displayedMoney, setDisplayedMoney] = useState(() => Object.fromEntries((game?.players || []).map((player) => [player.id, player.money])));
  const [displayedAssets, setDisplayedAssets] = useState(() => Object.fromEntries((game?.players || []).map((player) => [player.id, totalAssets(player)])));
  const previousMoney = useRef(Object.fromEntries((game?.players || []).map((player) => [player.id, player.money])));

  const apply = (action) => setGame((current) => {
    const next = action(current);
    return next;
  });

  const startGame = () => {
    startGameWithNames(names);
  };

  const startGameWithNames = (gameNames) => {
    const next = createGame(gameNames, kidStartingMoney);
    previousMoney.current = Object.fromEntries(next.players.map((player) => [player.id, player.money]));
    setDisplayedMoney(Object.fromEntries(next.players.map((player) => [player.id, player.money])));
    setDisplayedAssets(Object.fromEntries(next.players.map((player) => [player.id, totalAssets(player)])));
    setMoneyEffects([]);
    setMoneyPulses({});
    setPaused(false);
    setGame(next);
  };

  const updateDisplayPosition = (playerId, position) => {
    setDisplayPositions((current) => ({ ...current, [playerId]: position }));
    setMovingPlayerId(playerId);
  };

  const clearDisplayPositions = () => {
    setDisplayPositions({});
    setMovingPlayerId(null);
  };

  const animatePropertyAction = async (type) => {
    if (!game || animation.active || game.phase !== 'action') return;
    const player = game.players[game.current];
    const tile = BOARD[player.position];
    const level = player.buildings[tile.id] ?? 0;
    const next = type === 'buy' ? buyProperty(game) : buildProperty(game);
    if (next === game) return;
    setAnimation({ active: true, rolling: false, revealing: false, moving: false, dice: null });
    setGame(next);
    setActionFeedback({ type, name: tile.name, amount: type === 'buy' ? tile.ownership : tile.buildCost, level: level + 1 });
    await wait(1600);
    setActionFeedback(null);
    setAnimation({ active: false, rolling: false, revealing: false, moving: false, dice: null });
  };

  const animateRoll = async () => {
    if (!game || animation.active || game.phase !== 'roll' || game.players[game.current].jailed) return;
    const player = game.players[game.current];
    const dice = Math.floor(Math.random() * 6) + 1;
    setAnimation({ active: true, rolling: true, revealing: false, moving: false, dice: 1 });
    for (const duration of ROLL_TIMING) {
      setAnimation({ active: true, rolling: true, revealing: false, moving: false, dice: Math.floor(Math.random() * 6) + 1 });
      await wait(duration);
    }
    setAnimation({ active: true, rolling: false, revealing: true, moving: false, dice });
    await wait(DICE_REVEAL_DELAY);
    const next = rollDice(game, dice);
    const finalPosition = next.players.find((item) => item.id === player.id).position;
    const path = createMovementPath(player.position, dice, finalPosition, next.lastCard?.action);
    setAnimation({ active: true, rolling: false, revealing: false, moving: true, movementKind: 'dice', dice });
    for (const position of path) {
      updateDisplayPosition(player.id, position);
      await wait(movementStepDelay(path.length));
    }
    setGame(next);
    clearDisplayPositions();
    setAnimation({ active: false, rolling: false, revealing: false, moving: false, dice });
  };

  const animateMechanismRoll = async () => {
    if (!game?.pendingEffect?.requiresRoll || animation.active) return;
    const dice = Math.floor(Math.random() * 6) + 1;
    setAnimation({ active: true, rolling: true, revealing: false, moving: false, dice: 1 });
    for (const duration of ROLL_TIMING) {
      setAnimation({ active: true, rolling: true, revealing: false, moving: false, dice: Math.floor(Math.random() * 6) + 1 });
      await wait(duration);
    }
    setAnimation({ active: true, rolling: false, revealing: true, moving: false, dice });
    await wait(DICE_REVEAL_DELAY);
    setGame(rollPendingEffect(game, dice));
    setAnimation({ active: false, rolling: false, revealing: false, moving: false, dice });
  };

  const animateCardDraw = async () => {
    if (game?.pendingEffect?.type !== 'drawCard' || animation.active) return;
    setAnimation({ active: true, rolling: false, revealing: false, moving: false, dice: game.dice });
    await wait(CARD_DRAW_DELAY);
    setGame(drawPendingCard(game));
    setAnimation({ active: false, rolling: false, revealing: false, moving: false, dice: game.dice });
  };

  const executeEffect = async () => {
    if (!game?.pendingEffect || animation.active) return;
    const pending = game.pendingEffect;
    if (pending.requiresRoll && pending.specialRoll === null) return;
    const player = game.players[game.current];
    const next = resolvePending(game);
    const finalPosition = next.players.find((item) => item.id === player.id).position;
    setAnimation({ active: true, rolling: false, revealing: false, moving: false, dice: game.dice });
    await wait(EFFECT_DELAY);
    if (finalPosition !== player.position) {
      const path = createMovementPath(player.position, 0, finalPosition, pending.card?.action);
      setAnimation({ active: true, rolling: false, revealing: false, moving: true, movementKind: 'card', dice: game.dice });
      for (const position of path) {
        updateDisplayPosition(player.id, position);
        await wait(movementStepDelay(path.length));
      }
    }
    setGame(next);
    clearDisplayPositions();
    setAnimation({ active: false, rolling: false, revealing: false, moving: false, dice: game.dice });
  };

  useEffect(() => {
    if (game) localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
    else localStorage.removeItem(STORAGE_KEY);
  }, [game]);

  useEffect(() => {
    if (!game) { previousMoney.current = {}; return undefined; }
    const changes = game.players.flatMap((player) => {
      const previous = previousMoney.current[player.id];
      if (previous === undefined || previous === player.money) return [];
      const moneyElement = document.querySelector(`[data-player-id="${player.id}"] .player-money`);
      const rect = moneyElement?.getBoundingClientRect();
      return [{ id: `${Date.now()}-${player.id}`, playerId: player.id, delta: player.money - previous, targetMoney: player.money, targetAssets: totalAssets(player), targetX: rect ? rect.left + rect.width / 2 : window.innerWidth / 2, targetY: rect ? rect.top + rect.height / 2 : 40 }];
    }).map((effect, index, effects) => ({ ...effect, offset: (index - (effects.length - 1) / 2) * 150 }));
    previousMoney.current = Object.fromEntries(game.players.map((player) => [player.id, player.money]));
    if (changes.length === 0) return undefined;
    setMoneyEffects((current) => [...current, ...changes]);
    changes.forEach((change) => setTimeout(() => {
      setMoneyEffects((current) => current.filter((effect) => effect.id !== change.id));
      setDisplayedMoney((current) => ({ ...current, [change.playerId]: change.targetMoney }));
      setDisplayedAssets((current) => ({ ...current, [change.playerId]: change.targetAssets }));
      setMoneyPulses((current) => ({ ...current, [change.playerId]: { id: change.id, delta: change.delta } }));
      setTimeout(() => setMoneyPulses((current) => {
        if (current[change.playerId]?.id !== change.id) return current;
        const next = { ...current };
        delete next[change.playerId];
        return next;
      }), MONEY_COUNT_DURATION);
    }, MONEY_EFFECT_DURATION));
  }, [game]);

  useEffect(() => {
    if (!game || paused || animation.active || confirmRestart || game.phase === 'gameover') return undefined;
    const timer = setTimeout(() => {
      if (game.phase === 'roll') {
        if (game.players[game.current].jailed) return;
        void animateRoll();
        return;
      }
      if (game.phase === 'resolve') {
        if (game.pendingEffect?.type === 'drawCard') void animateCardDraw();
        else if (game.pendingEffect?.requiresRoll && game.pendingEffect.specialRoll === null) void animateMechanismRoll();
        else void executeEffect();
        return;
      }
      if (game.phase === 'action') {
        const player = game.players[game.current];
        const tile = BOARD[player.position];
        const owner = ownerOf(game, tile.id);
        const canBuy = tile.type === 'property' && !owner && !game.players.some((item) => item.buildings?.[tile.id]) && player.money >= tile.ownership;
        const level = tile.type === 'property' ? player.buildings?.[tile.id] ?? 0 : 0;
        const canBuild = tile.type === 'property' && owner?.id === player.id && !game.builtThisTurn && level < 3 && player.money >= tile.buildCost;
        const actions = [() => endTurn(game)];
        if (canBuy) actions.push((current) => buyProperty(current));
        if (canBuild) actions.push((current) => buildProperty(current));
        const action = actions[Math.floor(Math.random() * actions.length)];
        apply(action);
        return;
      }
      if (game.phase === 'liquidate') {
        const player = game.players.find((item) => item.id === game.pendingDebt?.playerId);
        const saleOptions = player?.properties.flatMap((position) => {
          const level = player.buildings[position] ?? 0;
          return level > 0 ? [{ type: 'building', position }] : [{ type: 'property', position }];
        }) || [];
        const sale = saleOptions[Math.floor(Math.random() * saleOptions.length)];
        const salePosition = sale?.position;
        if (salePosition === undefined) return;
        apply((current) => sale.type === 'building' ? sellBuilding(current, salePosition) : sellProperty(current, salePosition));
      }
    }, AUTO_ACTION_TIMEOUT);
    return () => clearTimeout(timer);
  }, [game, paused, animation.active, confirmRestart]);

  useEffect(() => {
    if (!game || paused || animation.active || game.phase !== 'action' || hasOptionalPropertyAction(game)) return undefined;
    setGame((current) => current === game ? endTurn(current) : current);
    return undefined;
  }, [game, paused, animation.active]);

  useEffect(() => {
    if (!game || paused || animation.active || confirmRestart) return undefined;
    const handleKeyDown = (event) => {
      if (event.repeat || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const isConfirmKey = event.code === 'Space';
      const isPropertyKey = event.key === 'Alt';
      if (!isConfirmKey && !isPropertyKey) return;
      event.preventDefault();
      if (isConfirmKey && game.phase === 'resolve' && game.pendingEffect?.type === 'drawCard') void animateCardDraw();
      else if (isConfirmKey && game.phase === 'resolve' && game.pendingEffect?.requiresRoll && game.pendingEffect.specialRoll === null) void animateMechanismRoll();
      else if (isConfirmKey && game.phase === 'resolve') void executeEffect();
      else if (isConfirmKey && game.phase === 'roll' && !game.players[game.current].jailed) void animateRoll();
      else if (isConfirmKey && game.phase === 'action') apply(endTurn);
      else if (isPropertyKey && game.phase === 'roll' && game.players[game.current].jailed) apply((current) => releaseFromJail(current, 'alt'));
      else if (isPropertyKey && game.phase === 'action') {
        const player = game.players[game.current];
        const tile = BOARD[player.position];
        const owner = ownerOf(game, tile.id);
        if (tile.type === 'property' && !owner) void animatePropertyAction('buy');
        else if (tile.type === 'property' && owner?.id === player.id) void animatePropertyAction('build');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [game, paused, animation.active, confirmRestart]);

  if (!game) return <SetupScreen names={names} setNames={setNames} onStart={startGame} />;

  const restart = () => {
    setGame(null);
    setPaused(false);
    setConfirmRestart(false);
    previousMoney.current = {};
    setMoneyEffects([]);
    setMoneyPulses({});
    setDisplayPositions({});
    setAnimation({ active: false, rolling: false, revealing: false, moving: false, dice: null });
  };
  const activePlayerId = game.players[game.current].id;
  const ranking = [...game.players].sort((left, right) => totalAssets(right) - totalAssets(left));
  const ranks = new Map(ranking.map((player, index) => [player.id, index + 1]));
  return <main className="game-shell">
    <div className="player-strip" style={{ '--player-count': game.players.length }}>{game.players.map((player) => <PlayerPanel key={player.id} player={player} active={player.id === activePlayerId} rank={ranks.get(player.id)} moneyPulse={moneyPulses[player.id]} displayedMoney={displayedMoney[player.id] ?? player.money} displayedAssets={displayedAssets[player.id] ?? totalAssets(player)} />)}</div>
    <div className="game-layout">
      <Board game={game} displayPositions={displayPositions} movingPlayerId={movingPlayerId} animation={animation} actionFeedback={actionFeedback} paused={paused} canAct onTogglePause={() => setPaused((value) => !value)} onLogOpen={() => { if (!paused) { logPausedRef.current = true; setPaused(true); } }} onLogClose={() => { if (logPausedRef.current) { logPausedRef.current = false; setPaused(false); } }} onRestart={() => setConfirmRestart(true)} onRoll={animateRoll} onBuy={() => animatePropertyAction('buy')} onBuild={() => animatePropertyAction('build')} onEnd={() => apply(endTurn)} onRelease={(method) => apply((current) => releaseFromJail(current, method))} onDraw={animateCardDraw} onMechanismRoll={animateMechanismRoll} onResolve={executeEffect} onSellBuilding={(position) => apply((current) => sellBuilding(current, position))} onSellProperty={(position) => apply((current) => sellProperty(current, position))} />
    </div>
    {confirmRestart && <div className="modal-layer"><section className="modal-card confirm-card"><span className="kicker">重新开局</span><h2>放弃当前进度？</h2><p>当前棋局和本地存档都会被清除，此操作无法撤销。</p><div className="confirm-actions"><button className="ghost-button" onClick={() => setConfirmRestart(false)}>取消</button><button className="danger-button" onClick={restart}>确认重新开局</button></div></section></div>}
    <div className="money-fx-layer" aria-hidden="true">{moneyEffects.map((effect) => <span className={effect.delta > 0 ? 'is-gain' : 'is-loss'} style={{ '--money-x': `${effect.targetX - window.innerWidth / 2}px`, '--money-y': `${effect.targetY - window.innerHeight / 2}px`, '--money-offset': `${effect.offset}px` }} key={effect.id}>{effect.delta > 0 ? '+' : '-'}{money(Math.abs(effect.delta))}</span>)}</div>
    {game.phase === 'gameover' && <GameOver game={game} onRestart={restart} />}
  </main>;
}