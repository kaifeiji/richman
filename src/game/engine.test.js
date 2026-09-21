import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProperty, buyProperty, createGame, currentFees, drawPendingCard, endTurn, hasOptionalPropertyAction, releaseFromJail, resolvePending, rollDice, rollPendingEffect, sellBuilding, sellProperty, totalAssets } from './engine.js';
import { BOARD } from './board.js';
import { createMovementPath } from './movement.js';

const gameAt = (position, changes = {}) => {
  const game = createGame(['甲', '乙']);
  return { ...game, ...changes, players: game.players.map((player) => player.id === game.current ? { ...player, position } : player) };
};

test('creates a local multiplayer game', () => {
  const game = createGame(['甲', '乙', '丙']);
  assert.equal(game.players.length, 3);
  assert.deepEqual(game.players.map((player) => player.money), [26000, 26000, 26000]);
});

test('buys property and builds only once per turn', () => {
  let game = rollDice(createGame(['甲', '乙']), 1);
  game = buyProperty(game);
  assert.equal(game.players[0].money, 24500);
  game = buildProperty(game);
  assert.equal(game.players[0].buildings[1], 1);
  assert.strictEqual(buildProperty(game), game);
});

test('switches directly to the next player', () => {
  let game = endTurn(rollDice(createGame(['甲', '乙']), 1));
  assert.equal(game.phase, 'roll');
  assert.equal(game.current, 1);
  assert.equal(game.turnCount, 2);
});

test('counts skipped turns in the total turn counter', () => {
  let game = createGame(['甲', '乙', '丙']);
  game = { ...game, phase: 'action', players: game.players.map((player) => player.id === 1 ? { ...player, skipTurns: 1 } : player) };
  game = endTurn(game);
  assert.equal(game.current, 2);
  assert.equal(game.turnCount, 3);
  assert.equal(game.players[1].skipTurns, 0);
});

test('handles repeated skips correctly in a two-player game', () => {
  let game = createGame(['甲', '乙']);
  game = { ...game, phase: 'action', players: game.players.map((player) => player.id === 1 ? { ...player, skipTurns: 2 } : player) };
  game = endTurn(game);
  assert.equal(game.current, 0);
  assert.equal(game.players[1].skipTurns, 1);
  assert.equal(game.turnCount, 3);
  game = endTurn({ ...game, phase: 'action' });
  assert.equal(game.current, 0);
  assert.equal(game.players[1].skipTurns, 0);
  assert.equal(game.turnCount, 5);
});

test('keeps advancing when every active player has a skipped turn', () => {
  let game = createGame(['甲', '乙']);
  game = { ...game, phase: 'action', players: game.players.map((player) => ({ ...player, skipTurns: 1 })) };
  game = endTurn(game);
  assert.equal(game.current, 1);
  assert.equal(game.phase, 'roll');
  assert.deepEqual(game.players.map((player) => player.skipTurns), [0, 0]);
  assert.equal(game.turnCount, 4);
});

test('does not count bankrupt players as skipped turns', () => {
  let game = createGame(['甲', '乙', '丙']);
  game = { ...game, phase: 'action', players: game.players.map((player) => player.id === 1 ? { ...player, bankrupt: true } : player) };
  game = endTurn(game);
  assert.equal(game.current, 2);
  assert.equal(game.turnCount, 2);
});

test('transfers accommodation fee to the owner', () => {
  let game = rollDice(createGame(['甲', '乙']), 1);
  game = buildProperty(buyProperty(game));
  game = endTurn(game);
  const ownerBefore = game.players[0].money;
  const visitorBefore = game.players[1].money;
  game = rollDice(game, 1);
  assert.equal(game.phase, 'resolve');
  assert.equal(game.players[1].money, visitorBefore);
  game = resolvePending(game);
  assert.equal(game.players[0].money, ownerBefore + 1800);
  assert.equal(game.players[1].money, visitorBefore - 1800);
});

test('awards money when passing start', () => {
  const game = rollDice(gameAt(39), 2);
  assert.equal(game.players[0].position, 1);
  assert.equal(game.players[0].money, 28000);
});

test('awards money when landing exactly on start', () => {
  const game = rollDice(gameAt(39), 1);
  assert.equal(game.players[0].position, 0);
  assert.equal(game.players[0].money, 28000);
});

test('awards money when a movement card passes start', () => {
  const game = resolvePending({
    ...gameAt(37),
    phase: 'resolve',
    pendingEffect: { type: 'card', playerId: 0, card: { title: '前进', action: { type: 'move', amount: 5 } } },
  });
  assert.equal(game.players[0].position, 2);
  assert.equal(game.players[0].money, 28000);
});

test('awards money when a card lands exactly on start', () => {
  const game = resolvePending({
    ...gameAt(12),
    phase: 'resolve',
    pendingEffect: { type: 'card', playerId: 0, card: { title: '返回出发', action: { type: 'moveTo', target: 'start', reward: 0 } } },
  });
  assert.equal(game.players[0].position, 0);
  assert.equal(game.players[0].money, 26000);
});

test('uses the card-specific reward when travelling to a country', () => {
  const game = resolvePending({
    ...gameAt(37),
    phase: 'resolve',
    pendingEffect: { type: 'card', playerId: 0, card: { title: '去埃及旅行', action: { type: 'moveToCountry', country: 'egypt', passReward: 2000 } } },
  });
  assert.equal(game.players[0].position, 9);
  assert.equal(game.players[0].money, 28000);
});

test('keeps the player in place when an event card causes arrest', () => {
  const game = resolvePending({
    ...gameAt(12),
    phase: 'resolve',
    pendingEffect: { type: 'card', playerId: 0, card: { title: '被逮捕', action: { type: 'arrest', fine: 2000 } } },
  });
  assert.equal(game.players[0].position, 12);
  assert.equal(game.players[0].money, 24000);
  assert.equal(game.players[0].jailed, true);
});

test('draws a chance card', () => {
  const landed = rollDice(gameAt(7), 1);
  assert.equal(landed.pendingEffect.type, 'drawCard');
  assert.equal(landed.chanceCursor, 0);
  assert.equal(landed.lastCard, null);
  const game = drawPendingCard(landed);
  assert.equal(game.chanceCursor, 1);
  assert.ok(game.lastCard);
  assert.equal(game.pendingEffect.type, 'card');
});

test('waits for confirmation before applying an event card', () => {
  const drawn = drawPendingCard(rollDice(gameAt(15), 1));
  assert.equal(drawn.phase, 'resolve');
  assert.equal(drawn.players[0].money, 26000);
  const resolved = resolvePending(drawn);
  assert.equal(resolved.phase, 'action');
  assert.equal(resolved.players[0].money, 27200);
});

test('requires a separate roll and confirmation for the market', () => {
  const landed = rollDice(gameAt(10), 1);
  assert.equal(landed.phase, 'resolve');
  assert.equal(landed.pendingEffect.requiresRoll, true);
  assert.equal(landed.pendingEffect.specialRoll, null);
  assert.equal(resolvePending(landed), landed);
  const rolled = rollPendingEffect(landed, 6);
  assert.equal(rolled.pendingEffect.amount, 1500);
  assert.equal(rolled.players[0].money, 26000);
  const resolved = resolvePending(rolled);
  assert.equal(resolved.players[0].money, 27500);
  assert.equal(resolved.phase, 'action');
});

test('applies all market roll bands and skips a closed-market turn', () => {
  const landed = rollDice(gameAt(10), 1);
  assert.equal(rollPendingEffect(landed, 1).pendingEffect.amount, -1000);
  assert.equal(rollPendingEffect(landed, 6).pendingEffect.amount, 1500);

  let closed = resolvePending(rollPendingEffect(landed, 3));
  assert.equal(closed.players[0].skipTurns, 1);
  closed = endTurn(closed);
  assert.equal(closed.current, 1);
  closed = endTurn({ ...closed, phase: 'action' });
  assert.equal(closed.current, 1);
  assert.equal(closed.players[0].skipTurns, 0);
});

test('requires an environment roll for payment or subsidy', () => {
  const landed = rollDice(gameAt(19), 1);
  assert.equal(landed.pendingEffect.type, 'environment');
  assert.equal(landed.pendingEffect.requiresRoll, true);

  const cleanup = resolvePending(rollPendingEffect(landed, 2));
  assert.equal(cleanup.players[0].money, 24000);

  const subsidy = resolvePending(rollPendingEffect(landed, 5));
  assert.equal(subsidy.players[0].money, 29000);
});

test('requires a tax roll for fine, business pause, or refund', () => {
  const landed = rollDice(gameAt(30), 1);
  assert.equal(landed.pendingEffect.type, 'tax');
  assert.equal(landed.pendingEffect.requiresRoll, true);

  const fine = resolvePending(rollPendingEffect(landed, 1));
  assert.equal(fine.players[0].money, 23500);

  const business = resolvePending(rollPendingEffect(landed, 4));
  assert.equal(business.players[0].skipTurns, 2);

  const refund = resolvePending(rollPendingEffect(landed, 6));
  assert.equal(refund.players[0].money, 29000);
});

test('supports all jail release outcomes', () => {
  let accepted = gameAt(25);
  accepted = { ...accepted, players: accepted.players.map((player) => player.id === 0 ? { ...player, jailed: true } : player) };
  accepted = releaseFromJail(accepted, 'accept');
  assert.equal(accepted.phase, 'action');
  assert.equal(accepted.players[0].jailed, false);
  assert.equal(accepted.players[0].position, 25);
});

test('suspends fees while an owner is arrested but not in the harbor', () => {
  const base = createGame(['甲', '乙']);
  const owned = { ...base, players: base.players.map((player) => player.id === 0 ? { ...player, properties: [1], buildings: { 1: 1 }, jailed: true } : player) };
  assert.equal(currentFees(owned, BOARD[1]).passFee, 0);
  assert.equal(currentFees(owned, BOARD[1]).stayFee, 0);

  const visitingArrestedOwner = { ...owned, current: 1, players: owned.players.map((player) => player.id === 1 ? { ...player, position: 0 } : player) };
  const freeVisit = rollDice(visitingArrestedOwner, 1);
  assert.equal(freeVisit.players[0].money, 26000);
  assert.equal(freeVisit.players[1].money, 26000);

  const harbor = { ...owned, players: owned.players.map((player) => player.id === 0 ? { ...player, jailed: false, position: 5 } : player) };
  assert.equal(currentFees(harbor, BOARD[1]).passFee, 500);
  assert.equal(currentFees(harbor, BOARD[1]).stayFee, 1800);
  const visitingHarborOwner = { ...harbor, current: 1, players: harbor.players.map((player) => player.id === 1 ? { ...player, position: 0 } : player) };
  const chargedVisit = resolvePending(rollDice(visitingHarborOwner, 1));
  assert.equal(chargedVisit.players[0].money, 27800);
  assert.equal(chargedVisit.players[1].money, 24200);
});

test('shows zero fees until purchased or built', () => {
  const game = createGame(['甲', '乙']);
  assert.deepEqual(currentFees(game, BOARD[1]), { owner: null, suspended: false, completeRegion: false, multiplier: 1, passFee: 0, stayFee: 0 });
  const owned = { ...game, players: game.players.map((player) => player.id === 0 ? { ...player, properties: [1] } : player) };
  assert.equal(currentFees(owned, BOARD[1]).passFee, 500);
  assert.equal(currentFees(owned, BOARD[1]).stayFee, 0);
});

test('doubles fees when one player owns a complete region', () => {
  const game = createGame(['甲', '乙']);
  const redProperties = BOARD.filter((tile) => tile.regionId === 'red').map((tile) => tile.id);
  assert.deepEqual(redProperties, [1, 2, 3, 4, 37, 38, 39]);
  const complete = { ...game, players: game.players.map((player) => player.id === 0 ? { ...player, properties: redProperties, buildings: { 1: 1 } } : player) };
  const fees = currentFees(complete, BOARD[1]);
  assert.equal(fees.completeRegion, true);
  assert.equal(fees.passFee, 1000);
  assert.equal(fees.stayFee, 3600);
});

test('builds step-by-step movement paths', () => {
  assert.deepEqual(createMovementPath(3, 3, 6), [4, 5, 6]);
  assert.deepEqual(createMovementPath(38, 3, 1), [39, 0, 1]);
  assert.deepEqual(createMovementPath(7, 1, 3, { type: 'move', amount: -5 }), [8, 7, 6, 5, 4, 3]);
  assert.deepEqual(createMovementPath(7, 1, 17, { type: 'moveToCountry' }), [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
});

test('only allows buying ownerless property without buildings', () => {
  const landed = rollDice(createGame(['甲', '乙']), 1);
  const orphanBuilding = { ...landed, players: landed.players.map((player) => player.id === 1 ? { ...player, buildings: { 1: 1 } } : player) };
  assert.equal(orphanBuilding.players[0].properties.length, 0);
  assert.strictEqual(buyProperty(orphanBuilding), orphanBuilding);
});

test('detects whether the current player still has a property choice', () => {
  const purchasable = rollDice(createGame(['甲', '乙']), 1);
  assert.equal(hasOptionalPropertyAction(purchasable), true);
  const purchased = buyProperty(purchasable);
  assert.equal(hasOptionalPropertyAction(purchased), true);
  const built = buildProperty(purchased);
  assert.equal(hasOptionalPropertyAction(built), false);
  assert.equal(hasOptionalPropertyAction(rollDice(gameAt(4), 1)), false);
});

test('charges pass fee without a house and accommodation by level', () => {
  const base = createGame(['甲', '乙']);
  for (const [level, expected] of [[0, 500], [1, 1800], [2, 3000], [3, 4800]]) {
    let game = { ...base, current: 1, players: base.players.map((player) => player.id === 0 ? { ...player, properties: [1], buildings: level ? { 1: level } : {} } : { ...player, position: 0 }) };
    game = resolvePending(rollDice(game, 1));
    assert.equal(game.players[0].money, 26000 + expected);
    assert.equal(game.players[1].money, 26000 - expected);
  }
});

test('pauses debt payment for half-price asset sales', () => {
  const base = createGame(['甲', '乙']);
  let game = { ...base, current: 0, players: base.players.map((player) => player.id === 0 ? { ...player, money: 100, position: 0, properties: [2] } : { ...player, properties: [1] }) };
  game = resolvePending(rollDice(game, 1));
  assert.equal(game.phase, 'liquidate');
  assert.equal(game.pendingDebt.amount, 500);
  game = sellProperty(game, 2);
  assert.equal(game.phase, 'action');
  assert.equal(game.pendingDebt, null);
  assert.equal(game.players[0].money, 350);
  assert.equal(game.players[1].money, 26500);
});

test('requires selling buildings before their land', () => {
  const base = createGame(['甲', '乙']);
  const game = { ...base, phase: 'liquidate', pendingDebt: { playerId: 0, toId: null, amount: 9999, reason: '测试欠款' }, players: base.players.map((player) => player.id === 0 ? { ...player, money: 0, properties: [2], buildings: { 2: 2 } } : player) };
  assert.strictEqual(sellProperty(game, 2), game);
  const sold = sellBuilding(game, 2);
  assert.equal(sold.players[0].buildings[2], 1);
  assert.equal(sold.players[0].money, 400);
});

test('automatically advances after accepting an arrested turn', () => {
  let game = createGame(['甲', '乙']);
  game = { ...game, players: game.players.map((player) => player.id === 0 ? { ...player, jailed: true } : player) };
  game = releaseFromJail(game, 'accept');
  game = endTurn(game);
  assert.equal(game.current, 1);
  assert.equal(game.phase, 'roll');
  assert.equal(game.players[0].jailed, false);
});

test('recalculates total assets from cash, land, and buildings', () => {
  const game = createGame(['甲', '乙']);
  assert.equal(totalAssets(game.players[0]), 26000);
  const invested = { ...game.players[0], money: 22700, properties: [1, 2], buildings: { 1: 2 } };
  assert.equal(totalAssets(invested), 27300);
});