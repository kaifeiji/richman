export function createMovementPath(start, dice, finalPosition, cardAction, boardSize = 40) {
  const path = [];
  let position = start;
  for (let step = 0; step < dice; step += 1) {
    position = (position + 1) % boardSize;
    path.push(position);
  }
  if (position === finalPosition) return path;

  const direction = cardAction?.type === 'move' && cardAction.amount < 0 ? -1 : 1;
  for (let step = 0; step < boardSize && position !== finalPosition; step += 1) {
    position = (position + direction + boardSize) % boardSize;
    path.push(position);
  }
  return path;
}