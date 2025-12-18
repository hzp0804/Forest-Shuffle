const { REWARD_TYPES } = require('../data/enums');
const { TAGS, CARD_TYPES } = require('../data/constants');
const { DbHelper } = require('./utils');

/**
 * 特殊行动维护工具
 */
const SpecialActionUtils = {
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
      case 'PLAY_FREE':
        // 只能选择带有指定 Tag 的卡（例如：火蝾螈-免费爪印）
        // 或者指定名称的卡（例如：雌性野猪-小野猪）
        if (config && config.targetName) {
          return card.name === config.targetName;
        }
        // 通过 config.tags 数组判断
        if (config && config.tags && Array.isArray(config.tags)) {
          return card.tags && config.tags.some(tag => card.tags.includes(tag));
        }
        return true;

      default:
        return true;
    }
  },

  /**
   * 执行特殊行动逻辑
   * @param {String} mode - 行动模式
   * @param {Object} context - 上下文 { gameState, playerState, clearing, selectedClearingIdx, openId, actionConfig }
   * @returns {Object} result { success: boolean, updates: Object, logMsg: String, errorMsg: String, drawCount: Number }
   */
  handleAction(mode, context) {
    const { gameState, playerState, clearing, selectedClearingIdx, openId, actionConfig } = context;
    const result = { success: true, updates: {}, logMsg: "", errorMsg: "", drawCount: 0 };

    switch (mode) {
      case 'ACTION_RACCOON': {
        // 浣熊效果：选择手牌放入洞穴，并摸取相同数量
        const selectedCards = playerState.hand.filter(c => c.selected);
        if (selectedCards.length === 0) {
          result.success = false;
          result.errorMsg = "请选择任意数量手牌放入洞穴";
          return result;
        }

        const newHand = playerState.hand.filter(c => !c.selected);
        const newCave = [...(playerState.cave || []), ...selectedCards.map(c => ({ ...c, selected: false }))];

        result.drawCount = selectedCards.length;
        result.updates = {
          [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(newHand),
          [`gameState.playerStates.${openId}.cave`]: DbHelper.cleanHand(newCave),
        };
        result.logMsg = `完成了浣熊行动：${selectedCards.length}张进洞穴，将摸${result.drawCount}张牌`;
        break;
      }

      case 'ACTION_BEAR': {
        // 棕熊效果：将空地所有卡牌放入洞穴
        const clearingCards = clearing || [];
        if (clearingCards.length > 0) {
          const newCave = [...(playerState.cave || []), ...clearingCards.map(c => ({ ...c, selected: false }))];
          result.updates = {
            [`gameState.clearing`]: [],
            [`gameState.playerStates.${openId}.cave`]: DbHelper.cleanHand(newCave),
          };
          result.logMsg = `完成了棕熊行动：${clearingCards.length}张牌进洞穴`;
        } else {
          result.logMsg = `完成了棕熊行动：空地无牌，直接跳过`;
        }
        break;
      }

      case 'ACTION_REMOVE_CLEARING': {
        // 雌性野猪：清空空地（移除出游戏）
        const clearingCards = clearing || [];
        if (clearingCards.length > 0) {
          result.updates = {
            [`gameState.clearing`]: []
          };
          result.logMsg = `完成了野猪（雌性）行动：将${clearingCards.length}张空地牌移除游戏`;
        } else {
          result.logMsg = `完成了野猪（雌性）行动：空地无牌，直接跳过`;
        }
        break;
      }

      case 'ACTION_PICK_FROM_CLEARING': {
        // 欧洲野猫：从空地选一张牌进洞穴
        if (selectedClearingIdx === undefined || selectedClearingIdx < 0) {
          result.success = false;
          result.errorMsg = "请先选择空地牌";
          return result;
        }

        const card = clearing[selectedClearingIdx];
        const newClearing = clearing.filter((_, idx) => idx !== selectedClearingIdx);
        const newCave = [...(playerState.cave || []), { ...card, selected: false }];

        result.updates = {
          [`gameState.clearing`]: DbHelper.cleanClearing(newClearing),
          [`gameState.playerStates.${openId}.cave`]: DbHelper.cleanHand(newCave),
        };
        result.logMsg = `完成了欧洲野猫行动：从空地拿走 ${card.name} 放入洞穴`;
        break;
      }

      case 'ACTION_CLEARING_TO_CAVE':
      case 'CLEARING_TO_CAVE': {
        // 蜂群效果：将符合条件的空地牌放入洞穴 (树、灌木、植物)
        const tags = actionConfig?.tags || [];
        const clearingCards = clearing || [];
        const toCave = clearingCards.filter(c => {
          if (c.type === CARD_TYPES.TREE) return true;
          if (c.tags && c.tags.some(t => tags.includes(t))) return true;
          return false;
        });

        if (toCave.length > 0) {
          const newClearing = clearingCards.filter(c => !toCave.includes(c));
          const newCave = [...(playerState.cave || []), ...toCave.map(c => ({ ...c, selected: false }))];
          result.updates = {
            [`gameState.clearing`]: DbHelper.cleanClearing(newClearing),
            [`gameState.playerStates.${openId}.cave`]: DbHelper.cleanHand(newCave),
          };
          result.logMsg = `完成了蜂群行动：${toCave.length}张符合条件的牌进洞穴`;
        } else {
          result.logMsg = `完成了蜂群行动：空地没有符合条件的牌`;
        }
        break;
      }

      case 'ACTION_PLAY_SAPLINGS': {
        result.logMsg = `完成了水田鼠行动：打出了多棵树苗`;
        break;
      }

      case 'PICK_FROM_CLEARING_TO_HAND': {
        // 大蚊：从空地选卡进手牌 (Bonus)
        if (selectedClearingIdx === undefined || selectedClearingIdx < 0) {
          result.success = false;
          result.errorMsg = "请选择空地牌";
          return result;
        }
        if (playerState.hand.length >= 10) {
          result.success = false;
          result.errorMsg = "手牌已满";
          return result;
        }

        const card = clearing[selectedClearingIdx];
        const newHand = [...playerState.hand, { ...card, selected: false }];
        const newClearing = clearing.filter((_, idx) => idx !== selectedClearingIdx);

        result.updates = {
          [`gameState.clearing`]: DbHelper.cleanClearing(newClearing),
          [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(newHand)
        };
        result.logMsg = `奖励：从空地拿走 ${card.name} 放入手牌`;
        break;
      }

      default:
        result.logMsg = `完成了特殊行动: ${mode}`;
        break;
    }
    return result;
  },
};

module.exports = SpecialActionUtils;
