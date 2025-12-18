const { EFFECT_TYPES, BONUS_TYPES } = require('../data/enums');
const { TAGS, CARD_TYPES } = require('../data/constants');

/**
 * 特殊行动维护工具
 */
const SpecialActionUtils = {
  /**
   * 根据效果配置检测具体的特殊行动模式
   * @param {Object} actionConfig - 效果配置对象 (effectConfig 或 bonusConfig)
   * @returns {String|null} 行动模式标识
   */
  detectActionMode(actionConfig) {
    if (!actionConfig) return null;

    const type = actionConfig.type;

    // 映射类型到模式标识
    const modeMap = {
      [EFFECT_TYPES.ACTION_MOLE]: 'MOLE',
      [EFFECT_TYPES.ACTION_RACCOON]: 'RACCOON',
      [EFFECT_TYPES.ACTION_BEAR]: 'BEAR',
      [EFFECT_TYPES.FREE_PLAY_BAT]: 'FREE_PLAY_BAT',
      [EFFECT_TYPES.ACTION_REMOVE_CLEARING]: 'REMOVE_CLEARING',
      [EFFECT_TYPES.ACTION_CLEARING_TO_CAVE]: 'CLEARING_TO_CAVE',
      [EFFECT_TYPES.ACTION_PICK_FROM_CLEARING]: 'PICK_FROM_CLEARING',
      [EFFECT_TYPES.ACTION_PLAY_SAPLINGS]: 'PLAY_SAPLINGS',
      [BONUS_TYPES.PLAY_FREE]: 'PLAY_FREE',
      [BONUS_TYPES.PLAY_FREE_SPECIFIC]: 'PLAY_FREE_SPECIFIC',
      [BONUS_TYPES.PICK_FROM_CLEARING_TO_HAND]: 'PICK_FROM_CLEARING_TO_HAND',
      [BONUS_TYPES.CLEARING_TO_CAVE]: 'CLEARING_TO_CAVE'
    };

    return modeMap[type] || 'SPECIAL_ACTION';
  },

  /**
   * 获取当前行动模式的 UI 提示文案
   * @param {String} mode - 行动模式
   * @param {Object} config - 相关配置
   * @returns {String} 提示文案
   */
  getInstructionText(mode, config) {
    switch (mode) {
      case 'MOLE':
        return '🐭 鼹鼠效果：支付费用打出任意数量的牌。点击"结束"退出该模式。';
      case 'RACCOON':
        return '🦝 浣熊效果：选择手牌放入你的洞穴，并摸取相同数量的牌。';
      case 'BEAR':
        return '🐻 棕熊效果：将空地上的所有卡牌放入你的洞穴。';
      case 'FREE_PLAY_BAT':
        return '🦟 蚊子效果：免费打出任意数量的蝙蝠卡。点击"结束"退出。';
      case 'REMOVE_CLEARING':
        return '🐗 野猪效果：本次行动结束后将清空空地。';
      case 'CLEARING_TO_CAVE':
        return '🐝 效果：将符合条件的空地牌放入你的洞穴。';
      case 'PICK_FROM_CLEARING':
        return '🐱 欧洲野猫效果：从空地拿一张牌放入你的洞穴。';
      case 'PLAY_SAPLINGS':
        return '🐭 水田鼠效果：选择手牌作为树苗打出（不需要费用）。点击"结束"退出。';
      case 'PLAY_FREE':
      case 'PLAY_FREE_SPECIFIC':
        return '✨ 奖励：免费打出特定类型的牌（不需要费用）。';
      default:
        return '进行中：特殊行动模式。';
    }
  },

  /**
   * 检查在当前模式下，某张卡是否可以被玩家选择执行
   * @param {String} mode - 当前模式
   * @param {Object} card - 准备选中的卡
   * @param {Object} config - 模式原始配置项
   * @returns {Boolean}
   */
  isCardSelectable(mode, card, config) {
    if (!card) return false;

    switch (mode) {
      case 'FREE_PLAY_BAT':
        // 只能选择蝙蝠卡
        return card.tags && card.tags.includes(TAGS.BAT);

      case 'PLAY_FREE_SPECIFIC':
        // 只能选择带有指定 Tag 的卡（例如：火蝾螈-免费爪印）
        if (config && config.tag) {
          return card.tags && card.tags.includes(config.tag);
        }
        return true;

      // 其他模式可能不需要在此时限制选择，而是在操作点击时判断
      default:
        return true;
    }
  },

  /**
   * 判断该行动是否为全自动执行（不需要玩家选择或确认）
   * @param {String} mode - 行动模式
   * @returns {Boolean}
   */
  /**
   * 判断在当前模式下，是否允许点击常规的“打出”按钮
   * @param {String} mode - 行动模式
   * @returns {Boolean}
   */
  isPlayCardAllowed(mode) {
    // 只有在这些“提交卡牌”类的特殊模式下，才允许继续点击“打出”
    const playModes = ['MOLE', 'FREE_PLAY_BAT', 'PLAY_SAPLINGS', 'PLAY_FREE', 'PLAY_FREE_SPECIFIC'];
    return playModes.includes(mode);
  }
};

module.exports = SpecialActionUtils;
