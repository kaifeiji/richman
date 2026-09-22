import { COUNTRIES } from './countries.js';

export const REGIONS = {
  red: { name: '红区', color: '#d94b3d', countryIds: ['korea', 'japan', 'china', 'cambodia', 'indonesia', 'malaysia', 'singapore'] },
  blue: { name: '蓝区', color: '#3f83b3', countryIds: ['uae', 'saudiArabia', 'egypt', 'turkey', 'greece', 'belgium', 'netherlands', 'germany'] },
  green: { name: '绿区', color: '#34845d', countryIds: ['italy', 'france', 'spain', 'england', 'canada', 'mexico', 'america'] },
  yellow: { name: '黄区', color: '#e2a72c', countryIds: ['romania', 'russia', 'chile', 'brazil', 'peru', 'australia', 'pakistan', 'india'] },
};

const REGION_BY_COUNTRY = Object.fromEntries(
  Object.entries(REGIONS).flatMap(([regionId, region]) => region.countryIds.map((countryId) => [countryId, regionId])),
);
const property = (id, countryId) => {
  const regionId = REGION_BY_COUNTRY[countryId];
  return { id, type: 'property', countryId, regionId, regionName: REGIONS[regionId].name, regionColor: REGIONS[regionId].color, ...COUNTRIES[countryId] };
};
const SPECIAL_COLORS = {
  start: '#1d705e', harbor: '#d6a839', chance: '#e2a72c', market: '#3f83b3',
  event: '#d94b3d', environment: '#34845d', arrest: '#735c8f', tax: '#b85d4f',
};
const special = (id, type, name, description) => ({ id, type, name, description, color: SPECIAL_COLORS[type] });

export const BOARD = [
  special(0, 'start', '出发', '经过或到达领取 ¥2000'),
  property(1, 'cambodia'), property(2, 'indonesia'), property(3, 'malaysia'), property(4, 'singapore'),
  special(5, 'harbor', '避风港', '停止 1 回合，地产仍正常收费'),
  property(6, 'uae'), property(7, 'saudiArabia'),
  special(8, 'chance', '机会卡', '抽取一张机会卡'),
  property(9, 'egypt'), property(10, 'turkey'),
  special(11, 'market', '股市', '掷骰决定熊市、休市或牛市'),
  property(12, 'greece'), property(13, 'belgium'), property(14, 'netherlands'), property(15, 'germany'),
  special(16, 'event', '事件卡', '抽取一张事件卡'),
  property(17, 'italy'), property(18, 'france'), property(19, 'spain'),
  special(20, 'environment', '环境保护', '掷骰决定环保支出或绿色补贴'),
  property(21, 'england'), property(22, 'canada'), property(23, 'mexico'), property(24, 'america'),
  special(25, 'arrest', '逮捕', '停止 2 回合，期间不收取地产费用'),
  property(26, 'romania'), property(27, 'russia'),
  special(28, 'event', '事件卡', '抽取一张事件卡'),
  property(29, 'chile'), property(30, 'brazil'),
  special(31, 'tax', '税务局', '掷骰决定罚款、暂停回合或获得退税'),
  property(32, 'peru'), property(33, 'australia'), property(34, 'pakistan'), property(35, 'india'),
  special(36, 'chance', '机会卡', '抽取一张机会卡'),
  property(37, 'korea'), property(38, 'japan'), property(39, 'china'),
];

export const BOARD_INDEX_BY_COUNTRY = Object.fromEntries(
  BOARD.filter((tile) => tile.type === 'property').map((tile) => [tile.countryId, tile.id]),
);

 export const PLAYER_COLORS = ['#4f7bd9', '#9568c7', '#3f83b3', '#34845d'];