import { BOARD, BOARD_INDEX_BY_COUNTRY, PLAYER_COLORS, REGIONS } from './board.js';
import { CHANCE_CARDS, EVENT_CARDS } from './cards.js';

export const STARTING_MONEY = 26000;
export const START_REWARD = 2000;

const addLog = (game, message) => ({ ...game, log: [message, ...game.log] });
const playerById = (game, id) => game.players.find((player) => player.id === id);
const updatePlayer = (game, id, changes) => ({ ...game, players: game.players.map((player) => player.id === id ? { ...player, ...changes } : player) });

export function createGame(names = ['玩家 1', '玩家 2']) {
  const validNames = names.map((name) => name.trim()).filter(Boolean).slice(0, 4);
  if (validNames.length < 2) throw new Error('至少需要两名玩家');
  const players = validNames.map((name, id) => ({
    id, name, color: PLAYER_COLORS[id], initials: name.slice(0, 1), money: STARTING_MONEY,
    position: 0, properties: [], buildings: {}, jailFreeCards: 0, jailed: false, skipTurns: 0, bankrupt: false,
  }));
  return { players, current: 0, round: 1, turnCount: 1, phase: 'roll', dice: null, lastCard: null, pendingEffect: null, builtThisTurn: false, chanceCursor: 0, eventCursor: 0, winner: null, log: [`游戏开始，由 ${players[0].name} 先行动。`] };
}

export const activePlayers = (game) => game.players.filter((player) => !player.bankrupt);
export const currentPlayer = (game) => game.players[game.current];
export const ownerOf = (game, position) => game.players.find((player) => !player.bankrupt && player.properties.includes(position));
export const buildingLevel = (player, position) => player.buildings[position] ?? 0;
export const hasBuildingsOn = (game, position) => game.players.some((player) => buildingLevel(player, position) > 0);
export const totalBuildings = (player) => Object.values(player.buildings).reduce((sum, level) => sum + level, 0);
export const totalAssets = (player) => player.money + player.properties.reduce((sum, position) => {
  const tile = BOARD[position];
  return sum + tile.ownership + buildingLevel(player, position) * tile.buildCost;
}, 0);
export const ownsRegion = (game, playerId, regionId) => REGIONS[regionId].countryIds.every((countryId) => {
  const position = BOARD_INDEX_BY_COUNTRY[countryId];
  return playerById(game, playerId)?.properties.includes(position);
});
export function currentFees(game, tile) {
  const owner = tile.type === 'property' ? ownerOf(game, tile.id) : null;
  if (!owner) return { owner: null, suspended: false, completeRegion: false, multiplier: 1, passFee: 0, stayFee: 0 };
  if (owner.jailed) return { owner, suspended: true, completeRegion: false, multiplier: 1, passFee: 0, stayFee: 0 };
  const level = buildingLevel(owner, tile.id);
  const completeRegion = ownsRegion(game, owner.id, tile.regionId);
  const multiplier = completeRegion ? 2 : 1;
  return { owner, suspended: false, completeRegion, multiplier, passFee: tile.passFee * multiplier, stayFee: level > 0 ? tile.stayFees[level - 1] * multiplier : 0 };
}

function bankruptPlayer(game, playerId, creditorId) {
  const player = playerById(game, playerId);
  let next = game;
  if (creditorId !== null) {
    const creditor = playerById(next, creditorId);
    next = updatePlayer(next, creditorId, { properties: [...creditor.properties, ...player.properties], buildings: { ...creditor.buildings, ...player.buildings } });
  }
  next = updatePlayer(next, playerId, { bankrupt: true, properties: [], buildings: {}, money: 0 });
  return addLog(next, `${player.name} 无法偿付并破产，退出游戏。`);
}

function settlePayment(game, fromId, toId, amount, reason) {
  const payer = playerById(game, fromId);
  const hasAssets = payer.properties.length > 0 || totalBuildings(payer) > 0;
  if (payer.money < amount && hasAssets) {
    return addLog({ ...game, phase: 'liquidate', pendingDebt: { playerId: fromId, toId, amount, reason } }, `${payer.name} 现金不足，需要半价变卖资产筹集 ¥${amount.toLocaleString('zh-CN')}。`);
  }
  const paid = Math.min(payer.money, Math.max(0, amount));
  let next = updatePlayer(game, fromId, { money: payer.money - paid });
  if (toId !== null) {
    const receiver = playerById(next, toId);
    next = updatePlayer(next, toId, { money: receiver.money + paid });
  }
  next = addLog(next, `${payer.name}${reason}，支付 ¥${paid.toLocaleString('zh-CN')}。`);
  return paid < amount ? bankruptPlayer(next, fromId, toId) : next;
}

function moveBy(game, playerId, amount, reward = START_REWARD) {
  const player = playerById(game, playerId);
  const raw = player.position + amount;
  const position = ((raw % BOARD.length) + BOARD.length) % BOARD.length;
  let next = updatePlayer(game, playerId, { position });
  if (amount > 0 && raw >= BOARD.length) {
    const moved = playerById(next, playerId);
    next = updatePlayer(next, playerId, { money: moved.money + reward });
    next = addLog(next, `${player.name} 经过出发，领取 ¥${reward.toLocaleString('zh-CN')}。`);
  }
  return next;
}

function moveTo(game, playerId, position, passReward = 0) {
  const player = playerById(game, playerId);
  let next = updatePlayer(game, playerId, { position });
  if (position < player.position && passReward > 0) {
    const moved = playerById(next, playerId);
    next = updatePlayer(next, playerId, { money: moved.money + passReward });
    next = addLog(next, `${player.name} 经过出发，领取 ¥${passReward.toLocaleString('zh-CN')}。`);
  }
  return next;
}

function applyCard(game, playerId, card) {
  const action = card.action;
  const player = playerById(game, playerId);
  let next = addLog({ ...game, lastCard: card }, `${player.name} 执行「${card.title}」。`);
  if (action.type === 'money') next = action.amount >= 0 ? updatePlayer(next, playerId, { money: player.money + action.amount }) : settlePayment(next, playerId, null, -action.amount, '向银行付款');
  if (action.type === 'randomMoney') {
    const amount = action.min + Math.floor(Math.random() * (Math.floor((action.max - action.min) / action.step) + 1)) * action.step;
    next = addLog(updatePlayer(next, playerId, { money: player.money + amount }), `${player.name} 抓到 ¥${amount.toLocaleString('zh-CN')}。`);
  }
  if (action.type === 'move') next = moveBy(next, playerId, action.amount, 0);
  if (action.type === 'moveTo') next = moveTo(next, playerId, 0, action.reward);
  if (action.type === 'moveToCountry') next = moveTo(next, playerId, BOARD_INDEX_BY_COUNTRY[action.country], action.passReward);
  if (action.type === 'keepJailFree') next = updatePlayer(next, playerId, { jailFreeCards: player.jailFreeCards + 1 });
  if (action.type === 'repair') next = settlePayment(next, playerId, null, totalBuildings(player) * action.amount, '支付房屋维修费');
  if (action.type === 'collectEach') for (const other of activePlayers(next).filter((item) => item.id !== playerId)) next = settlePayment(next, other.id, playerId, action.amount, `向 ${player.name} 支付生日礼金`);
  if (action.type === 'arrest') {
    next = settlePayment(moveTo(next, playerId, 25), playerId, null, action.fine, '支付逮捕罚款');
    if (!playerById(next, playerId).bankrupt) next = updatePlayer(next, playerId, { jailed: true });
  }
  if (next.phase === 'liquidate' || next.phase === 'gameover') return next;
  if (['move', 'moveTo', 'moveToCountry'].includes(action.type) && !playerById(next, playerId).bankrupt) return queueLanding(next, playerId);
  return { ...next, phase: 'action' };
}

function drawCard(game, playerId, kind) {
  const cards = kind === 'chance' ? CHANCE_CARDS : EVENT_CARDS;
  const key = kind === 'chance' ? 'chanceCursor' : 'eventCursor';
  const card = cards[game[key] % cards.length];
  const player = playerById(game, playerId);
  return addLog({ ...game, [key]: game[key] + 1, lastCard: card, phase: 'resolve', pendingEffect: { type: 'card', playerId, card } }, `${player.name} 抽到「${card.title}」。`);
}

export function drawPendingCard(game) {
  const pending = game.pendingEffect;
  if (game.phase !== 'resolve' || pending?.type !== 'drawCard') return game;
  return drawCard({ ...game, pendingEffect: null }, pending.playerId, pending.kind);
}

function queueLanding(game, playerId) {
  const player = playerById(game, playerId);
  const tile = BOARD[player.position];
  if (tile.type === 'property') {
    const { owner, suspended, completeRegion, passFee, stayFee } = currentFees(game, tile);
    if (owner && owner.id !== playerId) {
      if (suspended) return addLog({ ...game, phase: 'action', pendingEffect: null }, `${owner.name} 正被逮捕，${player.name} 本次无需支付费用。`);
      const level = buildingLevel(owner, tile.id);
      const fee = level === 0 ? passFee : stayFee;
      const bonus = completeRegion ? '（整区 ×2）' : '';
      const feeTitle = level ? `${tile.name}住宿费` : `${tile.name}通关费`;
      return { ...game, phase: 'resolve', pendingEffect: { type: 'payment', playerId, ownerId: owner.id, amount: fee, title: `向 ${owner.name} 支付 ¥${fee.toLocaleString('zh-CN')} ${level ? '住宿费' : '通关费'}${bonus}`, countryName: tile.name, text: `向 ${owner.name} 支付 ¥${fee.toLocaleString('zh-CN')} ${feeTitle}${bonus}` } };
    }
    return { ...game, phase: 'action', pendingEffect: null };
  }
  if (tile.type === 'chance' || tile.type === 'event') return { ...game, phase: 'resolve', lastCard: null, pendingEffect: { type: 'drawCard', playerId, kind: tile.type, title: tile.name, text: `从${tile.name}牌堆抽取一张卡片` } };
  if (tile.type === 'tax') {
    return { ...game, phase: 'resolve', pendingEffect: { type: 'tax', playerId, requiresRoll: true, specialRoll: null, amount: null, outcome: null, title: '税务局', text: '掷骰决定税务罚款、办理业务或获得退税' } };
  }
  if (tile.type === 'environment') {
    return { ...game, phase: 'resolve', pendingEffect: { type: 'environment', playerId, requiresRoll: true, specialRoll: null, amount: null, outcome: null, title: '环境保护', text: '掷骰决定环保支出或绿色补贴' } };
  }
  if (tile.type === 'market') {
    return { ...game, phase: 'resolve', pendingEffect: { type: 'market', playerId, requiresRoll: true, specialRoll: null, amount: null, title: '股市', text: '重新掷骰决定本次股市盈亏' } };
  }
  if (tile.type === 'arrest') return { ...game, phase: 'resolve', pendingEffect: { type: 'arrest', playerId, title: '逮捕', text: '进入逮捕状态，下回合使用获释卡或跳过本回合' } };
  if (tile.type === 'harbor') return { ...game, phase: 'resolve', pendingEffect: { type: 'harbor', playerId, title: '避风港', text: '风平浪静，安心停靠' } };
  return { ...game, phase: 'action', pendingEffect: null };
}

export function rollDice(game, forcedDice) {
  if (game.phase !== 'roll' || game.winner !== null || currentPlayer(game).jailed) return game;
  const player = currentPlayer(game);
  const dice = forcedDice ?? Math.floor(Math.random() * 6) + 1;
  let next = moveBy({ ...game, dice, lastCard: null }, player.id, dice);
  next = addLog(next, `${player.name} 掷出 ${dice} 点，到达 ${BOARD[playerById(next, player.id).position].name}。`);
  return queueLanding(next, player.id);
}

export function rollPendingEffect(game, forcedDice) {
  const pending = game.pendingEffect;
  if (game.phase !== 'resolve' || !pending?.requiresRoll || pending.specialRoll !== null) return game;
  const dice = forcedDice ?? Math.floor(Math.random() * 6) + 1;
  if (pending.type === 'market') {
    const outcome = dice <= 2 ? 'bear' : dice <= 4 ? 'closed' : 'bull';
    const amount = outcome === 'bear' ? -1000 : outcome === 'bull' ? 1500 : 0;
    const text = outcome === 'bear' ? `掷出 ${dice} 点，熊市，支付 ¥1,000` : outcome === 'closed' ? `掷出 ${dice} 点，休市，暂停一回合` : `掷出 ${dice} 点，牛市，领取 ¥1,500`;
    return { ...game, dice, pendingEffect: { ...pending, specialRoll: dice, amount, outcome, text } };
  }
  if (pending.type === 'environment') {
    const outcome = dice <= 3 ? 'cleanup' : 'greenEnergy';
    const amount = outcome === 'cleanup' ? -2000 : 3000;
    const text = outcome === 'cleanup' ? `掷出 ${dice} 点，垃圾处理系统升级，支付 ¥2,000` : `掷出 ${dice} 点，开发绿色能源，领取补贴 ¥3,000`;
    return { ...game, dice, pendingEffect: { ...pending, specialRoll: dice, amount, outcome, text } };
  }
  if (pending.type === 'tax') {
    const outcome = dice <= 2 ? 'fine' : dice <= 4 ? 'business' : 'refund';
    const amount = outcome === 'fine' ? -2500 : outcome === 'refund' ? 3000 : 0;
    const text = outcome === 'fine' ? `掷出 ${dice} 点，税务罚款，支付 ¥2,500` : outcome === 'business' ? `掷出 ${dice} 点，办理业务，暂停 2 回合` : `掷出 ${dice} 点，获得退税 ¥3,000`;
    return { ...game, dice, pendingEffect: { ...pending, specialRoll: dice, amount, outcome, text } };
  }
  return game;
}

export function resolvePending(game) {
  if (game.phase !== 'resolve' || !game.pendingEffect) return game;
  const pending = game.pendingEffect;
  if (pending.type === 'drawCard') return game;
  if (pending.requiresRoll && pending.specialRoll === null) return game;
  const player = playerById(game, pending.playerId);
  let next = { ...game, pendingEffect: null };
  if (pending.type === 'card') return applyCard(next, pending.playerId, pending.card);
  if (pending.type === 'payment') next = settlePayment(next, pending.playerId, pending.ownerId, pending.amount, `结算「${pending.title}」`);
  if (pending.type === 'tax') {
    if (pending.outcome === 'business') next = addLog(updatePlayer(next, pending.playerId, { skipTurns: (player.skipTurns ?? 0) + 2 }), `${player.name} 在税务局办理业务，将暂停 2 回合。`);
    else next = pending.amount < 0 ? settlePayment(next, pending.playerId, null, -pending.amount, '支付税务罚款') : addLog(updatePlayer(next, pending.playerId, { money: player.money + pending.amount }), `${player.name} 获得退税 ¥${pending.amount.toLocaleString('zh-CN')}。`);
  }
  if (pending.type === 'environment') next = pending.amount < 0 ? settlePayment(next, pending.playerId, null, -pending.amount, '升级垃圾处理系统') : addLog(updatePlayer(next, pending.playerId, { money: player.money + pending.amount }), `${player.name} 获得绿色能源补贴 ¥${pending.amount.toLocaleString('zh-CN')}。`);
  if (pending.type === 'market') {
    if (pending.outcome === 'closed') next = addLog(updatePlayer(next, pending.playerId, { skipTurns: (player.skipTurns ?? 0) + 1 }), `${player.name} 遇到休市，将暂停一回合。`);
    else next = pending.amount < 0 ? settlePayment(next, pending.playerId, null, -pending.amount, '遭遇熊市') : addLog(updatePlayer(next, pending.playerId, { money: player.money + pending.amount }), `${player.name} 遇到牛市，领取 ¥${pending.amount.toLocaleString('zh-CN')}。`);
  }
  if (pending.type === 'arrest') next = addLog(updatePlayer(next, pending.playerId, { jailed: true }), `${player.name} 被逮捕；下回合使用获释卡或跳过本回合。`);
  if (pending.type === 'harbor') next = addLog(next, `${player.name} 在避风港安全停留。`);
  return next.phase === 'liquidate' || next.phase === 'gameover' ? next : { ...next, phase: 'action' };
}

function finishDebtIfPossible(game) {
  const debt = game.pendingDebt;
  if (!debt) return game;
  const player = playerById(game, debt.playerId);
  if (player.money >= debt.amount) {
    const paid = settlePayment({ ...game, phase: 'action', pendingDebt: null }, debt.playerId, debt.toId, debt.amount, debt.reason);
    return { ...paid, phase: paid.phase === 'gameover' ? 'gameover' : 'action', pendingDebt: null };
  }
  if (player.properties.length === 0 && totalBuildings(player) === 0) {
    return checkWinner({ ...bankruptPlayer({ ...game, phase: 'action', pendingDebt: null }, debt.playerId, debt.toId), pendingDebt: null });
  }
  return game;
}

export function sellBuilding(game, position) {
  const debt = game.pendingDebt;
  if (game.phase !== 'liquidate' || !debt) return game;
  const player = playerById(game, debt.playerId);
  const level = buildingLevel(player, position);
  const tile = BOARD[position];
  if (tile?.type !== 'property' || level <= 0 || !player.properties.includes(position)) return game;
  const refund = Math.floor(tile.buildCost / 2);
  const buildings = { ...player.buildings };
  if (level === 1) delete buildings[position];
  else buildings[position] = level - 1;
  let next = updatePlayer(game, player.id, { money: player.money + refund, buildings });
  next = addLog(next, `${player.name} 半价出售 ${tile.name} 的一层房屋，获得 ¥${refund.toLocaleString('zh-CN')}。`);
  return finishDebtIfPossible(next);
}

export function sellProperty(game, position) {
  const debt = game.pendingDebt;
  if (game.phase !== 'liquidate' || !debt) return game;
  const player = playerById(game, debt.playerId);
  const tile = BOARD[position];
  if (tile?.type !== 'property' || !player.properties.includes(position) || buildingLevel(player, position) > 0) return game;
  const refund = Math.floor(tile.ownership / 2);
  let next = updatePlayer(game, player.id, { money: player.money + refund, properties: player.properties.filter((item) => item !== position) });
  next = addLog(next, `${player.name} 半价出售 ${tile.name} 土地，获得 ¥${refund.toLocaleString('zh-CN')}。`);
  return finishDebtIfPossible(next);
}

export function buyProperty(game) {
  const player = currentPlayer(game);
  const tile = BOARD[player.position];
  if (game.phase !== 'action' || tile.type !== 'property' || ownerOf(game, tile.id) || hasBuildingsOn(game, tile.id) || player.money < tile.ownership) return game;
  return addLog(updatePlayer(game, player.id, { money: player.money - tile.ownership, properties: [...player.properties, tile.id] }), `${player.name} 以 ¥${tile.ownership.toLocaleString('zh-CN')} 买下 ${tile.name}。`);
}

export function buildProperty(game) {
  const player = currentPlayer(game);
  const tile = BOARD[player.position];
  const level = buildingLevel(player, tile.id);
  if (game.phase !== 'action' || game.builtThisTurn || tile.type !== 'property' || !player.properties.includes(tile.id) || level >= 3 || player.money < tile.buildCost) return game;
  return addLog({ ...updatePlayer(game, player.id, { money: player.money - tile.buildCost, buildings: { ...player.buildings, [tile.id]: level + 1 } }), builtThisTurn: true }, `${player.name} 在 ${tile.name} 建造第 ${level + 1} 层，支付 ¥${tile.buildCost.toLocaleString('zh-CN')}。`);
}

export function releaseFromJail(game, method, forcedDice) {
  const player = currentPlayer(game);
  if (game.phase !== 'roll' || !player.jailed) return game;
  if (method === 'card' && player.jailFreeCards > 0) return addLog(updatePlayer(game, player.id, { jailed: false, jailFreeCards: player.jailFreeCards - 1 }), `${player.name} 使用免费获释卡。`);
  if (method === 'accept') return addLog(updatePlayer({ ...game, phase: 'action' }, player.id, { jailed: false }), `${player.name} 选择跳过本回合。`);
  return game;
}

function checkWinner(game) {
  const alive = activePlayers(game);
  return alive.length === 1 ? { ...game, winner: alive[0].id, phase: 'gameover' } : game;
}

export function endTurn(game) {
  if (game.phase !== 'action') return game;
  let nextIndex = game.current;
  let next = game;
  let round = game.round;
  let turnCount = game.turnCount ?? 1;
  const totalSkips = activePlayers(game).reduce((sum, player) => sum + (player.skipTurns ?? 0), 0);
  const maxChecks = game.players.length * (totalSkips + 2);
  for (let checked = 0; checked < maxChecks; checked += 1) {
    nextIndex = (nextIndex + 1) % game.players.length;
    if (nextIndex === 0) round += 1;
    const candidate = next.players[nextIndex];
    if (candidate.bankrupt) continue;
    turnCount += 1;
    if ((candidate.skipTurns ?? 0) > 0) {
      next = updatePlayer(next, candidate.id, { skipTurns: candidate.skipTurns - 1 });
      next = addLog(next, `${candidate.name} 因休市暂停本回合。`);
      continue;
    }
    return checkWinner({ ...next, current: nextIndex, round, turnCount, phase: 'roll', dice: null, lastCard: null, pendingEffect: null, builtThisTurn: false });
  }
  return checkWinner({ ...next, round, turnCount });
}

export function hasOptionalPropertyAction(game) {
  if (game.phase !== 'action') return false;
  const player = currentPlayer(game);
  const tile = BOARD[player.position];
  if (tile.type !== 'property') return false;
  const owner = ownerOf(game, tile.id);
  if (!owner) return !hasBuildingsOn(game, tile.id) && player.money >= tile.ownership;
  return owner.id === player.id && !game.builtThisTurn && buildingLevel(player, tile.id) < 3 && player.money >= tile.buildCost;
}