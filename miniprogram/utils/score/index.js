const { SCORING_TYPES } = require('../../data/enums');
const {
  scoreCache,
  generateGameStateHash,
  getAllCardsFromContext,
  precalculateStats,
  getCachedScore
} = require('./helpers');

const Basic = require('./handlers/basic');
const Position = require('./handlers/position');
const Condition = require('./handlers/condition');
const Collection = require('./handlers/collection');
const Special = require('./handlers/special');

/**
 * 计算游戏总分
 * @param {Object} playerState - 当前玩家状态
 * @param {String} openId - 当前玩家 OpenId
 * @param {Object} allPlayerStates - 所有玩家状态
 * @param {String} nickName - 玩家昵称 (用于日志)
 */
function calculateTotalScore(playerState, openId, allPlayerStates, nickName) {
  if (!playerState) return { total: 0, breakdown: {} };

  // 性能优化: 检查缓存
  const currentHash = generateGameStateHash(allPlayerStates);
  const cacheKey = openId;
  const cached = scoreCache.get(cacheKey);

  if (cached && cached.hash === currentHash) {
    return cached.result;
  }

  let total = 0;
  const breakdown = {};

  // 1. 遍历 Forest 计算得分
  const pointsCards = getAllCardsFromContext(playerState);

  // 优化：统一预统计
  const stats = precalculateStats(playerState);
  const cardScores = {};

  pointsCards.forEach(card => {
    const s = calculateCardScore(card, playerState, allPlayerStates, openId, stats);
    if (s > 0) {
      total += s;
      cardScores[card.uid] = s;
    }
  });

  // (Optional) 日志输出逻辑可在此处保留，同原 score.js

  const result = { total, breakdown };
  if (currentHash) {
    scoreCache.set(cacheKey, { hash: currentHash, result });
  }
  return result;
}

/**
 * 计算单张卡牌得分
 */
function calculateCardScore(card, context, allPlayerStates, myOpenId, stats) {
  if (!card.scoreConfig) return 0;

  const config = card.scoreConfig;
  const currentStats = stats || precalculateStats(context);

  switch (config.type) {
    // ----------------- Basic Types -----------------

    // 典型应用：通用计分卡 (如每张树得1分)
    case SCORING_TYPES.PER_TAG:
      return Basic.handlePerTag(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：蝴蝶 (每种不同的蝴蝶得1分)
    case SCORING_TYPES.PER_DIFFERENT_TAG:
      return Basic.handlePerDifferentTag(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：泽龟 (固定5分)
    case SCORING_TYPES.FLAT:
      return Basic.handleFlat(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：树蛙 (每张蚊子得5分)
    case SCORING_TYPES.PER_SPECIES:
      return Basic.handlePerSpecies(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：欧洲野兔 (每张得1分)
    case SCORING_TYPES.PER_NAME:
      return Basic.handlePerName(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：马鹿 (每张树木或植物得1分)
    case SCORING_TYPES.PER_TAG_OR:
      return Basic.handlePerTagOr(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：欧洲野牛 (每张橡木或山毛榉得X分)
    case SCORING_TYPES.PER_NAME_OR:
      return Basic.handlePerNameOr(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：通用多样性
    case SCORING_TYPES.PER_DIFFERENT_SPECIES:
      return Basic.handlePerDifferentSpecies(card, context, allPlayerStates, myOpenId, currentStats);

    // ----------------- Position Types -----------------

    // 典型应用：苍头燕雀 (位于山毛榉上)
    case SCORING_TYPES.POSITION_ON_CARD:
      return Position.handlePositionOnCard(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：夜莺 (位于灌木上)
    case SCORING_TYPES.POSITION_ON_SHRUB:
      return Position.handlePositionOnShrub(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：欧洲林鼬 (位于树或灌木上)
    case SCORING_TYPES.POSITION_ON_TREE_OR_SHRUB:
      return Position.handlePositionOnTreeOrShrub(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：银杉 (Silver Fir - 连接到这棵树的每张卡)
    // 别名: PER_CARD_ON_TREE
    case SCORING_TYPES.CONDITION_ATTACHED:
    case SCORING_TYPES.PER_CARD_ON_TREE:
      return Position.handleConditionAttached(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：红褐林蚁 (全场每张树下的卡)
    // 别名: PER_CARD_UNDER_TREE
    case SCORING_TYPES.CONDITION_BELOW:
    case SCORING_TYPES.PER_CARD_UNDER_TREE:
      return Position.handleConditionBelow(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：石貂 (全场每棵完全占据的树)
    // 别名: PER_FULL_TREE
    case SCORING_TYPES.CONDITION_TREE_FULL:
    case SCORING_TYPES.PER_FULL_TREE:
      return Position.handleConditionTreeFull(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：大蟾蜍 (与自己堆叠) - 旧逻辑/备用
    case SCORING_TYPES.POSITION_SHARE_SLOT:
      return Position.handlePositionShareSlot(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：大蟾蜍 (每张堆叠卡得分)
    case SCORING_TYPES.PER_STACKED_CARD:
      return Position.handlePerStackedCard(card, context, allPlayerStates, myOpenId, currentStats);

    // ----------------- Condition Types -----------------

    // 典型应用：苔藓 (至少10棵树)
    case SCORING_TYPES.THRESHOLD:
      return Condition.handleThreshold(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：山毛榉 (至少4棵山毛榉)
    case SCORING_TYPES.CONDITION_ON_COUNT:
      return Condition.handleConditionOnCount(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：猞猁 (至少1只西方狍), 野猪 (至少1只小野猪)
    case SCORING_TYPES.CONDITION_HAS_NAME:
      return Condition.handleConditionHasName(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：欧洲睡鼠 (与蝙蝠共享一棵树)
    case SCORING_TYPES.CONDITION_WITH_BAT:
      return Condition.handleConditionWithBat(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：蝙蝠集合 (至少3种不同蝙蝠)
    case SCORING_TYPES.DIFFERENT_BATS:
      return Condition.handleDifferentBats(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：欧洲林鼬 (位于特定Tag上)
    case SCORING_TYPES.CONDITION_ON_TAG:
    case SCORING_TYPES.CONDITION_ON_SUBTYPE:
      return Condition.handleConditionOnTag(card, context, allPlayerStates, myOpenId, currentStats);

    // ----------------- Collection Types -----------------

    // 典型应用：野草莓 (8种不同的树木 - 通用)
    case SCORING_TYPES.SET_COLLECTION:
      return Collection.handleSetCollection(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：野草莓 (8种不同的树木 - 专用)
    case SCORING_TYPES.COLLECT_ALL_TREES:
      return Collection.handleCollectAllTrees(card, context, allPlayerStates, myOpenId, currentStats);

    // ----------------- Special Types -----------------

    // 典型应用：萤火虫 (数量阶梯), 欧洲七叶树
    case SCORING_TYPES.SCALE_BY_COUNT:
      return Special.handleScaleByCount(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：西方狍 (同色卡牌数量)
    case SCORING_TYPES.GET_POINTS_BY_COLOR:
      return Special.handleGetPointsByColor(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：椴树 (树木最多)
    case SCORING_TYPES.MAJORITY:
      return Special.handleMajority(card, context, allPlayerStates, myOpenId, currentStats);

    // 典型应用：胡兀鹫 (洞穴卡牌数量)
    case SCORING_TYPES.CAVE_COUNT:
      return Special.handleCaveCount(card, context, allPlayerStates, myOpenId, currentStats);

    default:
      return 0;
  }
}

module.exports = {
  calculateTotalScore,
  calculateCardScore,
  getCachedScore
};
