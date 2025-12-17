const { CARDS_DATA } = require("../data/cardData");
const { SPECIES_DATA } = require("../data/speciesData");
const { CARD_TYPES } = require("../data/constants");
const { TREE, H_CARD, V_CARD } = CARD_TYPES;

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

  return SPECIES_DATA[name] ||
    trimmedKeyCache.get(name.replace(/\s+/g, '')) ||
    nameToSpeciesCache.get(name) ||
    null;
};

const getCardCost = (card, slotType) => {
  const cardId = typeof card === "object" && card !== null ? card.id : card;
  if (!cardId) return 0;

  const cardBasic = CARDS_DATA[cardId];
  if (!cardBasic?.species?.length) return 0;

  const { type, species } = cardBasic;
  let speciesName = null;

  if (type === TREE) {
    speciesName = slotType === "center" ? species[0] : species[1];
  } else if (type === H_CARD) {
    speciesName = slotType === "left" ? species[0] : species[1];
  } else if (type === V_CARD) {
    speciesName = slotType === "top" ? species[0] : species[1];
  }

  const info = findSpeciesInfo(speciesName);
  return info?.cost ?? 0;
};

module.exports = { getCardCost };
