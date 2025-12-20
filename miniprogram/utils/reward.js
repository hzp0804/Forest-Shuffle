const { REWARD_TYPES, TRIGGER_TYPES, MODIFIER_TYPES } = require('../data/enums');
const { isColorMatched } = require('./colorMatcher');
const { TAGS, CARD_TYPES } = require('../data/constants');

/**
 * 统一的奖励计算函数
 * @param {Object} card - 主牌
 * @param {Object} slot - 选择的插槽
 * @param {Array} paymentCards - 支付卡片数组
 * @param {Object} context - 上下文 { forest }
 * @param {Boolean} isBonus - 是否为 bonus（需要颜色匹配）
 * @returns {Object} 奖励结果 { drawCount, extraTurn, actions, text }
 */
function calculateReward(card, slot, paymentCards, context = {}, isBonus = false) {
  console.log('选中的手牌', card, paymentCards);

  const result = {
    drawCount: 0,
    extraTurn: false,
    actions: [],
    text: ''
  };
  if (!isBonus) result

  // 获取配置
  console.log('isBonus', card)
  const config = isBonus ? card.bonusConfig : card.effectConfig;
  console.log('config', config, isBonus, isColorMatched(card, paymentCards))
  if (!config) return result;

  // 如果是 bonus，需要检查颜色匹配
  if (isBonus && !isColorMatched(card, paymentCards)) {
    return result;
  }

  console.log('逻辑计算中...', card);

  // 根据类型处理奖励
  switch (config.type) {
    // 获得卡片（测试通过）
    case REWARD_TYPES.DRAW:
      result.drawCount = config.count || 0;
      break;

    case REWARD_TYPES.EXTRA_TURN:
      result.extraTurn = true;
      console.log("extra turn");
      break;

    case REWARD_TYPES.DRAW_AND_TURN:
      result.drawCount = config.count || 0;
      result.extraTurn = true;
      break;

    // 免费打牌
    case REWARD_TYPES.PLAY_FREE:
      // 优先使用卡牌上的描述文案
      const cardText = isBonus ? (card.bonus || '') : (card.effect || '');

      // Tag到中文的映射
      const getTagText = (tag) => {
        const tagMap = {
          [TAGS.MOUNTAIN]: '高山',
          [TAGS.INSECT]: '昆虫',
          [TAGS.BUTTERFLY]: '蝴蝶',
          [TAGS.PLANT]: '植物',
          [TAGS.BAT]: '蝙蝠',
          [TAGS.BIRD]: '鸟',
          [TAGS.PAW]: '爪印',
          [TAGS.DEER]: '鹿',
          [TAGS.AMPHIBIAN]: '两栖动物',
          [TAGS.CLOVEN_HOOFED_ANIMAL]: '蹄足动物',
          [TAGS.CLOVEN]: '蹄足',
          [TAGS.MUSHROOM]: '蘑菇',
          [TAGS.SHRUB]: '灌木',
          [TAGS.EDGE]: '林缘'
        };
        return tagMap[tag] || tag;
      };

      // 如果是无限次模式（如任意数量蝙蝠），直接推入原始config，不拆分
      if (config.isInfinite) {
        result.text = cardText || "特殊行动";
        result.actions.push({
          ...config,
          actionText: cardText
        });
      } else if (Array.isArray(config.tags) && config.tags.length > 0) {
        // 有序列的情况，拆分为多个独立行动，每个action带有自己的提示文本
        console.log('拆分PLAY_FREE actions，tags顺序:', config.tags);
        config.tags.forEach((tag, index) => {
          const tagText = getTagText(tag);
          const actionText = `免费打出一张带有${tagText}符号的牌`;
          console.log(`  第${index + 1}个action: ${actionText}`);
          result.actions.push({
            type: REWARD_TYPES.PLAY_FREE,
            tags: [tag],
            actionText: actionText
          });
        });
        result.text = cardText || "连续特殊行动";
      } else {
        // 默认情况
        result.text = cardText || "特殊行动";
        result.actions.push({
          ...config,
          actionText: cardText || "免费打出一张牌"
        });
      }
      break;

    // 特殊行动
    case REWARD_TYPES.ACTION_MOLE:
      result.text = "鼹鼠特殊行动";
      result.actions.push(config);
      break;

    case REWARD_TYPES.ACTION_RACCOON:
      result.text = "浣熊特殊行动";
      result.actions.push(config);
      break;

    case REWARD_TYPES.ACTION_BEAR:
      result.text = "洞穴收入";
      result.actions.push(config);
      break;

    case REWARD_TYPES.ACTION_PLAY_SAPLINGS:
      result.text = isBonus ? (card.bonus || '特殊行动') : (card.effect || '特殊行动');
      result.actions.push(config);
      break;

    case REWARD_TYPES.ACTION_REMOVE_CLEARING:
    case REWARD_TYPES.ACTION_CLEARING_TO_CAVE:
    case REWARD_TYPES.ACTION_PICK_FROM_CLEARING:
    case REWARD_TYPES.PICK_FROM_CLEARING_TO_HAND:
    case REWARD_TYPES.CLEARING_TO_CAVE:
      result.actions.push(config);
      break;

    // 动态收益
    case REWARD_TYPES.DRAW_PER_EXISTING:
      if (config.tag || config.target) {
        let count = 0;
        if (context && context.forest) {
          const all = [];
          context.forest.forEach(g => {
            if (g.center) all.push(g.center);
            if (g.slots) Object.values(g.slots).forEach(s => s && all.push(s));
          });
          all.forEach(c => {
            if (config.tag && c.tags && c.tags.includes(config.tag)) count++;
            else if (config.target && c.name === config.target) count++;
          });
        }
        const divisor = config.perCount || 1;
        const rewardCount = Math.floor(count / divisor) * (config.value || 1);
        result.drawCount += rewardCount;
      }
      break;

    case REWARD_TYPES.CONDITION_EXTRATURN:
      if (context && context.forest) {
        let hasCondition = false;
        for (const group of context.forest) {
          if ((group.center && group.center.tags && group.center.tags.includes(config.tag)) ||
            (group.slots && Object.values(group.slots).some(s => s && s.tags && s.tags.includes(config.tag)))) {
            hasCondition = true;
            break;
          }
        }
        if (hasCondition) result.extraTurn = true;
      }
      break;

    case TRIGGER_TYPES.ON_PLAY_OPTIONAL_TUCK:
      result.text = isBonus ? (card.bonus || '堆叠手牌') : (card.effect || '堆叠手牌');
      result.actions.push({
        type: REWARD_TYPES.ACTION_TUCK_HAND_CARD,
        max: config.max || 1
      });
      break;
  }

  // 补充基础奖励描述
  if (!result.text) {
    const parts = [];
    if (result.drawCount > 0) parts.push(`摸${result.drawCount}张`);
    if (result.extraTurn) parts.push("额外回合");
    if (parts.length > 0) {
      result.text = parts.join("+");
    } else if (isBonus && card.bonus) {
      result.text = card.bonus;
    } else if (!isBonus && card.effect) {
      result.text = card.effect;
    }
  }

  return result;
}

/**
 * 计算常驻效果触发 (Trigger Effects)
 */
function calculateTriggerEffects(forest, playedCard, triggerContext) {
  const result = {
    drawCount: 0,
    actions: []
  };

  if (!forest || !Array.isArray(forest)) return result;

  // 扁平化森林卡牌
  const allCards = [];
  forest.forEach(group => {
    if (group.center) allCards.push(group.center);
    if (group.slots) {
      Object.values(group.slots).forEach(c => {
        if (c) allCards.push(c);
      });
    }
  });

  // 遍历检查触发
  allCards.forEach(card => {
    // 规则：当打出此物种的回合是不会触发其自身的常驻奖励的
    if (card.uid === playedCard.uid) return;

    if (!card.effectConfig) return;
    const config = card.effectConfig;
    // console.log('Checking trigger for', card.name, config.type);

    switch (config.type) {
      case TRIGGER_TYPES.TRIGGER_ON_PLAY_TAG_DRAW:
        // 检查触发条件: 此时打出的牌 playedCard 是否包含目标 tag
        if (playedCard.tags && playedCard.tags.includes(config.tag)) {
          if (config.reward) {
            if (config.reward.type === 'DRAW') {
              result.drawCount += (config.reward.value || 0);
              console.log('TRIGGER_TAG_DRAW triggered!', card.name, result.drawCount);
            }
          }
        }
        break;

      case TRIGGER_TYPES.TRIGGER_ON_PLAY_POSITION:
        // 检查位置
        // console.log('Checking position trigger', triggerContext, config.position);
        if (triggerContext && triggerContext.slot && triggerContext.slot.side === config.position) {
          let match = true;
          if (config.tag) {
            if (!playedCard.tags || !playedCard.tags.includes(config.tag)) {
              match = false;
            }
          }
          if (match && config.reward) {
            if (config.reward.type === 'DRAW') {
              result.drawCount += (config.reward.value || 0);
              console.log('TRIGGER_POSITION triggered!', card.name, result.drawCount);
            }
          } else {
            console.log('Trigger match failed', match, config.tag, playedCard.tags);
          }
        }
        break;
    }
  });

  return result;
}

module.exports = {
  calculateReward,
  calculateTriggerEffects
};

