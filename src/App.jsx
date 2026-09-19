import { useEffect, useRef, useState } from 'react';
import Board from './components/Board';
import GameOver from './components/GameOver';
import PlayerPanel from './components/PlayerPanel';
import SetupScreen from './components/SetupScreen';
import { BOARD } from './game/board';
import { buildProperty, buyProperty, createGame, drawPendingCard, endTurn, hasOptionalPropertyAction, ownerOf, releaseFromJail, resolvePending, rollDice, rollPendingEffect, sellBuilding, sellProperty, totalAssets } from './game/engine';
import { money } from './game/format';
import { createMovementPath } from './game/movement';
import { connectRoom } from './remote/room';

const STORAGE_KEY = 'richman-local-game-v1';
const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
const ROLL_TIMING = [80, 80, 90, 90, 100, 110, 120, 140, 160, 190, 220];
const DICE_REVEAL_DELAY = 1700;
const MOVE_STEP_DELAY = 600;
const MAX_MOVE_DURATION = MOVE_STEP_DELAY * 6;
const CARD_DRAW_DELAY = 1300;
const EFFECT_DELAY = 1000;
const AUTO_ACTION_TIMEOUT = 20000;
const movementStepDelay = (stepCount) => Math.min(MOVE_STEP_DELAY, MAX_MOVE_DURATION / Math.max(1, stepCount));

function loadGame() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

export default function App() {
  const [names, setNames] = useState(['玩家 1', '玩家 2']);
  const [game, setGame] = useState(loadGame);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [remote, setRemote] = useState(null);
  const remoteSessionRef = useRef(null);
  const remoteRoleRef = useRef(null);
  const remotePlayerIdRef = useRef(null);
  const remotePlayersRef = useRef([]);
  const remoteCommandRef = useRef(() => {});
    const [paused, setPaused] = useState(false);
    const logPausedRef = useRef(false);
  const [animation, setAnimation] = useState({ active: false, rolling: false, revealing: false, moving: false, dice: null });
  const [displayPositions, setDisplayPositions] = useState({});
  const [actionFeedback, setActionFeedback] = useState(null);
  const [moneyEffects, setMoneyEffects] = useState([]);
  const [moneyPulses, setMoneyPulses] = useState({});
  const previousMoney = useRef(Object.fromEntries((game?.players || []).map((player) => [player.id, player.money])));
  const previousPlayerId = useRef(game?.players[game.current]?.id);

  const apply = (action) => setGame((current) => {
    const next = action(current);
    return next;
  });

  const commitWithAutoTurn = (next) => setGame(next);

  const startGame = () => {
    startGameWithNames(names);
  };

  const startGameWithNames = (gameNames) => {
    const next = createGame(gameNames);
    previousMoney.current = Object.fromEntries(next.players.map((player) => [player.id, player.money]));
    setMoneyEffects([]);
    setMoneyPulses({});
    setPaused(false);
    setGame(next);
  };

  const updateDisplayPosition = (playerId, position) => {
    setDisplayPositions((current) => ({ ...current, [playerId]: position }));
    if (remoteRoleRef.current === 'host') remoteSessionRef.current?.send({ type: 'movement', movingPlayerId: playerId, position });
  };

  const clearDisplayPositions = () => {
    setDisplayPositions({});
    if (remoteRoleRef.current === 'host') remoteSessionRef.current?.send({ type: 'movement', position: null });
  };

  const handleRemoteMessage = (message) => {
    if (message.type === 'state' && remoteRoleRef.current === 'guest') setGame(message.game);
    if (message.type === 'movement' && remoteRoleRef.current === 'guest') {
      if (message.position === null) setDisplayPositions({});
      else setDisplayPositions((current) => ({ ...current, [message.movingPlayerId]: message.position }));
    }
    if (message.type === 'joined' || message.type === 'players') {
      if (message.type === 'joined') {
        remotePlayerIdRef.current = message.playerId;
        remoteRoleRef.current = message.playerId === 0 ? 'host' : 'guest';
      }
      remotePlayersRef.current = message.players;
      setRemote((current) => {
        if (!current) return current;
        const role = remoteRoleRef.current;
        const ready = role === 'host' && message.players.length > 1;
        const status = role === 'host'
          ? ready ? '玩家已加入，可以开始游戏' : '房间已创建，等待玩家加入'
          : '已进入房间，等待房主开始游戏';
        return { ...current, role, players: message.players, ready, status };
      });
    }
    if (message.type === 'room-full') setRemote((current) => current ? { ...current, status: '房间已满，最多 4 位玩家', error: true } : current);
    if (message.type === 'game-started') setRemote((current) => current ? { ...current, status: '游戏已开始，无法加入此房间', error: true } : current);
    if (message.type === 'start' && remoteRoleRef.current === 'guest') setGame(message.game);
    if (message.type === 'command' && remoteRoleRef.current === 'host') remoteCommandRef.current(message.command, message.playerId);
  };

  const handleEnterRoom = (roomName, playerName) => {
    remoteRoleRef.current = null;
    remotePlayerIdRef.current = null;
    remotePlayersRef.current = [];
    const session = connectRoom({ roomName, nickname: playerName, onMessage: handleRemoteMessage, onOpen: () => setRemote((current) => ({ ...current, status: '已连接，正在进入房间' })), onClose: () => setRemote((current) => current ? current.error ? current : { ...current, status: '房间连接已断开，请返回后重试', error: true } : current), onError: () => setRemote((current) => current ? { ...current, status: '无法连接信令服务，请检查网络后重试', error: true } : current) });
    remoteSessionRef.current = session;
    setRemote({ role: 'joining', roomName, playerName, players: [], ready: false, status: '正在连接房间', onStart: () => { const playerNames = remotePlayersRef.current.map((player) => player.name); const next = createGame(playerNames); startGameWithNames(playerNames); session.send({ type: 'start', game: next }); } });
  };

  const leaveRemoteRoom = () => {
    remoteSessionRef.current?.close();
    remoteSessionRef.current = null;
    remoteRoleRef.current = null;
    remotePlayerIdRef.current = null;
    remotePlayersRef.current = [];
    setRemote(null);
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
    await commitWithAutoTurn(next);
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
    await commitWithAutoTurn(next);
    clearDisplayPositions();
    setAnimation({ active: false, rolling: false, revealing: false, moving: false, dice: game.dice });
  };

  useEffect(() => {
    if (game) localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
    else localStorage.removeItem(STORAGE_KEY);
  }, [game]);

  useEffect(() => {
    if (remoteRoleRef.current === 'host' && game) remoteSessionRef.current?.send({ type: 'state', game });
  }, [game]);

  useEffect(() => {
    if (!game) { previousMoney.current = {}; return undefined; }
    const changes = game.players.flatMap((player) => {
      const previous = previousMoney.current[player.id];
      if (previous === undefined || previous === player.money) return [];
      const moneyElement = document.querySelector(`[data-player-id="${player.id}"] .player-money`);
      const rect = moneyElement?.getBoundingClientRect();
      return [{ id: `${Date.now()}-${player.id}`, playerId: player.id, delta: player.money - previous, targetX: rect ? rect.left + rect.width / 2 : window.innerWidth / 2, targetY: rect ? rect.top + rect.height / 2 : 40 }];
    }).map((effect, index, effects) => ({ ...effect, offset: (index - (effects.length - 1) / 2) * 150 }));
    previousMoney.current = Object.fromEntries(game.players.map((player) => [player.id, player.money]));
    if (changes.length === 0) return undefined;
    setMoneyEffects((current) => [...current, ...changes]);
    const pulseTimer = setTimeout(() => setMoneyPulses((current) => ({ ...current, ...Object.fromEntries(changes.map((effect) => [effect.playerId, { id: effect.id, delta: effect.delta }])) })), 950);
    const clearTimer = setTimeout(() => {
      setMoneyEffects((current) => current.filter((effect) => !changes.some((change) => change.id === effect.id)));
      setMoneyPulses({});
    }, 1550);
    return () => { clearTimeout(pulseTimer); clearTimeout(clearTimer); };
  }, [game]);

  useEffect(() => {
    if (!game || remoteRoleRef.current || paused || animation.active || confirmRestart || game.phase === 'gameover') return undefined;
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

  remoteCommandRef.current = (command, playerId) => {
    if (remoteRoleRef.current !== 'host') return;
    if (game?.players[game.current]?.id !== playerId) return;
    if (command.type === 'roll') void animateRoll();
    if (command.type === 'buy') void animatePropertyAction('buy');
    if (command.type === 'build') void animatePropertyAction('build');
    if (command.type === 'end') apply(endTurn);
    if (command.type === 'release') apply((current) => releaseFromJail(current, command.method));
    if (command.type === 'draw') void animateCardDraw();
    if (command.type === 'mechanismRoll') void animateMechanismRoll();
    if (command.type === 'resolve') void executeEffect();
    if (command.type === 'sellBuilding') apply((current) => sellBuilding(current, command.position));
    if (command.type === 'sellProperty') apply((current) => sellProperty(current, command.position));
  };

  useEffect(() => {
    if (!game || remoteRoleRef.current === 'guest' || paused || animation.active || game.phase !== 'action' || hasOptionalPropertyAction(game)) return undefined;
    setGame((current) => current === game ? endTurn(current) : current);
    return undefined;
  }, [game, paused, animation.active]);

  useEffect(() => {
    if (!game || remoteRoleRef.current === 'guest' || paused || animation.active || game.phase !== 'roll') return undefined;
    const player = game.players[game.current];
    if (!player.jailed) return undefined;
    if (player.jailFreeCards > 0) return undefined;
    const delay = 250;
    const timer = setTimeout(() => setGame((current) => {
      if (current !== game) return current;
      return endTurn(releaseFromJail(current, 'accept'));
    }), delay);
    return () => clearTimeout(timer);
  }, [game, paused, animation.active]);

  useEffect(() => {
    if (!game || paused || animation.active || confirmRestart) return undefined;
    const handleKeyDown = (event) => {
      if (event.repeat || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (remoteRoleRef.current && game.players[game.current]?.id !== remotePlayerIdRef.current) return;
      const isRollKey = event.key === 'Enter';
      const isPropertyKey = event.key === '+' || event.code === 'NumpadAdd';
      if (!isRollKey && !isPropertyKey) return;
      event.preventDefault();
      if (isRollKey && game.phase === 'resolve' && game.pendingEffect?.type === 'drawCard') void animateCardDraw();
      else if (isRollKey && game.phase === 'resolve' && game.pendingEffect?.requiresRoll && game.pendingEffect.specialRoll === null) void animateMechanismRoll();
      else if (isRollKey && game.phase === 'resolve') void executeEffect();
      else if (isRollKey && game.phase === 'roll' && !game.players[game.current].jailed) void animateRoll();
      else if (isRollKey && game.phase === 'action') apply(endTurn);
      else if (isPropertyKey && game.phase === 'roll' && game.players[game.current].jailed && game.players[game.current].jailFreeCards > 0) apply((current) => releaseFromJail(current, 'card'));
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

  if (!game) return <SetupScreen names={names} setNames={setNames} onStart={startGame} onEnterRoom={handleEnterRoom} onLeaveRoom={leaveRemoteRoom} remote={remote} />;

  const restart = () => {
    setGame(null);
    setPaused(false);
    setConfirmRestart(false);
    previousMoney.current = {};
    setMoneyEffects([]);
    setMoneyPulses({});
    previousPlayerId.current = undefined;
    setDisplayPositions({});
    setAnimation({ active: false, rolling: false, revealing: false, moving: false, dice: null });
  };
  const activePlayerId = game.players[game.current].id;
  const ranking = [...game.players].sort((left, right) => totalAssets(right) - totalAssets(left));
  const ranks = new Map(ranking.map((player, index) => [player.id, index + 1]));
  const remoteInvoke = (command, localAction) => {
    if (remoteRoleRef.current) {
      if (game.players[game.current]?.id !== remotePlayerIdRef.current) return;
      if (remoteRoleRef.current === 'guest') {
      remoteSessionRef.current?.send({ type: 'command', playerId: remotePlayerIdRef.current, command });
      } else localAction();
    }
    else localAction();
  };
  const canAct = !remoteRoleRef.current || game.players[game.current]?.id === remotePlayerIdRef.current;
  return <main className="game-shell">
    <div className="player-strip" style={{ '--player-count': game.players.length }}>{game.players.map((player) => <PlayerPanel key={player.id} player={player} active={player.id === activePlayerId} rank={ranks.get(player.id)} moneyPulse={moneyPulses[player.id]} />)}</div>
    <div className="game-layout">
      <Board game={game} displayPositions={displayPositions} animation={animation} actionFeedback={actionFeedback} paused={paused} canAct={canAct} onTogglePause={() => setPaused((value) => !value)} onLogOpen={() => { if (!paused) { logPausedRef.current = true; setPaused(true); } }} onLogClose={() => { if (logPausedRef.current) { logPausedRef.current = false; setPaused(false); } }} onRestart={() => setConfirmRestart(true)} onRoll={() => remoteInvoke({ type: 'roll' }, animateRoll)} onBuy={() => remoteInvoke({ type: 'buy' }, () => animatePropertyAction('buy'))} onBuild={() => remoteInvoke({ type: 'build' }, () => animatePropertyAction('build'))} onEnd={() => remoteInvoke({ type: 'end' }, () => apply(endTurn))} onRelease={(method) => remoteInvoke({ type: 'release', method }, () => apply((current) => releaseFromJail(current, method)))} onDraw={() => remoteInvoke({ type: 'draw' }, animateCardDraw)} onMechanismRoll={() => remoteInvoke({ type: 'mechanismRoll' }, animateMechanismRoll)} onResolve={() => remoteInvoke({ type: 'resolve' }, executeEffect)} onSellBuilding={(position) => remoteInvoke({ type: 'sellBuilding', position }, () => apply((current) => sellBuilding(current, position)))} onSellProperty={(position) => remoteInvoke({ type: 'sellProperty', position }, () => apply((current) => sellProperty(current, position)))} />
    </div>
    {confirmRestart && <div className="modal-layer"><section className="modal-card confirm-card"><span className="kicker">重新开局</span><h2>放弃当前进度？</h2><p>当前棋局和本地存档都会被清除，此操作无法撤销。</p><div className="confirm-actions"><button className="ghost-button" onClick={() => setConfirmRestart(false)}>取消</button><button className="danger-button" onClick={restart}>确认重新开局</button></div></section></div>}
    <div className="money-fx-layer" aria-hidden="true">{moneyEffects.map((effect) => <span className={effect.delta > 0 ? 'is-gain' : 'is-loss'} style={{ '--money-x': `${effect.targetX - window.innerWidth / 2}px`, '--money-y': `${effect.targetY - window.innerHeight / 2}px`, '--money-offset': `${effect.offset}px` }} key={effect.id}>{effect.delta > 0 ? '+' : '-'}{money(Math.abs(effect.delta))}</span>)}</div>
    {game.phase === 'gameover' && <GameOver game={game} onRestart={restart} />}
  </main>;
}