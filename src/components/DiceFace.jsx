const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export default function DiceFace({ value }) {
  const activePips = PIPS[value] || [];
  return <span className="dice-face" role="img" aria-label={value ? `骰子 ${value} 点` : '尚未掷骰'}>
    {Array.from({ length: 9 }, (_, index) => <i className={activePips.includes(index) ? 'is-visible' : ''} key={index} />)}
  </span>;
}