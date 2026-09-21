const chanceCards = [
  ['退后五格', '退后 5 格。', { type: 'move', amount: -5 }],
  ['前进五格', '前进 5 格。', { type: 'move', amount: 5 }],
  ['超速罚款', '支付罚款 ¥1500。', { type: 'money', amount: -1500 }],
  ['返回出发', '前进到出发，领取 ¥2000。', { type: 'moveTo', target: 'start', reward: 2000 }],
  ['基金亏损', '支付 ¥1500。', { type: 'money', amount: -1500 }],
  ['埃及之旅', '前进到埃及；如经过出发，领取 ¥2000。', { type: 'moveToCountry', country: 'egypt', passReward: 2000 }],
  ['意大利之旅', '前进到意大利；如经过出发，领取 ¥3000。', { type: 'moveToCountry', country: 'italy', passReward: 3000 }],
  ['免费获释', '保留此卡，可在被逮捕时使用。', { type: 'keepJailFree' }],
  ['旅途美食', '支付 ¥2000。', { type: 'money', amount: -2000 }],
  ['抓钱', '从银行随机获得 ¥500–¥2000。', { type: 'randomMoney', min: 500, max: 2000, step: 500 }],
  ['俄罗斯之旅', '前进到俄罗斯；如经过出发，领取 ¥4000。', { type: 'moveToCountry', country: 'russia', passReward: 4000 }],
  ['建筑贷款到期', '领取 ¥5000。', { type: 'money', amount: 5000 }],
  ['房屋维修', '每拥有一层房屋支付 ¥200。', { type: 'repair', amount: 200 }],
  ['退后五格', '退后 5 格。', { type: 'move', amount: -5 }],
  ['免费获释', '保留此卡，可在被逮捕时使用。', { type: 'keepJailFree' }],
];

const eventCards = [
  ['旅游攻略', '收取咨询费 ¥1200。', { type: 'money', amount: 1200 }],
  ['返回出发', '前进到出发。', { type: 'moveTo', target: 'start', reward: 0 }],
  ['所得退税', '获得 ¥2000。', { type: 'money', amount: 2000 }],
  ['支付学费', '支付 ¥2000。', { type: 'money', amount: -2000 }],
  ['旅游基金到期', '收取 ¥1000。', { type: 'money', amount: 1000 }],
  ['被逮捕', '留在原地停止行动，并支付罚款 ¥2000。', { type: 'arrest', fine: 2000 }],
  ['破坏公共财物', '罚款 ¥2000。', { type: 'money', amount: -2000 }],
  ['世界美食大赛', '获得一等奖奖金 ¥2000。', { type: 'money', amount: 2000 }],
  ['免费获释', '保留此卡，可在被逮捕时使用。', { type: 'keepJailFree' }],
  ['旅途生病', '支付医疗费 ¥1500。', { type: 'money', amount: -1500 }],
  ['出售股票', '获得 ¥2000。', { type: 'money', amount: 2000 }],
  ['奖学金', '获得奖学金 ¥1500。', { type: 'money', amount: 1500 }],
  ['人身保险到期', '支付 ¥1000。', { type: 'money', amount: -1000 }],
  ['房屋维修', '每拥有一层房屋支付 ¥200。', { type: 'repair', amount: 200 }],
  ['生日礼金', '向每位其他玩家收取 ¥200。', { type: 'collectEach', amount: 200 }],
];

const asCards = (kind, cards) => cards.map(([title, text, action], index) => ({
  id: `${kind}-${index + 1}`,
  kind,
  title,
  text,
  action,
}));

export const CHANCE_CARDS = asCards('chance', chanceCards);
export const EVENT_CARDS = asCards('event', eventCards);