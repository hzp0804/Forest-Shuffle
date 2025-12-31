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
  const result = {
    drawCount: 0,
    extraTurn: false,
    actions: [],
    text: ''
  };

  // 获取配置
  const config = isBonus ? card.bonusConfig : card.effectConfig;
  console.log('🔍 calculateReward 调用:', {
    卡牌: card.name,
    isBonus,
    config类型: config?.type,
    完整config: config
  });

  if (!config) {
    console.log('⚠️ 没有配置,返回空结果');
    return result;
  }

  // 如果是 bonus,需要检查颜色匹配
  if (isBonus && !isColorMatched(card, paymentCards)) {
    console.log('❌ Bonus 颜色匹配失败,不触发奖励:', card.name);
    return result;
  }

  console.log('✅ 准备处理奖励,类型:', config.type);

  // 根据类型处理奖励
  switch (config.type) {
    // 获得卡片（测试通过）
    case REWARD_TYPES.DRAW:
      result.drawCount = config.count || 0;
      break;

    case REWARD_TYPES.EXTRA_TURN:
      result.extraTurn = true;
      break;

    case REWARD_TYPES.DRAW_AND_TURN:
      result.drawCount = config.count || 0;
      result.extraTurn = true;
      console.log('棕熊触发额外回合')
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
        config.tags.forEach((tag, index) => {
          const tagText = getTagText(tag);
          const actionText = `免费打出一张带有${tagText}符号的牌`;
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
      // 使用卡牌上的描述文案，如果没有则使用默认文案
      const moleText = isBonus ? (card.bonus || '') : (card.effect || '');
      result.text = moleText || "鼹鼠特殊行动";
      result.actions.push({
        ...config,
        actionText: moleText || "立即支付费用打出任意数量的牌"
      });
      break;

    case REWARD_TYPES.ACTION_RACCOON:
      result.text = isBonus ? (card.bonus || '浣熊特殊行动') : (card.effect || '浣熊特殊行动');
      result.actions.push({
        ...config,
        actionText: result.text
      });
      break;

    case REWARD_TYPES.ACTION_BEAR:
      // 棕熊效果:将空地上的所有卡牌放入洞穴(自动执行,不需要玩家选择)
      result.clearingToCaveFlag = true;
      result.text = isBonus ? (card.bonus || '洞穴收入') : (card.effect || '洞穴收入');
      console.log('🐻 棕熊效果:设置空地卡牌放入洞穴标记');
      break;

    case REWARD_TYPES.ACTION_PLAY_SAPLINGS:
      result.text = isBonus ? (card.bonus || '特殊行动') : (card.effect || '特殊行动');
      result.actions.push(config);
      break;

    case REWARD_TYPES.ACTION_REMOVE_CLEARING:
      // 雌性野猪效果:设置强制清空标记,在回合结束时清空空地
      result.removeClearingFlag = true;
      console.log('🐗 雌性野猪效果:设置清空空地标记');
      break;

    case REWARD_TYPES.ACTION_CLEARING_TO_CAVE:
    case REWARD_TYPES.CLEARING_TO_CAVE:
      // 蜂群效果:将符合条件的空地牌放入洞穴
      result.text = isBonus ? (card.bonus || '空地牌进洞穴') : (card.effect || '空地牌进洞穴');
      result.actions.push({
        ...config,
        actionText: result.text
      });
      break;

    case REWARD_TYPES.ACTION_PICK_FROM_CLEARING:
    case REWARD_TYPES.PICK_FROM_CLEARING_TO_HAND:
      const pickText = isBonus ? (card.bonus || '从空地拿一张牌') : (card.effect || '从空地拿一张牌');
      result.text = pickText;
      result.actions.push({
        ...config,
        actionText: pickText
      });
      break;

    case REWARD_TYPES.ACTION_PICK_FROM_CLEARING_TO_CAVE:
      const count = config.count || 1;
      result.text = isBonus ? (card.bonus || '捡空地牌进洞穴') : (card.effect || '捡空地牌进洞穴');
      for (let i = 0; i < count; i++) {
        result.actions.push({
          type: REWARD_TYPES.ACTION_PICK_FROM_CLEARING_TO_CAVE,
          actionText: `请选择一张空地牌放入洞穴 (${i + 1}/${count})`
        });
      }
      break;

    // 动态收益：根据场上特定卡牌数量获得奖励（如赤狐根据欧洲野兔数量摸牌）
    case REWARD_TYPES.DRAW_PER_EXISTING:
      if (config.tag || config.target) {
        let count = 0;
        if (context && context.forest) {
          // 辅助函数：检查卡牌是否匹配目标
          const matchesTarget = (card) => {
            if (!card) return false;

            // 检查 tag 匹配
            if (config.tag && card.tags && card.tags.includes(config.tag)) {
              return true;
            }

            // 检查 name 匹配
            if (config.target) {
              // 直接名称匹配
              if (card.name === config.target) {
                return true;
              }
              // 检查 SPECIES_ALIAS 效果（如雪兔被视为欧洲野兔）
              if (card.effectConfig &&
                card.effectConfig.type === 'SPECIES_ALIAS' &&
                card.effectConfig.target === config.target) {
                return true;
              }
            }

            return false;
          };

          // 遍历森林中的所有卡牌组
          context.forest.forEach(g => {
            // 统计中心树木
            if (g.center && matchesTarget(g.center)) {
              count++;
            }

            // 统计槽位卡牌（需要处理堆叠情况）
            if (g.slots) {
              Object.values(g.slots).forEach(s => {
                if (s) {
                  // 如果是堆叠卡牌，需要统计 list 中的所有卡牌
                  if (s.list && s.list.length > 0) {
                    s.list.forEach(sc => {
                      if (matchesTarget(sc)) {
                        count++;
                      }
                    });
                  } else {
                    // 非堆叠卡牌，直接统计
                    if (matchesTarget(s)) {
                      count++;
                    }
                  }
                }
              });
            }
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
 * @returns {Object} { drawCount, actions, triggers: [{ cardName, text }] }
 */
function calculateTriggerEffects(forest, playedCard, triggerContext) {
  const result = {
    drawCount: 0,
    actions: [],
    triggers: [] // 新增: 记录触发的效果详情
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
    switch (config.type) {
      case TRIGGER_TYPES.TRIGGER_ON_PLAY_TAG_DRAW:
        // 检查触发条件: 此时打出的牌 playedCard 是否包含目标 tag
        if (playedCard.tags && playedCard.tags.includes(config.tag)) {
          if (config.reward) {
            if (config.reward.type === 'DRAW') {
              const drawValue = config.reward.value || 0;
              result.drawCount += drawValue;
              // 记录触发详情
              result.triggers.push({
                cardName: card.name || '未知卡牌',
                text: `摸${drawValue}张牌`
              });
            }
          }
        }
        break;

      case TRIGGER_TYPES.TRIGGER_ON_PLAY_POSITION:
        // 检查位置
        if (triggerContext && triggerContext.slot && triggerContext.slot.side === config.position) {
          let match = true;
          if (config.tag) {
            if (!playedCard.tags || !playedCard.tags.includes(config.tag)) {
              match = false;
            }
          }
          if (match && config.reward) {
            if (config.reward.type === 'DRAW') {
              const drawValue = config.reward.value || 0;
              result.drawCount += drawValue;
              // 记录触发详情
              result.triggers.push({
                cardName: card.name || '未知卡牌',
                text: `摸${drawValue}张牌`
              });
            }
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

