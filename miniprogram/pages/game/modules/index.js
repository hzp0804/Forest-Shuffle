/**
 * 游戏模块统一导出
 * 将 game.js 的功能拆分到不同模块中
 */

// 核心功能
const CoreModule = require("./core.js");

// 实时监听
const WatcherModule = require("./watcher.js");

// 抽牌逻辑
const DrawModule = require("./draw.js");

// 用户交互
const InteractionModule = require("./interaction.js");

// 特殊行动
const ActionModule = require("./action.js");

// 基础出牌
const PlayModule = require("./play.js");

// 事件处理
const EventsModule = require("./events.js");

// 显示相关
const DisplayModule = require("./display.js");

// 金手指
const CheatModule = require("./cheat.js");

// 树苗
const SaplingModule = require("./sapling.js");

// 特殊出牌行动
const PlaySpecialModule = require("./playSpecial.js");

// 普通出牌
const PlayNormalModule = require("./playNormal.js");

// 奖励处理
const PlayRewardModule = require("./playReward.js");

module.exports = {
  // Core
  ...CoreModule,

  // Watcher
  ...WatcherModule,

  // Draw
  ...DrawModule,

  // Interaction
  ...InteractionModule,

  // Action
  ...ActionModule,

  // Play
  ...PlayModule,

  // Events
  ...EventsModule,

  // Display
  ...DisplayModule,

  // Cheat
  ...CheatModule,

  // Sapling
  ...SaplingModule,

  // Play Special
  ...PlaySpecialModule,

  // Play Normal
  ...PlayNormalModule,

  // Play Reward
  ...PlayRewardModule
};
