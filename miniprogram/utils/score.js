const { CARDS_DATA, SPECIES_DATA } = require("../data/cardData");
const constants = require("../data/constants");
const { TAGS, SPECIES_NAMES, CARD_TYPES } = constants;

/**
 * 提取森林中所有的卡片实例 (包括树木和附属卡)
 * @param {Array} forest - 森林数据结构
 * @returns {Array} - 所有卡片的扁平数组
 */
const getAllCardsInForest = (forest) => {
  if (!forest) return [];
  const cards = [];
  forest.forEach((tree) => {
    if (tree.center) cards.push({ ...tree.center, location: "center" });
    if (tree.slots) {
      Object.values(tree.slots).forEach((slotCard) => {
        if (slotCard) cards.push({ ...slotCard, location: "slot" });
      });
    }
  });
  return cards;
};

/**
 * 统计全场标签和物种数量 (上下文构建)
 * @param {Array} cards - 所有卡片
 * @returns {Object} { tags: { [tag]: count }, species: { [name]: count } }
 */
const buildContext = (cards) => {
  const context = {
    tags: {},
    species: {},
    cardCount: cards.length,
    cards: cards,
  };

  cards.forEach((card) => {
    // 查找静态数据
    const cardData = CARDS_DATA[card.id];
    if (!cardData) return;

    // 处理多物种卡片 (Split Cards)
    // 注意：这里需要确定该卡片实际上代表哪个物种。
    // 如果是 Split Card，通常逻辑是：它作为一个卡片存在，拥有特定的 Tags。
    // 但在 Forest Shuffle 中，Split Card 的每一半如果是激活状态，则视为该物种。
    // 这里简化处理：假设已 enrich 好的卡片或者根据 cost.js 的逻辑，
    // 我们需要知道这张卡在 slot 里到底是 acts as Left 还是 Right。
    // 为简便，假设 buildContext 时我们遍历的是已经确定好 species 的卡片对象。
    // 如果没有，我们需要重新解析。

    let activeSpeciesNames = cardData.species;
    if (!Array.isArray(activeSpeciesNames)) {
      activeSpeciesNames = [activeSpeciesNames]; // Tree
    } else {
      // 对于 Split Card，理论上在 Slot 中会被标记为用了哪一半。
      // 如果数据结构没存，我们暂时把所有 potential species 算上？
      // 不对，必须根据 slot 位置。
      // 这里暂时假设 cards 数组里已经是 enrich 过的，带有 activeSpecies 属性最好。
      // 如果没有，暂时把所有关联的 species 都算进去 (这是一个妥协)。
    }

    activeSpeciesNames.forEach((name) => {
      // 统计物种
      context.species[name] = (context.species[name] || 0) + 1;

      // 统计 Tag
      const speciesInfo = SPECIES_DATA[name];
      if (speciesInfo && speciesInfo.tags) {
        speciesInfo.tags.forEach((tag) => {
          context.tags[tag] = (context.tags[tag] || 0) + 1;
        });
      }
    });
  });

  return context;
};

/**
 * 计算单个卡片的得分
 * @param {Object} card - 卡片对象
 * @param {Object} context - 统计上下文
 * @returns {number}
 */
const getCardScore = (card, context) => {
  const cardData = CARDS_DATA[card.id];
  if (!cardData) return 0;

  // 对于 Split Cards，通常只计算这一半的得分逻辑
  // 这里需要更复杂的逻辑来判断使用了哪一半的技能
  // 暂时遍历所有 species 的 points 描述进行匹配
  // 实际生产中应有更精准的映射

  let totalScore = 0;

  // 获取该卡片包含的所有物种名称
  const speciesList = Array.isArray(cardData.species)
    ? cardData.species
    : [cardData.species];

  speciesList.forEach((name) => {
    const info = SPECIES_DATA[name];
    if (!info || !info.points) return;

    // *** 核心计分逻辑分发 ***
    // 这里根据 points 描述的关键词或预定义的 ID 映射来执行计算
    // 示例逻辑：

    const txt = info.points.toLowerCase();

    // 1. "Gain X points" (固定分)
    if (txt.match(/^gain (\d+) points?$/)) {
      totalScore += parseInt(RegExp.$1);
    }
    // 2. "Gain X points for each [TAG] symbol"
    else if (txt.match(/gain (\d+) points? for each .*?(\w+) symbol/)) {
      const pts = parseInt(RegExp.$1);
      // 简易 NLP：尝试提取 tag。实际上 tag 往往是专用名词。
      // 这里建议用 active mapping。
      // 举例: "Gain 1 point for each plant symbol"
      if (txt.includes("plant symbol"))
        totalScore += pts * (context.tags[TAGS.PLANT] || 0);
      // Note: The context.tags keys are from SPECIES_DATA tags, which are now constants (e.g. "植物").
      // But here we are matching against English descriptions?
      // Wait, the descriptions are in cardData.js points: "每张带有植物符号的牌得2分" (Chinese) in my previous view.
      // But here the code checks for "plant symbol" (English).
      // This implies score.js logic was written for English but data is Chinese.
      // Checking cardData.js again:
      // points: "每张带有植物符号的牌得2分"
      // So this logic needs to handle Chinese descriptions!

      else if (txt.includes("植物符号"))
        totalScore += pts * (context.tags[TAGS.PLANT] || 0);
      else if (txt.includes("树木符号"))
        totalScore += pts * (context.tags[CARD_TYPES.TREE] || 0);

      else if (txt.includes("鸟类符号") || txt.includes("鸟符号"))
        totalScore += pts * (context.tags[TAGS.BIRD] || 0);
      else if (txt.includes("蝴蝶符号"))
        totalScore += pts * (context.tags[TAGS.BUTTERFLY] || 0);
      // ... 更多 tag
    }
    // 3. Set Collection (e.g. Different Butterflies)
    else if (txt.includes("different butterflies") || txt.includes("不同的蝴蝶")) { // "每张不同的蝴蝶牌得1分"
      // 需要计算蝴蝶种类数
      // let uniqueButterflies = ...
      // totalScore += scoreTable(uniqueButterflies)
    }

    // 4. 特定条件
    if (name === SPECIES_NAMES.LINDEN) {
      // 椴树: 如果没有其他森林有更多椴树...
      // 暂时只给 1 分基础
      totalScore += 1;
    }
    if (name === SPECIES_NAMES.OAK) {
      // 橡树: 8种树都有给10分
      // if (uniqueTrees >= 8) totalScore += 10
    }
  });

  return totalScore;
};

/**
 * 计算总分
 * @param {Object} playerState - 玩家状态 (包含 forest, cave)
 * @returns {Object} { total: number, breakdown: Array }
 */
const calculateScore = (playerState) => {
  if (!playerState || !playerState.forest) return { total: 0, breakdown: [] };

  const forestCards = getAllCardsInForest(playerState.forest);
  const allCards = [...forestCards, ...(playerState.cave || [])]; // 包含洞穴

  // 1. 构建上下文
  const context = buildContext(allCards);

  // 2. 遍历计算
  let total = 0;
  const breakdown = [];

  allCards.forEach((card) => {
    const score = getCardScore(card, context);
    if (score > 0) {
      total += score;
      breakdown.push({
        cardId: card.id,
        // name: ... (需获取名字)
        score: score,
      });
    }
  });

  return { total, breakdown };
};

module.exports = {
  calculateScore,
};
