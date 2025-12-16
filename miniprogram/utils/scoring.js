const cardData = require("../data/cardData.js");
const bgaData = require("../data/bgaCardData.js");

// Map English tags to Chinese if necessary, but game.js enrichCard seems to translate them.
// Let's rely on what game.js produces in 'tags'.

function getTags(card) {
  if (card.tags && card.tags.length > 0) {
    return card.tags;
  }

  // Fallback: Resolve from ID
  if (!card.id) return [];

  const bgaDef = bgaData.cards[card.id];
  if (!bgaDef) return [];

  const speciesList = bgaDef.species || [];
  // If explicitly specified which half (for split cards), use it. Default to 0 (Trees or full cards)
  const idx =
    card.playedSpeciesIndex !== undefined ? card.playedSpeciesIndex : 0;

  // Some cards might not have species at idx (error case), fallback to 0 or first
  const code = speciesList[idx] || speciesList[0];
  if (!code) return [];

  const dict = cardData.byName || cardData;
  const meta = dict[code] || dict[code.toLowerCase()];

  if (!meta) return [];

  // Return tags (usually localized in cardData as 'tags')
  return meta.tags || [];
}

function countSymbols(forest) {
  const counts = {};
  for (const treeGroup of forest) {
    // Center (Tree)
    if (treeGroup.center) {
      addTags(counts, treeGroup.center);
    }
    // Slots
    if (treeGroup.slots) {
      ["top", "bottom", "left", "right"].forEach((side) => {
        if (treeGroup.slots[side]) {
          addTags(counts, treeGroup.slots[side]);
        }
      });
    }
  }
  return counts;
}

function addTags(counts, card) {
  const tags = getTags(card);
  tags.forEach((t) => {
    counts[t] = (counts[t] || 0) + 1;
  });

  // Also count specific card names if needed
  // If enriched, use displayName? Or resolve name from ID
  const name = resolveName(card);
  if (name) {
    counts[name] = (counts[name] || 0) + 1;
  }
}

function resolveName(card) {
  if (card.name) return card.name;
  if (!card.id) return null;
  const bgaDef = bgaData.cards[card.id];
  if (!bgaDef) return null;
  const speciesList = bgaDef.species || [];
  const idx =
    card.playedSpeciesIndex !== undefined ? card.playedSpeciesIndex : 0;
  const code = speciesList[idx];
  if (!code) return null;

  const dict = cardData.byName || cardData;
  const meta = dict[code] || dict[code.toLowerCase()];
  return meta ? meta.name : code;
}

function resolveKey(card) {
  if (card.key) return card.key;
  if (!card.id) return null;
  const bgaDef = bgaData.cards[card.id];
  if (!bgaDef) return null;
  const speciesList = bgaDef.species || [];
  const idx =
    card.playedSpeciesIndex !== undefined ? card.playedSpeciesIndex : 0;
  return speciesList[idx];
}

function calculateScore(forest, cave = []) {
  if (!forest) return 0;

  // 1. Gather Context (Symbol Counts, Sets, etc.)
  const context = {
    counts: countSymbols(forest),
    forest: forest,
    cave: cave,
  };

  let totalScore = 0;

  // 2. Iterate and Score
  for (const treeGroup of forest) {
    if (treeGroup.center) {
      totalScore += getCardScore(treeGroup.center, context, treeGroup);
    }
    if (treeGroup.slots) {
      ["top", "bottom", "left", "right"].forEach((side) => {
        if (treeGroup.slots[side]) {
          totalScore += getCardScore(treeGroup.slots[side], context, treeGroup);
        }
      });
    }
  }

  return totalScore;
}

function getCardScore(card, context, treeGroup) {
  const key = resolveKey(card);
  if (!key) return 0;

  // Normalize key
  const normKey = String(key).replace(/[^a-zA-Z0-9]/g, "");

  // --- Examples from cardData.js ---

  // Blackberries: 2 points per Plant
  if (match(normKey, "Blackberries")) {
    return (context.counts["植物"] || 0) * 2;
  }

  // Bullfinch: 2 points per Insect
  if (match(normKey, "Bullfinch")) {
    return (context.counts["昆虫"] || 0) * 2;
  }

  // Chaffinch: 5 points if on Beech
  if (match(normKey, "Chaffinch")) {
    if (
      isTreeSpecies(treeGroup.center, "Beech") ||
      isTreeSpecies(treeGroup.center, "山毛榉")
    ) {
      return 5;
    }
    return 0;
  }

  // Common Toad: 5 points if 2 Common Toads share this spot.
  // We skip this complex check for now or assume 1 toad = 0 pts unless we check neighbors.

  // EurasianJay: 3 points
  if (match(normKey, "EurasianJay")) {
    return 3;
  }

  // Goshawk: 3 points per Bird
  if (match(normKey, "Goshawk")) {
    return (context.counts["鸟类"] || context.counts["鸟"] || 0) * 3;
  }

  // Great Spotted Woodpecker: 10 pts if no other forest has more trees. (Simplified: 10)
  if (match(normKey, "GreatSpottedWoodpecker")) {
    return 10;
  }

  // Hedgehog: 2 pts per Butterfly
  if (match(normKey, "Hedgehog")) {
    return (context.counts["蝴蝶"] || 0) * 2;
  }

  // Moss: 10 pts if >= 10 trees
  if (match(normKey, "Moss")) {
    return context.forest.length >= 10 ? 10 : 0;
  }

  // Pond Turtle: 5 pts
  if (match(normKey, "PondTurtle")) {
    return 5;
  }

  // Red Squirrel: 5 pts if on Oak
  if (match(normKey, "RedSquirrel")) {
    if (
      isTreeSpecies(treeGroup.center, "Oak") ||
      isTreeSpecies(treeGroup.center, "橡树")
    ) {
      return 5;
    }
    return 0;
  }

  // Stag Beetle: 1 pt per Paw
  if (match(normKey, "StagBeetle")) {
    return (context.counts["兽类"] || context.counts["有爪动物"] || 0) * 1;
  }

  // Tawny Owl: 5 pts
  if (match(normKey, "TawnyOwl")) {
    return 5;
  }

  // Tree Ferns: 6 per Amphibian
  if (match(normKey, "TreeFerns")) {
    return (context.counts["两栖动物"] || 0) * 6;
  }

  // Tree Frog: 5 per Gnat
  if (match(normKey, "TreeFrog")) {
    return (context.counts["蚊子"] || 0) * 5;
  }

  // Wood Ant: 2 per card below a tree
  if (match(normKey, "WoodAnt")) {
    let bottomCount = 0;
    context.forest.forEach((t) => {
      if (t.slots.bottom) bottomCount++;
    });
    return bottomCount * 2;
  }

  return 0;
}

function match(key, target) {
  return key.toLowerCase().includes(target.toLowerCase());
}

function isTreeSpecies(treeCard, speciesName) {
  if (!treeCard) return false;
  // Check enriched name
  if (treeCard.name === speciesName) return true;

  // Check raw or enriched key
  const key = resolveKey(treeCard);
  if (key === speciesName) return true;

  // Check display name via resolve
  const dName = resolveName(treeCard);
  if (dName === speciesName) return true;

  return false;
}

module.exports = {
  calculateScore,
};
