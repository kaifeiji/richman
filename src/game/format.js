export const money = (value) => `¥${Math.max(0, value).toLocaleString('zh-CN')}`;

export const tileIcon = (type) => ({
	start: 'GO', property: '⌂', chance: '?', event: '!', tax: '%', market: '↗',
	environment: '♻', harbor: '◇', arrest: '×',
}[type] || '•');
