/**
 * 游戏逻辑枚举定义
 * 用于结构化 effect, bonus, points 逻辑
 */

// 1. 被动/触发效果类型 (Effect)
const EFFECT_TYPES = {
  // 触发类
  TRIGGER_ON_PLAY_TAG_DRAW: 'TRIGGER_ON_PLAY_TAG_DRAW', // 打出某TAG牌时摸牌 (如: 鸡油菌-树木, 接骨木-植物)
  TRIGGER_ON_PLAY_POSITION: 'TRIGGER_ON_PLAY_POSITION', // 每当在特定位置打出牌时触发 (如: 牛肝菌-树顶)

  // 容量/规则修改类
  CAPACITY_INCREASE: 'CAPACITY_INCREASE', // 增加槽位容量 (如: 大蟾蜍-容纳2只)
  CAPACITY_UNLIMITED: 'CAPACITY_UNLIMITED', // 无限容量 (如: 欧洲野兔)
  TREE_MULTIPLIER: 'TREE_MULTIPLIER', // 树木计数加倍/额外计数 (如: 紫木蜂)
  SPECIES_ALIAS: 'SPECIES_ALIAS', // 视为另一种物种 (如: 雪兔->欧洲野兔)

  // 动作类 (通常是主动技能或特殊结算)
  IMMEDIATE_DRAW: 'IMMEDIATE_DRAW', // 立即摸牌 (如: 大斑啄木鸟)
  EXTRA_TURN: 'EXTRA_TURN', // 获得额外回合 (如: 松鸦)
  ACTION_MOLE: 'ACTION_MOLE', // 鼹鼠技能: 支付费用打出任意数量
  ACTION_RACCOON: 'ACTION_RACCOON', // 浣熊技能: 手牌换洞穴+摸牌
  ACTION_BEAR: 'ACTION_BEAR', // 棕熊技能: 空地牌入洞穴
  FREE_PLAY_BAT: 'FREE_PLAY_BAT', // 蚊子技能: 免费打出任意数量蝙蝠

  // 动态收益
  DRAW_PER_EXISTING: 'DRAW_PER_EXISTING', // 根据场上某物种数量摸牌 (如: 赤狐)

  // 新增复杂逻辑 (Edge Expansion & Base)
  TRIGGER_ON_PLAY_TAG_DRAW: 'TRIGGER_ON_PLAY_TAG_DRAW', // 打出某TAG牌时摸牌 (如: 接骨木/Elder -> 植物)
  CAPACITY_SHARE_SLOT: 'CAPACITY_SHARE_SLOT', // 允许共享槽位 (如: 荨麻/Urtica -> 蝴蝶)

  ACTION_REMOVE_CLEARING: 'ACTION_REMOVE_CLEARING', // 移除空地牌 (如: 野猪(雌性))
  ACTION_CLEARING_TO_CAVE: 'ACTION_CLEARING_TO_CAVE', // 空地牌进洞穴 (如: 蜂群, 欧亚喜鹊)
  ACTION_PICK_FROM_CLEARING: 'ACTION_PICK_FROM_CLEARING', // 从空地拿牌 (如: 欧洲野猫, 欧亚喜鹊)
  ACTION_PLAY_SAPLINGS: 'ACTION_PLAY_SAPLINGS', // 打出树苗 (如: 水田鼠)

  CONDITION_EXTRATURN: 'CONDITION_EXTRATURN', // 条件额外回合 (如: 仓鸮 -> 有蝙蝠时)
};

// 2. 奖励类型 (Bonus) - 通常是支付费用后的奖励
const BONUS_TYPES = {
  DRAW: 'DRAW', // 摸牌 (如: 灰林鸮-得2张)
  EXTRA_TURN: 'EXTRA_TURN', // 额外回合 (如: 橡树)
  PLAY_FREE: 'PLAY_FREE', // 免费打出特定类型牌 (如: 火蝾螈-免费爪印)
  PLAY_FREE_AND_DRAW: 'PLAY_FREE_AND_DRAW', // 复杂组合 (如: 高山欧叶螈)
  DRAW_AND_TURN: 'DRAW_AND_TURN', // 摸牌+回合 (如: 棕熊)

  // 新增 Bonus
  PLAY_FREE_SPECIFIC: 'PLAY_FREE_SPECIFIC', // 免费打出指定Tag (如: 欧榛->蝙蝠)
  PICK_FROM_CLEARING_TO_HAND: 'PICK_FROM_CLEARING_TO_HAND', // 空地拿回手牌 (如: 大蚊->蝙蝠)
  CLEARING_TO_CAVE: 'CLEARING_TO_CAVE', // 空地进洞穴 (如: 欧亚喜鹊)
};

// 3. 计分类型 (Points)
const SCORING_TYPES = {
  // 基础计分
  FLAT: 'FLAT', // 固定分 (如: 泽龟 5分)

  // 数量累计
  PER_TAG: 'PER_TAG', // 每张带有某TAG的牌 (如: 黑莓-植物2分)
  PER_SPECIES: 'PER_SPECIES', // 每张某物种 (如: 树蛙-蚊子5分)
  PER_SUBTYPE: 'PER_SUBTYPE', // 每张某子类型 (如: 鹿)

  // 唯一性累计
  PER_DIFFERENT_TAG: 'PER_DIFFERENT_TAG', // 每种不同的TAG (如: 黄缘蛱蝶-不同蝴蝶)
  PER_DIFFERENT_SPECIES: 'PER_DIFFERENT_SPECIES', // 每种不同的物种

  // 规模/查表计分
  SCALE_BY_COUNT: 'SCALE_BY_COUNT', // 根据自身数量阶梯计分 (如: 萤火虫/欧洲七叶树)
  THRESHOLD: 'THRESHOLD', // 达到阈值获得固定分 (如: 苔藓-10树得10分)
  SET_COLLECTION: 'SET_COLLECTION', // 集齐特定集合 (如: 野草莓-8种树)

  // 位置/条件计分
  POSITION_ON_CARD: 'POSITION_ON_CARD', // 位于特定卡牌上 (如: 苍头燕雀-山毛榉)
  POSITION_SHARE_SLOT: 'POSITION_SHARE_SLOT', // 与特定卡牌共享槽位 (如: 大蟾蜍)
  CONDITION_ATTACHED: 'CONDITION_ATTACHED', // 连接到此牌的牌 (如: 银杉)
  CONDITION_BELOW: 'CONDITION_BELOW', // 位于此树下方的牌 (如: 红褐林蚁)
  CONDITION_TREE_FULL: 'CONDITION_TREE_FULL', // 所在的树完全被占据 (如: 石貂)

  // 新增计分
  CONDITION_ON_SUBTYPE: 'CONDITION_ON_SUBTYPE', // 位于特定子类型上 (如: 夜莺->灌木)
  CONDITION_ON_TAG: 'CONDITION_ON_TAG', // 位于特定Tag上 (如: 欧洲林鼬->树或灌木)
  GET_POINTS_BY_COLOR: 'GET_POINTS_BY_COLOR', // 同色卡*value (如: 西方狍)

  // 洞穴计分
  CAVE_COUNT: 'CAVE_COUNT', // 洞穴内卡牌数量 (如: 胡兀鹫)

  // 比较/多数派
  MAJORITY: 'MAJORITY', // 数量比别人多 (如: 椴树)

  // 新增计分类型
  PER_NAME: 'PER_NAME', // 每张某名称的卡牌 (如: 欧洲野兔、树蛙->蚊子)
  PER_TAG_OR: 'PER_TAG_OR', // 每张带有多个Tag之一的卡牌 (如: 马鹿->树木或植物)
  PER_NAME_OR: 'PER_NAME_OR', // 每张带有多个名称之一的卡牌 (如: 欧洲野牛->橡木或山毛榉)
  CONDITION_ON_COUNT: 'CONDITION_ON_COUNT', // 达到数量条件获得分数 (如: 苔藓->至少10棵树)
  CONDITION_HAS_NAME: 'CONDITION_HAS_NAME', // 拥有某名称卡牌获得分数 (如: 猞猁->至少1只西方狍)
  CONDITION_WITH_BAT: 'CONDITION_WITH_BAT', // 同一树上有蝙蝠获得分数 (如: 欧洲睡鼠)
  DIFFERENT_BATS: 'DIFFERENT_BATS', // 不同种类蝙蝠数量 (如: 至少3种不同蝙蝠得5分)
  COLLECT_ALL_TREES: 'COLLECT_ALL_TREES', // 集齐8种不同的树木 (如: 野草莓、橡树)
  PER_CARD_UNDER_TREE: 'PER_CARD_UNDER_TREE', // 每张树下的卡 (如: 红褐林蚁)
  PER_FULL_TREE: 'PER_FULL_TREE', // 每棵完全占据的树 (如: 石貂)
  PER_CARD_ON_TREE: 'PER_CARD_ON_TREE', // 连接到这棵树的每张卡 (如: 银杉)
  POSITION_ON_SHRUB: 'POSITION_ON_SHRUB', // 位于灌木上 (如: 夜莺)
  POSITION_ON_TREE_OR_SHRUB: 'POSITION_ON_TREE_OR_SHRUB', // 位于树或灌木上 (如: 欧洲林鼬)
};

module.exports = {
  EFFECT_TYPES,
  BONUS_TYPES,
  SCORING_TYPES
};
