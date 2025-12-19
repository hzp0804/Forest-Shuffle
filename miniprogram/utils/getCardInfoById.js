const { CARDS_DATA } = require("../data/cardData");
const { SPECIES_DATA } = require("../data/speciesData");
const { DECK_TYPES, CARD_TYPES, TAGS, IMG_URLS } = require("../data/constants.js");

// 性能优化：缓存反向索引 (Added comment to force reload)
let nameToSpeciesCache = null;
let trimmedKeyCache = null;

const buildCaches = () => {
  if (nameToSpeciesCache) return;

  nameToSpeciesCache = new Map();
  trimmedKeyCache = new Map();

  Object.entries(SPECIES_DATA).forEach(([key, data]) => {
    if (data?.name) {
      nameToSpeciesCache.set(data.name, data);
      const trimmed = key.replace(/\s+/g, '');
      if (trimmed !== key) trimmedKeyCache.set(trimmed, data);
    }
  });
};

const findSpeciesInfo = (name) => {
  if (!name) return null;
  buildCaches();

  const result = SPECIES_DATA[name] ||
    trimmedKeyCache.get(name.replace(/\s+/g, '')) ||
    nameToSpeciesCache.get(name) ||
    null;



  return result;
};

const getCardVisual = (card) => {
  if (!card) return { bgImg: "", bgSize: "0 0", cssClass: "" };

  const { deck, type, id } = card;
  let img = "", cols = 1, rows = 1;

  if (deck === DECK_TYPES.ALPINE) {
    img = IMG_URLS[TAGS.MOUNTAIN];
    cols = 7; rows = 4;
  } else if (deck === DECK_TYPES.EDGE) {
    img = IMG_URLS[CARD_TYPES.W_CARD];
    cols = 6; rows = 6;
  } else {
    if (type === CARD_TYPES.TREE || type === CARD_TYPES.W_CARD) {
      img = IMG_URLS[CARD_TYPES.TREE];
      cols = 5; rows = 5;
    } else if (type === CARD_TYPES.H_CARD) {
      img = IMG_URLS[CARD_TYPES.H_CARD];
      cols = 7; rows = 7;
    } else if (type === CARD_TYPES.V_CARD) {
      img = IMG_URLS[CARD_TYPES.V_CARD];
      cols = 7; rows = 7;
    } else {
      img = IMG_URLS[CARD_TYPES.TREE];
      cols = 5; rows = 5;
    }
  }

  return {
    bgImg: img,
    bgSize: `${cols * 100}% ${rows * 100}%`,
    cssClass: id ? `card-${id}` : "",
  };
};

// 获取树苗卡片图案
const getSaplingVisual = () => {
  const img = IMG_URLS[CARD_TYPES.V_CARD];
  return {
    bgImg: img,
    bgSize: "700% 700%",
    bgPosition: "100% 100%",
  };
};

// 根据卡片id获取卡片具体数据
const getCardInfoById = (id) => {
  // 特殊处理：树苗
  if (id === 'sapling') {
    const { SAPLING_DATA } = require("../data/speciesData");
    return {
      ...SAPLING_DATA,
      ...getSaplingVisual(),
      id: 'sapling',
      cssClass: 'card-sapling'
    };
  }

  const cardBasic = CARDS_DATA[id];
  if (!cardBasic) return {};

  const speciesDetails = (cardBasic.species || [])
    .map(name => findSpeciesInfo(name));

  const visualInfo = getCardVisual({ ...cardBasic, id });

  return {
    ...cardBasic,
    ...visualInfo,
    speciesDetails,
    id,
  };
};

module.exports = {
  getCardInfoById,
  getCardVisual,
  getSaplingVisual
};
