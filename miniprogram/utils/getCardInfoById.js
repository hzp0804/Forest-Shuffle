const { CARDS_DATA } = require("../data/cardData");
const { SPECIES_DATA } = require("../data/speciesData");

const { DECK_TYPES, CARD_TYPES, TAGS, IMG_URLS } = require("../data/constants.js");

// 根据卡片类型获取雪碧图，根据卡片ID定位卡片
// 注意：移入此文件后，直接使用常量 IMG_URLS, CARD_TYPES 等

// 获取卡片视图
const getCardVisual = (card) => {
  if (!card) return { bgImg: "", bgSize: "0 0", cssClass: "" };
  const deck = card.deck;
  const type = card.type;
  let img = "";
  let cols = 1;
  let rows = 1;


  if (deck === DECK_TYPES.ALPINE) {
    img = IMG_URLS[TAGS.MOUNTAIN]; // 阿尔卑斯扩展
    cols = 7;
    rows = 4;
  } else if (deck === DECK_TYPES.EDGE) { // 林缘扩展
    img = IMG_URLS[CARD_TYPES.W_CARD];
    cols = 6;
    rows = 6;
  } else { // 基础班
    if (type === CARD_TYPES.TREE || type === CARD_TYPES.W_CARD) {
      img = IMG_URLS[CARD_TYPES.TREE];
      cols = 5;
      rows = 5;
    } else if (type === CARD_TYPES.H_CARD) {
      img = IMG_URLS[CARD_TYPES.H_CARD];
      cols = 7;
      rows = 7;
    } else if (type === CARD_TYPES.V_CARD) {
      img = IMG_URLS[CARD_TYPES.V_CARD];
      cols = 7;
      rows = 7;
    } else {
      img = IMG_URLS[CARD_TYPES.TREE];
      cols = 5;
      rows = 5;
    }
  }
  const cssClass = card.id ? `card-${card.id}` : "";

  return {
    bgImg: img, // 图片链接
    bgSize: `${cols * 100}% ${rows * 100}%`, // 图片大小
    cssClass, // CSS定位
  };
};

// 获取树苗视图
const getSaplingVisual = () => {
  const img = IMG_URLS[CARD_TYPES.V_CARD];
  const cols = 7;
  const rows = 7;
  return {
    bgImg: img,
    bgSize: `${cols * 100}% ${rows * 100}%`,
    bgPosition: "100% 100%",
  };
};

/**
 * 根据 ID 获取卡片的静态详细信息
 * 包括：卡片基础类型、关联的物种详情、背景图视觉信息等
 * @param {string|number} id - 卡片ID
 * @returns {Object} - 卡片详细静态信息对象
 */
const getCardInfoById = (id) => {
  const cardBasic = CARDS_DATA[id];

  // 如果没有找到卡片基础数据，返回 undefined 或空对象，避免报错
  if (!cardBasic) {
    // console.warn(`[getCardInfoById] Card with ID ${id} not found.`);
    return {};
  }

  const speciesDetails = (cardBasic.species || []).map((speciesName) => {
    if (!speciesName) return null;
    // 尝试直接获取
    if (SPECIES_DATA[speciesName]) return SPECIES_DATA[speciesName];

    // 尝试移除空格匹配 key
    const safeKey = speciesName.replace(/\s+/g, '');
    if (SPECIES_DATA[safeKey]) return SPECIES_DATA[safeKey];

    // 兜底
    return {
      name: speciesName,
      description: "未知物种",
    };
  });

  // 获取视觉信息 (bgImg, bgSize, cssClass)
  // 注意：cardBasic 本身不含 id，需要手动传入以生成正确的 card-ID 类名
  const visualInfo = getCardVisual({ ...cardBasic, id });

  return {
    ...cardBasic,
    ...visualInfo, // 合并视觉信息
    speciesDetails, // 包含 species 的详细信息对象数组
    id: id, // 确保ID也在返回对象中
  };
};

module.exports = {
  getCardInfoById,
  getCardVisual,
  getSaplingVisual
};
