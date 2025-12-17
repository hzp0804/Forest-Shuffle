const {
  CARDS_DATA,
  SPECIES_DATA,
} = require("../data/cardData");
const { CARD_TYPES } = require("../data/constants");
const { TREE, H_CARD, V_CARD } = CARD_TYPES;

/**
 * 奖励类型枚举
 * 用于标识不同种类的游戏效果
 */
/**
 * 奖励与效果类型枚举 (ACTION_TYPES)
 * 统一管理所有游戏内的动作类型
 */
/**
 * 建议的执行顺序 (Execution Order):
 * 1. 支付费用 & 打出卡牌 (Pay & Place)
 * 2. 检查并应用常驻/被动效果 (Passive Rules: RULE_CHANGE)
 *    - 例如: Common Toad 的共存规则
 * 3. 执行即时效果 (Instant Effects: EFFECT_TYPES)
 *    - 例如: 摸牌 (Draw Cards)
 * 4. 检查并执行奖励 (Bonuses: BONUS_TYPES)
 *    - 仅当支付颜色匹配时触发
 *    - 例如: 额外回合, 摸更多牌
 */

/**
 * -----------------------------------------------------------
 * 类型定义 (Type Definitions)
 * -----------------------------------------------------------
 */

/**
 * 效果类型 (EFFECT_TYPES)
 * 这里列出的是通常作为“效果”(Effect)出现的机制
 * (打出即触发，或持续生效)
 */
const EFFECT_TYPES = {
  DRAW_CARDS: "DRAW_CARDS", // 摸牌
  PLAY_FREE: "PLAY_FREE", // 免费打牌 (如 Gnat)
  PLAY_SAPLING: "PLAY_SAPLING", // 打出为树苗
  CLEARING_INTERACT: "CLEARING_INTERACT", // 清理区互动 (如 Brown Bear)
  RULE_CHANGE: "RULE_CHANGE", // 规则变更 (如 Common Toad 共存)
  POINTS: "POINTS", // 得分点 (持续效果)
  UNKNOWN: "UNKNOWN",
};

/**
 * 奖励类型 (BONUS_TYPES)
 * 这里列出的是通常作为“奖励”(Bonus)出现的机制
 * (仅在支付颜色匹配时触发)
 */
const BONUS_TYPES = {
  DRAW_CARDS: "DRAW_CARDS", // 摸牌 (覆盖了 Effect 的定义，值相同)
  EXTRA_TURN: "EXTRA_TURN", // 额外回合 (Bonus 专属)
  PLAY_FREE: "PLAY_FREE", // 免费打牌 (如 Silver Fir)
  CLEARING_INTERACT: "CLEARING_INTERACT", // 清理区互动 (如 Mosquito Bonus)
  UNKNOWN: "UNKNOWN",
};

/**
 * 动作类型汇总 (ACTION_TYPES)
 * 内部逻辑使用的总集，包含所有可能的动作值
 */
const ACTION_TYPES = {
  ...EFFECT_TYPES,
  ...BONUS_TYPES,
  PAY_COST: "PAY_COST", // 特殊的支付动作，不属于 Effect/Bonus
};

/**
 * 清理区交互子类型 (CLEARING_SUBTYPES)
 */
const CLEARING_SUBTYPES = {
  TO_CAVE: "TO_CAVE", // 移动到洞穴 (Place ... in your cave)
  TAKE_HAND: "TAKE_HAND", // 拿回手牌 (Take ... into your hand)
  REMOVE_GAME: "REMOVE_GAME", // 移出游戏 (Remove ... from the game)
};

/**
 * 免费打牌目标类型 (Start Filter Types)
 */
const FILTER_TYPES = {
  PAW: "paw",
  BIRD: "bird",
  PLANT: "plant",
  BUTTERFLY: "butterfly",
  BAT: "bat",
  DEER: "deer",
  MOUNTAIN: "mountain",
  INSECT: "insect",
  SQUEAKER: "Squeaker",
  ANY: "any",
};

/**
 * 获取主卡的目标树标记 (Tree Symbol)
 * 根据卡牌类型和打出的位置，确定需要匹配的颜色符号
 *
 * @param {Object} cardData - 卡牌的基础数据 (来自 CARDS_DATA)
 * @param {string} slotPosition - 打出的槽位/位置 ('tree', 'left', 'right', 'top', 'bottom')
 * @returns {string|null} - 返回目标符号 (如 'Linden'), 如果没有则返回 null
 */
const getTargetSymbol = (cardData, slotPosition) => {
  if (!cardData || !cardData.tree_symbol) return null;

  // 树木卡：通常只有一个颜色，取索引 0
  if (cardData.type === TREE) {
    return cardData.tree_symbol[0];
  }

  // 左右分割卡 (H_CARD)
  // 左侧 = 索引 0, 右侧 = 索引 1
  if (cardData.type === H_CARD) {
    if (slotPosition === "right") return cardData.tree_symbol[1];
    return cardData.tree_symbol[0]; // default left/top
  }

  // 上下分割卡 (V_CARD)
  // 上方 = 索引 0, 下方 = 索引 1
  if (cardData.type === V_CARD) {
    if (slotPosition === "bottom") return cardData.tree_symbol[1];
    return cardData.tree_symbol[0]; // default top
  }

  return cardData.tree_symbol[0];
};

/**
 * 获取打出的具体物种数据
 * @param {Object} cardData
 * @param {string} slotPosition
 * @returns {Object|null} - 返回 SPECIES_DATA 中的具体条目
 */
const getPlayedSpecies = (cardData, slotPosition) => {
  if (!cardData || !cardData.species) return null;
  let speciesName = null;

  if (cardData.type === TREE) {
    speciesName = cardData.species[0];
  } else if (cardData.type === H_CARD) {
    speciesName =
      slotPosition === "right" ? cardData.species[1] : cardData.species[0];
  } else if (cardData.type === V_CARD) {
    speciesName =
      slotPosition === "bottom" ? cardData.species[1] : cardData.species[0];
  }

  if (!speciesName) return null;

  // 移除名称中的特殊字符以匹配 key (参考原逻辑)
  const sanitizedKey = speciesName.replace(/[()-\s']/g, "");
  return SPECIES_DATA[sanitizedKey] || null;
};

/**
 * -----------------------------------------------------------
 * 1. 奖励判断逻辑 (Bonus Condition)
 * -----------------------------------------------------------
 * 检查支付的卡牌是否全部匹配主卡的目标颜色
 *
 * @param {string} playedCardId - 打出的卡牌ID
 * @param {string} slotPosition - 打出的位置 ('tree', 'left', 'right', 'top', 'bottom')
 * @param {Array<Object>} paymentCards - 支付的卡牌列表 [{id: '1'}, {id: '2'}...]
 * @returns {boolean} - 是否激活Bonus
 */
const isBonusChange = (playedCardId, slotPosition, paymentCards) => {
  // 基础校验
  if (!playedCardId || !paymentCards || paymentCards.length === 0) return false;

  const mainCard = CARDS_DATA[playedCardId];
  if (!mainCard) return false;

  // 1. 获取主卡在当前位置的目标颜色符号
  const targetSymbol = getTargetSymbol(mainCard, slotPosition);
  if (!targetSymbol) return false;

  // 2. 遍历所有支付卡牌，检查是否包含该符号
  // 规则：所有支付的卡牌(selectedToPay)必须都包含目标符号
  const allMatch = paymentCards.every((payCard) => {
    const payCardData = CARDS_DATA[payCard.id];
    if (!payCardData || !payCardData.tree_symbol) return false;
    return payCardData.tree_symbol.includes(targetSymbol);
  });

  return allMatch;
};

/**
 * -----------------------------------------------------------
 * 2. 奖励内容解析 (Parse Actions)
 * -----------------------------------------------------------
 * 解析文本描述，提取动作类型和参数
 *
 * @param {string} text - 描述文本 (Effect 或 Bonus)
 * @returns {Object} - { type: ACTION_TYPES, payload: any, raw: string }
 */
const parseActionText = (text) => {
  if (!text) return null;
  const lowerText = text.toLowerCase();

  // --- 触发式逻辑 (Triggered / Passive) ---
  if (lowerText.includes("whenever")) {
    // 持续效果
    return {
      type: ACTION_TYPES.RULE_CHANGE,
      trigger: true,
      raw: text,
    };
  }

  // --- 摸牌逻辑 (Draw) ---
  // "Receive 1 card", "Receive 2 cards"
  if (lowerText.includes("receive")) {
    const match = lowerText.match(/receive (\d+) card/);
    if (match) {
      return {
        type: ACTION_TYPES.DRAW_CARDS,
        count: parseInt(match[1], 10),
        raw: text,
      };
    }
  }

  // --- 额外回合 (Extra Turn) ---
  if (lowerText.includes("take another turn")) {
    return {
      type: ACTION_TYPES.EXTRA_TURN,
      raw: text,
    };
  }

  // --- 免费打牌 (Play Free) ---
  // カバー: "Play a card with ... for free", "免费打出一只小野猪", "Play any number..."
  if (
    lowerText.includes("for free") &&
    (lowerText.includes("play") || lowerText.includes("played"))
  ) {
    let filter = FILTER_TYPES.ANY;

    // 识别目标类型
    if (lowerText.includes("paw symbol")) filter = FILTER_TYPES.PAW;
    else if (lowerText.includes("bird symbol")) filter = FILTER_TYPES.BIRD;
    else if (lowerText.includes("plant symbol")) filter = FILTER_TYPES.PLANT;
    else if (lowerText.includes("butterfly symbol"))
      filter = FILTER_TYPES.BUTTERFLY;
    else if (
      lowerText.includes("bat symbol") ||
      lowerText.includes("bat cards")
    )
      filter = FILTER_TYPES.BAT;
    else if (lowerText.includes("deer symbol")) filter = FILTER_TYPES.DEER;
    else if (lowerText.includes("mountain symbol"))
      filter = FILTER_TYPES.MOUNTAIN;
    else if (lowerText.includes("insect symbol")) filter = FILTER_TYPES.INSECT;
    else if (lowerText.includes("squeaker")) filter = FILTER_TYPES.SQUEAKER;

    const isMultiple = lowerText.includes("any number");

    return {
      type: ACTION_TYPES.PLAY_FREE,
      filter: filter,
      multiple: isMultiple,
      raw: text,
    };
  }

  // --- 清理区互动 (Clearing) ---
  if (lowerText.includes("clearing") || lowerText.includes("cave")) {
    let subType = CLEARING_SUBTYPES.TO_CAVE; // 默认逻辑
    if (
      lowerText.includes("in your cave") ||
      lowerText.includes("into your cave")
    ) {
      subType = CLEARING_SUBTYPES.TO_CAVE;
    } else if (
      lowerText.includes("take") &&
      lowerText.includes("from the clearing")
    ) {
      subType = CLEARING_SUBTYPES.TAKE_HAND;
    } else if (lowerText.includes("remove all cards")) {
      subType = CLEARING_SUBTYPES.REMOVE_GAME;
    }
    return {
      type: ACTION_TYPES.CLEARING_INTERACT,
      subType: subType,
      raw: text,
    };
  }

  // --- 默认/其他 ---
  return {
    type: ACTION_TYPES.UNKNOWN,
    raw: text,
  };
};

/**
 * -----------------------------------------------------------
 * 3. 奖励执行/获取 (Resolve Reward)
 * -----------------------------------------------------------
 * 获取最终需要执行的所有操作 (包括必发的 Effect 和 条件触发的 Bonus)
 *
 * @param {string} playedCardId
 * @param {string} slotPosition
 * @param {Array<Object>} paymentCards
 * @returns {Object} - 返回行动列表 { effects: [], bonuses: [], activated: boolean }
 */
const resolveCardActions = (playedCardId, slotPosition, paymentCards) => {
  const result = {
    effects: [], // 必然触发的效果
    bonuses: [], // 满足条件触发的奖励
    bonusActivated: false, // 标记奖励是否激活
  };

  const mainCard = CARDS_DATA[playedCardId];
  const speciesData = getPlayedSpecies(mainCard, slotPosition);

  if (!speciesData) return result;

  // 1. 解析 Effect (必然触发)
  if (speciesData.effect) {
    result.effects.push(parseActionText(speciesData.effect));
  }

  // 2. 判断 Bonus 是否激活
  const hasBonusText = speciesData.bonus && speciesData.bonus.trim().length > 0;
  if (hasBonusText) {
    const isMatched = isBonusChange(playedCardId, slotPosition, paymentCards);
    if (isMatched) {
      result.bonusActivated = true;
      result.bonuses.push(parseActionText(speciesData.bonus));
    }
  }

  return result;
};

/**
 * -----------------------------------------------------------
 * 4. 奖励执行 (Execute Action)
 * -----------------------------------------------------------
 * 根据解析出的动作类型，执行具体的游戏逻辑
 * 注意：此函数需要传入游戏状态上下文 (context) 才能真正修改数据
 *
 * @param {Object} action - 由 parseActionText 返回的动作对象 {type, count, ...}
 * @param {Object} context - 游戏上下文，包含 { player, game, ... }
 * @returns {void}
 */
const executeAction = (action, context) => {
  if (!action || !context) return;

  const { type, count, filter, multiple, subType } = action;

  console.log(`[Reward] 执行动作: ${type}`, action);

  switch (type) {
    case ACTION_TYPES.DRAW_CARDS:
      // 执行摸牌逻辑
      // context.game.drawCards(context.player, count);
      console.log(`执行: 摸 ${count} 张牌`);
      break;

    case ACTION_TYPES.EXTRA_TURN:
      // 执行额外回合逻辑
      // context.game.addExtraTurn(context.player);
      console.log("执行: 获得额外回合");
      break;

    case ACTION_TYPES.PLAY_FREE:
      // 执行免费打牌逻辑
      // context.game.setFreePlayState(filter, multiple);
      console.log(`执行: 免费打牌 (类型: ${filter}, 多张: ${multiple})`);
      break;

    case ACTION_TYPES.CLEARING_INTERACT:
      // 执行清理区交互
      console.log(`执行: 清理区交互 (子类型: ${subType})`);
      if (subType === CLEARING_SUBTYPES.TO_CAVE) {
        // context.game.moveClearingToCave(context.player);
      } else if (subType === CLEARING_SUBTYPES.TAKE_HAND) {
        // context.game.takeCardFromClearing(context.player);
      }
      break;

    case ACTION_TYPES.UNKNOWN:
    default:
      console.log("执行: 未知效果或仅文本提示", action.raw);
      break;
  }
};



/**
 * -----------------------------------------------------------
 * 5. UI 展示适配 (UI Adapter)
 * -----------------------------------------------------------
 * 兼容 utils.js 的 computeInstruction 调用
 *
 * @param {Object} card - 卡牌对象
 * @param {Object} slot - 插槽对象 (可能为null, 或 {side: 'left'})
 * @param {Array} paymentCards - 支付卡牌数组
 * @returns {Object} { drawCount, bonusText }
 */
const calculateColorReward = (card, slot, paymentCards) => {
  if (!card) return {};

  const cardId = card.id || card.cardId;
  const slotPosition = slot ? slot.side : null;

  const result = resolveCardActions(cardId, slotPosition, paymentCards);

  // 临时适配逻辑：将 Effect 和 Bonus 合并返回给 game.js 处理
  // 优先处理 Draw Cards, Extra Turn 等常见属性
  // 注意：目前 game.js 只处理单一返回对象，可能需要 game.js 进一步改造以支持多重效果
  // 这里先尝试合并

  let combinedResult = {
    drawCount: 0,
    bonusText: null,
    extraTurn: false,
    playFree: null
  };

  // 1. 处理必然触发的 Effect
  result.effects.forEach(action => {
    if (action.type === ACTION_TYPES.DRAW_CARDS && action.count) {
      combinedResult.drawCount += action.count;
    } else if (action.type === ACTION_TYPES.EXTRA_TURN) {
      combinedResult.extraTurn = true;
      combinedResult.bonusText = (combinedResult.bonusText ? combinedResult.bonusText + " & " : "") + action.raw;
    } else {
      // 其他效果暂存为文本，或扩展字段
      combinedResult.bonusText = action.raw;
    }
  });

  // 2. 处理条件触发的 Bonus
  if (result.bonusActivated) {
    result.bonuses.forEach(action => {
      if (action.type === ACTION_TYPES.DRAW_CARDS && action.count) {
        combinedResult.drawCount += action.count;
      } else if (action.type === ACTION_TYPES.EXTRA_TURN) {
        combinedResult.extraTurn = true;
        combinedResult.bonusText = (combinedResult.bonusText ? combinedResult.bonusText + " & " : "") + action.raw;
      } else if (action.type === ACTION_TYPES.PLAY_FREE) {
        combinedResult.playFree = {
          filter: action.filter,
          multiple: action.multiple
        };
        combinedResult.bonusText = (combinedResult.bonusText ? combinedResult.bonusText + " & " : "") + action.raw;
      } else {
        combinedResult.bonusText = (combinedResult.bonusText ? combinedResult.bonusText + " & " : "") + action.raw;
      }
    });
  }

  // 清理
  if (combinedResult.drawCount === 0) delete combinedResult.drawCount;
  if (!combinedResult.bonusText) delete combinedResult.bonusText;
  if (!combinedResult.extraTurn) delete combinedResult.extraTurn;
  if (!combinedResult.playFree) delete combinedResult.playFree;

  return combinedResult;
};

module.exports = {
  // 枚举导出
  ACTION_TYPES,
  EFFECT_TYPES,
  BONUS_TYPES,
  CLEARING_SUBTYPES,
  FILTER_TYPES,
  // 1. 判断
  isBonusChange,
  // 2. 解析
  parseActionText,
  // 3. 执行获取
  resolveCardActions,
  // 4. 执行逻辑
  executeAction,
  // 辅助
  getTargetSymbol,
  getPlayedSpecies,
  calculateColorReward,
};
