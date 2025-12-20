const { DECK_TYPES, CARD_TYPES, TAGS, SPECIES_NAMES } = require('./constants');
const { REWARD_TYPES, TRIGGER_TYPES, MODIFIER_TYPES, SCORING_TYPES } = require('./enums');

// effect 效果：不需要同色卡作为费用
// bonus 奖励：需要同色卡作为费用

const SPECIES_DATA = {
  [SPECIES_NAMES.BLACKBERRIES]: {
    name: "黑莓",
    nb: 3,
    tags: [TAGS.PLANT],
    cost: 0,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "",
    points: "每张带有植物符号的牌得2分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: TAGS.PLANT,
      value: 2
    },
  },

  [SPECIES_NAMES.BULLFINCH]: {
    name: "红腹灰雀",
    nb: 4,
    tags: [TAGS.BIRD],
    cost: 1,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "",
    points: "每张带有昆虫符号的牌得2分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: TAGS.INSECT,
      value: 2
    },
  },

  [SPECIES_NAMES.CAMBERWELL_BEAUTY]: {
    name: "黄缘蛱蝶",
    nb: 4,
    tags: [TAGS.INSECT, TAGS.BUTTERFLY],
    cost: 0,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "",
    points: "每张不同的蝴蝶牌得1分",
    scoreConfig: {
      type: SCORING_TYPES.BUTTERFLY_SET,
      tag: TAGS.BUTTERFLY,
      value: 1
    },
  },

  [SPECIES_NAMES.CHAFFINCH]: {
    name: "苍头燕雀",
    nb: 4,
    tags: [TAGS.BIRD],
    cost: 1,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "",
    points: "若位于山毛榉上，获得5分",
    scoreConfig: {
      type: SCORING_TYPES.POSITION_ON_CARD,
      target: SPECIES_NAMES.BEECH,
      value: 5
    },
  },

  [SPECIES_NAMES.CHANTERELLE]: {
    name: "鸡油菌",
    nb: 2,
    tags: [TAGS.MUSHROOM],
    cost: 2,
    type: CARD_TYPES.V_CARD,
    effect: "每当你打出一张带有树木符号的牌时，获得1张牌",
    effectConfig: {
      type: TRIGGER_TYPES.TRIGGER_ON_PLAY_TAG_DRAW,
      tag: CARD_TYPES.TREE,
      reward: { type: 'DRAW', value: 1 }
    },
    bonus: "",
    points: "",
  },



  [SPECIES_NAMES.EURASIAN_JAY]: {
    name: "松鸦",
    nb: 4,
    tags: [TAGS.BIRD],
    cost: 1,
    type: CARD_TYPES.V_CARD,
    effect: "获得新的回合",
    effectConfig: {
      type: REWARD_TYPES.EXTRA_TURN
    },
    bonus: "",
    points: "获得3分",
    scoreConfig: {
      type: SCORING_TYPES.FLAT,
      value: 3
    },
  },

  [SPECIES_NAMES.FIRE_SALAMANDER]: {
    name: "火蛾螈",
    nb: 3,
    tags: [TAGS.AMPHIBIAN],
    cost: 1,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "免费打出一张带有爪印符号的牌",
    bonusConfig: {
      type: REWARD_TYPES.PLAY_FREE,
      tags: [TAGS.PAW]
    },
    points: "根据你拥有的火蛾螈数量获得分数",
    scoreConfig: {
      type: SCORING_TYPES.SCALE_BY_COUNT,
      target: SPECIES_NAMES.FIRE_SALAMANDER,
      scale: {
        1: 5, 2: 15, 3: 25
      }
    },
  },



  [SPECIES_NAMES.FLY_AGARIC]: {
    name: "毒蝇伞",
    nb: 2,
    tags: [TAGS.MUSHROOM],
    cost: 2,
    type: CARD_TYPES.V_CARD,
    effect: "每当你打出一张带有爪印符号的牌时，获得1张牌",
    effectConfig: {
      type: TRIGGER_TYPES.TRIGGER_ON_PLAY_TAG_DRAW,
      tag: TAGS.PAW,
      reward: { type: 'DRAW', value: 1 }
    },
    bonus: "",
    points: "",
  },

  [SPECIES_NAMES.GOSHAWK]: {
    name: "苍鹰",
    nb: 4,
    tags: [TAGS.BIRD],
    cost: 2,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "",
    points: "每张带有鸟类符号的牌得3分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: TAGS.BIRD,
      value: 3
    },
  },

  [SPECIES_NAMES.GREAT_SPOTTED_WOODPECKER]: {
    name: "大斑啄木鸟",
    nb: 4,
    tags: [TAGS.BIRD],
    cost: 1,
    type: CARD_TYPES.V_CARD,
    effect: "获得1张牌",
    effectConfig: {
      type: REWARD_TYPES.DRAW,
      count: 1
    },
    bonus: "",
    points: "若没有其他森林的树木数量比你多，获得10分",
    scoreConfig: {
      type: SCORING_TYPES.MAJORITY,
      target: CARD_TYPES.TREE,
      value: 10,
      valueOnFail: 0
    },
  },

  [SPECIES_NAMES.HEDGEHOG]: {
    name: "刺猬",
    nb: 3,
    tags: [TAGS.PAW],
    cost: 1,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "获得1张牌",
    bonusConfig: {
      type: REWARD_TYPES.DRAW,
      count: 1
    },
    points: "每张带有蝴蝶符号的牌得2分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: TAGS.BUTTERFLY,
      value: 2
    },
  },

  [SPECIES_NAMES.LARGE_TORTOISESHELL]: {
    name: "榆蛱蝶",
    nb: 4,
    tags: [TAGS.INSECT, TAGS.BUTTERFLY],
    cost: 0,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "",
    points: "每张不同的蝴蝶牌得1分",
    scoreConfig: {
      type: SCORING_TYPES.BUTTERFLY_SET,
      tag: TAGS.BUTTERFLY,
      value: 1
    },
  },

  [SPECIES_NAMES.MOLE]: {
    name: "鼹鼠",
    nb: 2,
    tags: [TAGS.PAW],
    cost: 2,
    type: CARD_TYPES.V_CARD,
    effect: "立即支付费用打出任意数量的牌",
    effectConfig: {
      type: REWARD_TYPES.ACTION_MOLE,
      isInfinite: true
    },
    bonus: "",
    points: "",
  },

  [SPECIES_NAMES.MOSS]: {
    name: "苔藓",
    nb: 3,
    tags: [TAGS.PLANT],
    cost: 0,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "",
    points: "如果你至少拥有10棵树，获得10分",
    scoreConfig: {
      type: SCORING_TYPES.CONDITION_ON_COUNT,
      tag: CARD_TYPES.TREE,
      minCount: 10,
      value: 10
    },
  },

  [SPECIES_NAMES.PARASOL_MUSHROOM]: {
    name: "高大环柄菇",
    nb: 2,
    tags: [TAGS.MUSHROOM],
    cost: 2,
    type: CARD_TYPES.V_CARD,
    effect: "每当你打出一张位于树木下方的牌时，获得1张牌",
    effectConfig: {
      type: TRIGGER_TYPES.TRIGGER_ON_PLAY_POSITION,
      position: 'bottom',
      reward: { type: 'DRAW', value: 1 }
    },
    bonus: "",
    points: "",
  },

  [SPECIES_NAMES.PEACOCK_BUTTERFLY]: {
    name: "孔雀蛱蝶",
    nb: 4,
    tags: [TAGS.INSECT, TAGS.BUTTERFLY],
    cost: 0,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "",
    points: "每张不同的蝴蝶牌得1分",
    scoreConfig: {
      type: SCORING_TYPES.BUTTERFLY_SET,
      tag: TAGS.BUTTERFLY,
      value: 1
    },
  },

  [SPECIES_NAMES.PENNY_BUN]: {
    name: "牛肝菌",
    nb: 2,
    tags: [TAGS.MUSHROOM],
    cost: 2,
    type: CARD_TYPES.V_CARD,
    effect: "每当你往树木顶端打一张牌将会奖励一张牌",
    effectConfig: {
      type: TRIGGER_TYPES.TRIGGER_ON_PLAY_POSITION,
      position: 'top',
      reward: { type: 'DRAW', value: 1 }
    },
    bonus: "",
    points: "",
  },

  [SPECIES_NAMES.POND_TURTLE]: {
    name: "泽龟",
    nb: 2,
    tags: [TAGS.AMPHIBIAN],
    cost: 2,
    type: CARD_TYPES.V_CARD,
    effect: "获得1张牌",
    effectConfig: {
      type: REWARD_TYPES.DRAW,
      count: 1
    },
    bonus: "",
    points: "获得5分",
    scoreConfig: {
      type: SCORING_TYPES.FLAT,
      value: 5
    },
  },

  [SPECIES_NAMES.PURPLE_EMPEROR]: {
    name: "紫闪蛱蝶",
    nb: 4,
    tags: [TAGS.INSECT, TAGS.BUTTERFLY],
    cost: 0,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "",
    points: "每张不同的蝴蝶牌得1分",
    scoreConfig: {
      type: SCORING_TYPES.BUTTERFLY_SET,
      tag: TAGS.BUTTERFLY,
      value: 1
    },
  },

  [SPECIES_NAMES.RED_SQUIRREL]: {
    name: "红松鼠",
    nb: 4,
    tags: [TAGS.PAW],
    cost: 0,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "",
    points: "若位于橡树上，获得5分",
    scoreConfig: {
      type: SCORING_TYPES.POSITION_ON_CARD,
      target: SPECIES_NAMES.OAK,
      value: 5
    },
  },

  [SPECIES_NAMES.SILVER_WASHED_FRITILLARY]: {
    name: "绿豹蛱蝶",
    nb: 4,
    tags: [TAGS.INSECT, TAGS.BUTTERFLY],
    cost: 0,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "",
    points: "每张不同的蝴蝶牌得1分",
    scoreConfig: {
      type: SCORING_TYPES.BUTTERFLY_SET,
      tag: TAGS.BUTTERFLY,
      value: 1
    },
  },

  [SPECIES_NAMES.STAG_BEETLE]: {
    name: "锹甲",
    nb: 2,
    tags: [TAGS.INSECT],
    cost: 2,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "免费打出一张带有鸟符号的牌",
    bonusConfig: {
      type: REWARD_TYPES.PLAY_FREE,
      tags: [TAGS.BIRD]
    },
    points: "每张带有爪印符号的牌得1分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: TAGS.PAW,
      value: 1
    },
  },

  [SPECIES_NAMES.TAWNY_OWL]: {
    name: "灰林鸮",
    nb: 4,
    tags: [TAGS.BIRD],
    cost: 2,
    type: CARD_TYPES.V_CARD,
    effect: "获得1张牌",
    effectConfig: {
      type: REWARD_TYPES.DRAW,
      count: 1
    },
    bonus: "获得2张牌",
    bonusConfig: {
      type: REWARD_TYPES.DRAW,
      count: 2
    },
    points: "获得5分",
    scoreConfig: {
      type: SCORING_TYPES.FLAT,
      value: 5
    },
  },

  [SPECIES_NAMES.TREE_FERNS]: {
    name: "树蕨",
    nb: 3,
    tags: [TAGS.PLANT],
    cost: 1,
    type: CARD_TYPES.V_CARD,
    effect: "获得1张牌",
    effectConfig: {
      type: REWARD_TYPES.DRAW,
      count: 1
    },
    bonus: "",
    points: "每张带有两栖动物符号的牌得6分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: TAGS.AMPHIBIAN,
      value: 6
    },
  },

  [SPECIES_NAMES.TREE_FROG]: {
    name: "树蛙",
    nb: 3,
    tags: [TAGS.AMPHIBIAN],
    cost: 0,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "",
    points: "每有一只蚊子获得5分",
    scoreConfig: {
      type: SCORING_TYPES.PER_NAME,
      target: SPECIES_NAMES.GNAT,
      value: 5
    },
  },

  [SPECIES_NAMES.WILD_STRAWBERRIES]: {
    name: "野草莓",
    nb: 3,
    tags: [TAGS.PLANT],
    cost: 0,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "",
    points: "如果你集齐所有8种不同的树木，获得10分",
    scoreConfig: {
      type: SCORING_TYPES.COLLECT_ALL_TREES,
      value: 10
    },
  },

  [SPECIES_NAMES.WOOD_ANT]: {
    name: "红褐林蚁",
    nb: 3,
    tags: [TAGS.INSECT],
    cost: 1,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "",
    points: "每张树下的牌得2分",
    scoreConfig: {
      type: SCORING_TYPES.PER_CARD_UNDER_TREE,
      value: 2
    },
  },

  [SPECIES_NAMES.BARBASTELLE_BAT]: {
    name: "宽耳犬吻蝠",
    nb: 3,
    tags: [TAGS.BAT],
    cost: 1,
    type: CARD_TYPES.H_CARD,
    effect: "",
    bonus: "",
    points: "如果你有至少3种不同的蝙蝠，获得5分",
    scoreConfig: {
      type: SCORING_TYPES.DIFFERENT_BATS,
      minCount: 3,
      value: 5
    },
  },

  BECHSTEINSBAT: {
    name: "贝希斯坦蝙蝠",
    nb: 3,
    tags: [TAGS.BAT],
    cost: 1,
    type: CARD_TYPES.H_CARD,
    effect: "",
    bonus: "",
    points: "如果你有至少3种不同的蝙蝠，获得5分",
    scoreConfig: {
      type: SCORING_TYPES.DIFFERENT_BATS,
      minCount: 3,
      value: 5
    },
  },

  [SPECIES_NAMES.BEECH_MARTEN]: {
    name: "石貂",
    nb: 5,
    tags: [TAGS.PAW],
    cost: 1,
    type: CARD_TYPES.H_CARD,
    effect: "获得1张牌",
    effectConfig: {
      type: REWARD_TYPES.DRAW,
      count: 1
    },
    bonus: "",
    points: "每棵完全被占据的树木得5分",
    scoreConfig: {
      type: SCORING_TYPES.PER_FULL_TREE,
      value: 5
    },
  },

  [SPECIES_NAMES.BROWN_BEAR]: {
    name: "棕熊",
    nb: 3,
    tags: [TAGS.PAW],
    cost: 3,
    type: CARD_TYPES.H_CARD,
    effect: "将空地上的所有卡牌放入你的洞穴",
    effectConfig: {
      type: REWARD_TYPES.ACTION_BEAR
    },
    bonus: "获得1张牌并获得新的回合",
    bonusConfig: {
      type: REWARD_TYPES.DRAW_AND_TURN,
      count: 1
    },
    points: "",
  },

  [SPECIES_NAMES.BROWN_LONG_EARED_BAT]: {
    name: "褐大耳蝠",
    nb: 3,
    tags: [TAGS.BAT],
    cost: 1,
    type: CARD_TYPES.H_CARD,
    effect: "",
    bonus: "",
    points: "如果你有至少3种不同的蝙蝠，获得5分",
    scoreConfig: {
      type: SCORING_TYPES.DIFFERENT_BATS,
      minCount: 3,
      value: 5
    },
  },

  [SPECIES_NAMES.EUROPEAN_BADGER]: {
    name: "欧洲獾",
    nb: 4,
    tags: [TAGS.PAW],
    cost: 1,
    type: CARD_TYPES.H_CARD,
    effect: "",
    bonus: "免费打出一张带有爪印符号的牌",
    bonusConfig: {
      type: REWARD_TYPES.PLAY_FREE,
      tags: [TAGS.PAW]
    },
    points: "获得2分",
    scoreConfig: {
      type: SCORING_TYPES.FLAT,
      value: 2
    },
  },

  [SPECIES_NAMES.EUROPEAN_FAT_DORMOUSE]: {
    name: "欧洲睡鼠",
    nb: 4,
    tags: [TAGS.PAW],
    cost: 1,
    type: CARD_TYPES.H_CARD,
    effect: "",
    bonus: "",
    points: "如果该树上也有一只蝙蝠，获得15分",
    scoreConfig: {
      type: SCORING_TYPES.CONDITION_WITH_BAT,
      value: 15
    },
  },

  [SPECIES_NAMES.EUROPEAN_HARE]: {
    name: "欧洲野兔",
    nb: 11,
    tags: [TAGS.PAW],
    cost: 0,
    type: CARD_TYPES.H_CARD,
    effect: "该槽位可以容纳任意数量的欧洲野兔",
    effectConfig: {
      type: MODIFIER_TYPES.CAPACITY_UNLIMITED,
      target: SPECIES_NAMES.EUROPEAN_HARE
    },
    bonus: "",
    points: "每有一只欧洲野兔获得1分",
    scoreConfig: {
      type: SCORING_TYPES.PER_NAME,
      target: SPECIES_NAMES.EUROPEAN_HARE,
      value: 1
    },
  },

  [SPECIES_NAMES.FALLOW_DEER]: {
    name: "小鹿",
    nb: 4,
    tags: [TAGS.CLOVEN_HOOFED_ANIMAL, TAGS.DEER],
    cost: 2,
    type: CARD_TYPES.H_CARD,
    effect: "",
    bonus: "获得2张牌",
    bonusConfig: {
      type: REWARD_TYPES.DRAW,
      count: 2
    },
    points: "每张带有偶蹄动物符号的牌得3分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: TAGS.CLOVEN_HOOFED_ANIMAL,
      value: 3
    },
  },

  [SPECIES_NAMES.GNAT]: {
    name: "蚊子",
    nb: 3,
    tags: [TAGS.INSECT],
    cost: 0,
    type: CARD_TYPES.H_CARD,
    effect: "免费打出任意数量的蝙蝠牌",
    effectConfig: {
      type: REWARD_TYPES.PLAY_FREE,
      tags: [TAGS.BAT],
      isInfinite: true
    },
    bonus: "",
    points: "每张带有蝙蝠符号的牌得1分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: TAGS.BAT,
      value: 1
    },
  },

  [SPECIES_NAMES.GREATER_HORSESHOE_BAT]: {
    name: "马铁菊头蝠",
    nb: 3,
    tags: [TAGS.BAT],
    cost: 1,
    type: CARD_TYPES.H_CARD,
    effect: "",
    bonus: "",
    points: "如果你有至少3种不同的蝙蝠，获得5分",
    scoreConfig: {
      type: SCORING_TYPES.DIFFERENT_BATS,
      minCount: 3,
      value: 5
    },
  },

  [SPECIES_NAMES.LYNX]: {
    name: "猞猁",
    nb: 6,
    tags: [TAGS.PAW],
    cost: 1,
    type: CARD_TYPES.H_CARD,
    effect: "",
    bonus: "",
    points: "如果你至少有1只西方狍，获得10分",
    scoreConfig: {
      type: SCORING_TYPES.CONDITION_HAS_NAME,
      target: SPECIES_NAMES.ROE_DEER,
      value: 10
    },
  },

  [SPECIES_NAMES.RACCOON]: {
    name: "浣熊",
    nb: 4,
    tags: [TAGS.PAW],
    cost: 1,
    type: CARD_TYPES.H_CARD,
    effect: "将手牌中任意数量的卡牌放入你的洞穴；从牌库中抽出相同数量的牌",
    effectConfig: {
      type: REWARD_TYPES.ACTION_RACCOON
    },
    bonus: "",
    points: "",
  },

  [SPECIES_NAMES.RED_DEER]: {
    name: "马鹿",
    nb: 5,
    tags: [TAGS.CLOVEN_HOOFED_ANIMAL, TAGS.DEER],
    cost: 2,
    type: CARD_TYPES.H_CARD,
    effect: "",
    bonus: "免费打出一张带有鹿符号的牌",
    bonusConfig: {
      type: REWARD_TYPES.PLAY_FREE,
      tags: [TAGS.DEER]
    },
    points: "每张带有树木或植物符号的牌得1分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG_OR,
      tags: [CARD_TYPES.TREE, TAGS.PLANT],
      value: 1
    },
  },

  [SPECIES_NAMES.RED_FOX]: {
    name: "赤狐",
    nb: 5,
    tags: [TAGS.PAW],
    cost: 2,
    type: CARD_TYPES.H_CARD,
    effect: "每有一只欧洲野兔获得1张牌",
    effectConfig: {
      type: REWARD_TYPES.DRAW_PER_EXISTING,
      target: SPECIES_NAMES.EUROPEAN_HARE,
      perCount: 1,
      value: 1
    },
    bonus: "",
    points: "每有一只欧洲野兔获得2分",
    scoreConfig: {
      type: SCORING_TYPES.PER_NAME,
      target: SPECIES_NAMES.EUROPEAN_HARE,
      value: 2
    },
  },

  [SPECIES_NAMES.ROE_DEER]: {
    name: "西方狍",
    nb: 5,
    tags: [TAGS.CLOVEN_HOOFED_ANIMAL, TAGS.DEER],
    cost: 2,
    type: CARD_TYPES.H_CARD,
    effect: "",
    bonus: "获得1张牌",
    bonusConfig: {
      type: REWARD_TYPES.DRAW,
      count: 1
    },
    points: "每张带有匹配树木符号的牌得3分",
    scoreConfig: {
      type: SCORING_TYPES.GET_POINTS_BY_COLOR,
      value: 3
    },
  },

  [SPECIES_NAMES.SQUEAKER]: {
    name: "小野猪",
    nb: 4,
    tags: [TAGS.CLOVEN_HOOFED_ANIMAL],
    cost: 0,
    type: CARD_TYPES.H_CARD,
    effect: "",
    bonus: "",
    points: "获得1分",
    scoreConfig: {
      type: SCORING_TYPES.FLAT,
      value: 1
    },
  },

  [SPECIES_NAMES.VIOLET_CARPENTER_BEE]: {
    name: "紫木蜂",
    nb: 4,
    tags: [TAGS.INSECT],
    cost: 1,
    type: CARD_TYPES.H_CARD,
    effect: "这只蜜蜂占据的树木被算作同类型的一棵额外树木",
    effectConfig: {
      type: MODIFIER_TYPES.TREE_MULTIPLIER
    },
    bonus: "",
    points: "",
  },

  [SPECIES_NAMES.WILD_BOAR]: {
    name: "野猪",
    nb: 5,
    tags: [TAGS.CLOVEN_HOOFED_ANIMAL],
    cost: 2,
    type: CARD_TYPES.H_CARD,
    effect: "",
    bonus: "",
    points: "如果你至少有1只小野猪，获得10分",
    scoreConfig: {
      type: SCORING_TYPES.CONDITION_HAS_NAME,
      target: SPECIES_NAMES.SQUEAKER,
      value: 10
    },
  },

  [SPECIES_NAMES.WOLF]: {
    name: "狼",
    nb: 4,
    tags: [TAGS.PAW],
    cost: 3,
    type: CARD_TYPES.H_CARD,
    effect: "每有一只鹿获得1张牌",
    effectConfig: {
      type: REWARD_TYPES.DRAW_PER_EXISTING,
      tag: TAGS.DEER,
      perCount: 1,
      value: 1
    },
    bonus: "获得新的回合",
    bonusConfig: {
      type: REWARD_TYPES.EXTRA_TURN
    },
    points: "每张带有鹿符号的牌得5分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: TAGS.DEER,
      value: 5
    },
  },

  [SPECIES_NAMES.LINDEN]: {
    name: "椴树",
    nb: 9,
    tags: [CARD_TYPES.TREE],
    cost: 1,
    type: CARD_TYPES.TREE,
    effect: "",
    bonus: "",
    points: "获得1分，若没有其他森林的椴树数量比你多，则改为获得3分",
    scoreConfig: {
      type: SCORING_TYPES.MAJORITY,
      target: SPECIES_NAMES.LINDEN,
      value: 3,
      valueOnFail: 1
    },
  },

  [SPECIES_NAMES.OAK]: {
    name: "橡树",
    nb: 7,
    tags: [CARD_TYPES.TREE],
    cost: 2,
    type: CARD_TYPES.TREE,
    effect: "",
    bonus: "获得新的回合",
    bonusConfig: {
      type: REWARD_TYPES.EXTRA_TURN
    },
    points: "如果你集齐所有8种不同的树木，获得10分",
    scoreConfig: {
      type: SCORING_TYPES.COLLECT_ALL_TREES,
      value: 10
    },
  },

  [SPECIES_NAMES.SILVER_FIR]: {
    name: "银杉",
    nb: 6,
    tags: [CARD_TYPES.TREE],
    cost: 2,
    type: CARD_TYPES.TREE,
    effect: "",
    bonus: "免费打出一张带有爪印符号的牌",
    bonusConfig: {
      type: REWARD_TYPES.PLAY_FREE,
      tags: [TAGS.PAW]
    },
    points: "连接到这棵银杉的每张牌得2分",
    scoreConfig: {
      type: SCORING_TYPES.PER_CARD_ON_TREE,
      value: 2
    },
  },

  [SPECIES_NAMES.BIRCH]: {
    name: "桦树",
    nb: 10,
    tags: [CARD_TYPES.TREE],
    cost: 0,
    type: CARD_TYPES.TREE,
    effect: "获得1张牌",
    effectConfig: {
      type: REWARD_TYPES.DRAW,
      count: 1
    },
    bonus: "",
    points: "获得1分",
    scoreConfig: {
      type: SCORING_TYPES.FLAT,
      value: 1
    },
  },

  [SPECIES_NAMES.BEECH]: {
    name: "山毛榉",
    nb: 10,
    tags: [CARD_TYPES.TREE],
    cost: 1,
    type: CARD_TYPES.TREE,
    effect: "获得1张牌",
    effectConfig: {
      type: REWARD_TYPES.DRAW,
      count: 1
    },
    bonus: "",
    points: "如果你至少有4棵山毛榉，获得5分",
    scoreConfig: {
      type: SCORING_TYPES.CONDITION_ON_COUNT,
      target: SPECIES_NAMES.BEECH,
      minCount: 4,
      value: 5
    },
  },

  [SPECIES_NAMES.SYCAMORE]: {
    name: "梧桐",
    nb: 6,
    tags: [CARD_TYPES.TREE],
    cost: 2,
    type: CARD_TYPES.TREE,
    effect: "",
    bonus: "",
    points: "每张带有树木符号的牌得1分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: CARD_TYPES.TREE, // Using CARD_TYPES.TREE as tag for trees based on context
      value: 1
    },
  },

  [SPECIES_NAMES.DOUGLAS_FIR]: {
    name: "冷杉",
    nb: 7,
    tags: [CARD_TYPES.TREE],
    cost: 2,
    type: CARD_TYPES.TREE,
    effect: "",
    bonus: "获得新的回合",
    bonusConfig: {
      type: REWARD_TYPES.EXTRA_TURN
    },
    points: "获得5分",
    scoreConfig: {
      type: SCORING_TYPES.FLAT,
      value: 5
    },
  },

  [SPECIES_NAMES.HORSE_CHESTNUT]: {
    name: "欧洲七叶树",
    nb: 11,
    tags: [CARD_TYPES.TREE],
    cost: 1,
    type: CARD_TYPES.TREE,
    effect: "",
    bonus: "",
    points: "根据你拥有的欧洲七叶树数量获得分数",
    scoreConfig: {
      type: SCORING_TYPES.SCALE_BY_COUNT,
      target: SPECIES_NAMES.HORSE_CHESTNUT,
      scale: {
        1: 1, 2: 4, 3: 9, 4: 16, 5: 25, 6: 36, 7: 49
      }
    },
  },

  [SPECIES_NAMES.HYPSUGO_SAVII]: {
    name: "萨维伏翼",
    nb: 3,
    tags: [TAGS.BAT],
    cost: 1,
    type: CARD_TYPES.H_CARD,
    effect: "",
    bonus: "",
    points: "如果你有至少3种不同的蝙蝠，获得5分",
  },

  [SPECIES_NAMES.LARIX_DECIDUA]: {
    name: "欧洲落叶松",
    nb: 7,
    tags: [CARD_TYPES.TREE, TAGS.MOUNTAIN],
    cost: 1,
    type: CARD_TYPES.TREE,
    effect: "",
    bonus: "免费打出一张带有高山符号的牌",
    bonusConfig: {
      type: REWARD_TYPES.PLAY_FREE,
      tags: [TAGS.MOUNTAIN]
    },
    points: "获得3分",
    scoreConfig: {
      type: SCORING_TYPES.FLAT,
      value: 3
    },
  },

  [SPECIES_NAMES.PINUS_CEMBRA]: {
    name: "瑞士石松",
    nb: 7,
    tags: [CARD_TYPES.TREE, TAGS.MOUNTAIN],
    cost: 2,
    type: CARD_TYPES.TREE,
    effect: "获得1张牌",
    effectConfig: {
      type: REWARD_TYPES.DRAW,
      count: 1
    },
    bonus: "获得1张牌",
    bonusConfig: {
      type: REWARD_TYPES.DRAW,
      count: 1
    },
    points: "每张带有高山符号的牌得1分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: TAGS.MOUNTAIN,
      value: 1
    },
  },

  [SPECIES_NAMES.CRATERELLUS_CORNUCOPIODES]: {
    name: "灰号角菇",
    nb: 2,
    tags: [TAGS.MUSHROOM, TAGS.MOUNTAIN],
    cost: 2,
    type: CARD_TYPES.V_CARD,
    effect: "每当你打出一张带有高山符号的牌时，获得1张牌",
    effectConfig: {
      type: TRIGGER_TYPES.TRIGGER_ON_PLAY_TAG_DRAW,
      tag: TAGS.MOUNTAIN,
      reward: { type: 'DRAW', value: 1 }
    },
    bonus: "",
    points: "",
  },

  [SPECIES_NAMES.PARNASSIUS_PHOEBUS]: {
    name: "小阿波罗绢蝶",
    nb: 4,
    tags: [TAGS.BUTTERFLY, TAGS.MOUNTAIN],
    cost: 0,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "",
    points: "每张不同的蝴蝶牌得1分",
    scoreConfig: {
      type: SCORING_TYPES.BUTTERFLY_SET,
      tag: TAGS.BUTTERFLY,
      value: 1
    },
  },

  [SPECIES_NAMES.GENTIANA]: {
    name: "龙胆草",
    nb: 3,
    tags: [TAGS.PLANT, TAGS.MOUNTAIN],
    cost: 0,
    type: CARD_TYPES.V_CARD,
    effect: "免费打出一张带有蝴蝶符号的牌",
    effectConfig: {
      type: REWARD_TYPES.PLAY_FREE,
      tags: [TAGS.BUTTERFLY]
    },
    bonus: "",
    points: "每张带有蝴蝶符号的牌得3分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: TAGS.BUTTERFLY,
      value: 3
    },
  },

  [SPECIES_NAMES.VACCINIUM_MYRTILLUS]: {
    name: "越橘",
    nb: 3,
    tags: [TAGS.PLANT, TAGS.MOUNTAIN],
    cost: 1,
    type: CARD_TYPES.V_CARD,
    effect: "免费打出一张带有两栖动物符号的牌",
    effectConfig: {
      type: REWARD_TYPES.PLAY_FREE,
      tags: [TAGS.AMPHIBIAN]
    },
    bonus: "",
    points: "每张不同的鸟类牌得2分",
    scoreConfig: {
      type: SCORING_TYPES.PER_DIFFERENT_TAG,
      tag: TAGS.BIRD,
      value: 2
    },
  },

  [SPECIES_NAMES.ICHTHYOSAURA_ALPESTRIS]: {
    name: "高山欧叶螈",
    nb: 3,
    tags: [TAGS.AMPHIBIAN, TAGS.MOUNTAIN],
    cost: 1,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "免费打出一张高山牌和一张昆虫牌",
    bonusConfig: {
      type: REWARD_TYPES.PLAY_FREE,
      tags: [TAGS.MOUNTAIN, TAGS.INSECT]
    },
    points: "每张带有昆虫符号的牌得2分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: TAGS.INSECT,
      value: 2
    },
  },

  [SPECIES_NAMES.AQUILA_CHRYSAETOS]: {
    name: "金雕",
    nb: 3,
    tags: [TAGS.BIRD, TAGS.MOUNTAIN],
    cost: 1,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "",
    points: "每张带有爪印或两栖动物符号的牌得1分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG_OR,
      tags: [TAGS.PAW, TAGS.AMPHIBIAN],
      value: 1
    },
  },

  [SPECIES_NAMES.CORVUS_CORAX]: {
    name: "渡鸦",
    nb: 2,
    tags: [TAGS.BIRD, TAGS.MOUNTAIN],
    cost: 1,
    type: CARD_TYPES.V_CARD,
    effect: "获得1张牌",
    effectConfig: {
      type: REWARD_TYPES.DRAW,
      count: 1
    },
    bonus: "",
    points: "获得5分",
    scoreConfig: {
      type: SCORING_TYPES.FLAT,
      value: 5
    },
  },

  [SPECIES_NAMES.LEONTOPODIUM_NIVALE]: {
    name: "高山火绒草",
    nb: 2,
    tags: [TAGS.PLANT, TAGS.MOUNTAIN],
    cost: 1,
    type: CARD_TYPES.V_CARD,
    effect: "获得1张牌",
    effectConfig: {
      type: REWARD_TYPES.DRAW,
      count: 1
    },
    bonus: "获得1张牌",
    bonusConfig: {
      type: REWARD_TYPES.DRAW,
      count: 1
    },
    points: "获得3分",
    scoreConfig: {
      type: SCORING_TYPES.FLAT,
      value: 3
    },
  },

  [SPECIES_NAMES.GYPAETUS_BARBATUS]: {
    name: "胡兀鹫",
    nb: 3,
    tags: [TAGS.BIRD, TAGS.MOUNTAIN],
    cost: 1,
    type: CARD_TYPES.V_CARD,
    effect: "将空地上的2张牌放入你的洞穴",
    bonus: "",
    points: "你洞穴里的每张牌得1分",
    scoreConfig: {
      type: SCORING_TYPES.CAVE_COUNT,
      value: 1
    },
  },

  [SPECIES_NAMES.CAPRA_IBEX]: {
    name: "羱羊",
    nb: 3,
    tags: [TAGS.CLOVEN_HOOFED_ANIMAL, TAGS.MOUNTAIN],
    cost: 3,
    type: CARD_TYPES.H_CARD,
    effect: "获得新的回合",
    effectConfig: {
      type: REWARD_TYPES.EXTRA_TURN
    },
    bonus: "",
    points: "获得10分",
    scoreConfig: {
      type: SCORING_TYPES.FLAT,
      value: 10
    },
  },

  [SPECIES_NAMES.LEPUS_TIMIDUS]: {
    name: "雪兔",
    nb: 3,
    tags: [TAGS.PAW, TAGS.MOUNTAIN],
    cost: 0,
    type: CARD_TYPES.H_CARD,
    effect: "被视为一只欧洲野兔",
    effectConfig: {
      type: MODIFIER_TYPES.SPECIES_ALIAS,
      target: SPECIES_NAMES.EUROPEAN_HARE
    },
    bonus: "",
    points: "每有一只欧洲野兔获得1分",
    scoreConfig: {
      type: SCORING_TYPES.PER_NAME,
      target: SPECIES_NAMES.EUROPEAN_HARE,
      value: 1
    },
  },

  [SPECIES_NAMES.MARMOTA_MARMOTA]: {
    name: "高山旱獭",
    nb: 4,
    tags: [TAGS.PAW, TAGS.MOUNTAIN],
    cost: 1,
    type: CARD_TYPES.H_CARD,
    effect: "该槽位可以容纳任意数量的高山旱獭",
    effectConfig: {
      type: MODIFIER_TYPES.CAPACITY_UNLIMITED,
      target: SPECIES_NAMES.MARMOTA_MARMOTA
    },
    bonus: "",
    points: "每有一只高山旱獭获得2分",
    scoreConfig: {
      type: SCORING_TYPES.PER_NAME,
      target: SPECIES_NAMES.MARMOTA_MARMOTA,
      value: 2
    },
  },

  [SPECIES_NAMES.RUPICAPRA_RUPICAPRA]: {
    name: "臆羚",
    nb: 3,
    tags: [TAGS.CLOVEN_HOOFED_ANIMAL, TAGS.MOUNTAIN],
    cost: 1,
    type: CARD_TYPES.H_CARD,
    effect: "",
    bonus: "",
    points: "每张不同的植物牌得3分",
    scoreConfig: {
      type: SCORING_TYPES.PER_DIFFERENT_TAG,
      tag: TAGS.PLANT,
      value: 3
    },
  },

  [SPECIES_NAMES.TETRAO_UROGALLUS]: {
    name: "松鸡",
    nb: 4,
    tags: [TAGS.BIRD, TAGS.MOUNTAIN],
    cost: 1,
    type: CARD_TYPES.H_CARD,
    effect: "免费打出一张带有植物符号的牌",
    effectConfig: {
      type: REWARD_TYPES.FREE_PLAY_SPECIFIC,
      tag: TAGS.PLANT
    },
    bonus: "",
    points: "每张带有植物符号的牌得1分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: TAGS.PLANT,
      value: 1
    },
  },

  [SPECIES_NAMES.SAMBUCUS]: {
    name: "接骨木",
    nb: 4,
    tags: [TAGS.EDGE, TAGS.SHRUB],
    cost: 2,
    type: CARD_TYPES.TREE,
    effect: "每当你打出一张带有植物符号的牌时，获得1张牌",
    effectConfig: {
      type: TRIGGER_TYPES.TRIGGER_ON_PLAY_TAG_DRAW,
      tag: TAGS.PLANT,
      reward: { type: 'DRAW', value: 1 }
    },
    bonus: "免费打出一张带有植物符号的牌",
    bonusConfig: {
      type: REWARD_TYPES.PLAY_FREE,
      tags: [TAGS.PLANT]
    },
    points: "",
  },

  [SPECIES_NAMES.COMMON_HAZEL]: {
    name: "欧榛",
    nb: 4,
    tags: [TAGS.EDGE, TAGS.SHRUB],
    cost: 2,
    type: CARD_TYPES.TREE,
    effect: "每当你打出一张带有蝙蝠符号的牌时，获得1张牌",
    effectConfig: {
      type: TRIGGER_TYPES.TRIGGER_ON_PLAY_TAG_DRAW,
      tag: TAGS.BAT,
      reward: { type: 'DRAW', value: 1 }
    },
    bonus: "免费打出一张带有蝙蝠符号的牌",
    bonusConfig: {
      type: REWARD_TYPES.PLAY_FREE,
      tags: [TAGS.BAT]
    },
    points: "",
  },

  [SPECIES_NAMES.BLACKTHORN]: {
    name: "黑刺李",
    nb: 4,
    tags: [TAGS.EDGE, TAGS.SHRUB],
    cost: 2,
    type: CARD_TYPES.TREE,
    effect: "每当你打出一张带有蝴蝶符号的牌时，获得1张牌",
    effectConfig: {
      type: TRIGGER_TYPES.TRIGGER_ON_PLAY_TAG_DRAW,
      tag: TAGS.BUTTERFLY,
      reward: { type: 'DRAW', value: 1 }
    },
    bonus: "免费打出一张带有蝴蝶符号的牌",
    bonusConfig: {
      type: REWARD_TYPES.PLAY_FREE,
      tags: [TAGS.BUTTERFLY]
    },
    points: "",
  },

  [SPECIES_NAMES.WILD_BOAR_FEMALE]: {
    name: "野猪（雌性）",
    nb: 3,
    tags: [TAGS.EDGE, TAGS.CLOVEN],
    cost: 2,
    type: CARD_TYPES.H_CARD,
    effect: "将空地上所有的牌从游戏中移除",
    effectConfig: {
      type: REWARD_TYPES.ACTION_REMOVE_CLEARING
    },
    bonus: "免费打出一只小野猪",
    bonusConfig: {
      type: REWARD_TYPES.PLAY_FREE,
      targetName: SPECIES_NAMES.SQUEAKER
    },
    points: "每有一只小野猪获得10分",
    scoreConfig: {
      type: SCORING_TYPES.PER_NAME,
      target: SPECIES_NAMES.SQUEAKER,
      value: 10
    },
  },

  [SPECIES_NAMES.BEEHIVE]: {
    name: "蜂群",
    nb: 3,
    tags: [TAGS.EDGE, TAGS.INSECT],
    cost: 1,
    type: CARD_TYPES.H_CARD,
    effect: "将所有带有植物、灌木或树木符号的卡片放进你的洞穴",
    effectConfig: {
      type: REWARD_TYPES.ACTION_CLEARING_TO_CAVE,
      tags: [TAGS.PLANT, TAGS.SHRUB, CARD_TYPES.TREE]
    },
    bonus: "",
    points: "每张带有植物符号的卡片得1分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: TAGS.PLANT,
      value: 1
    },
  },

  [SPECIES_NAMES.EUROPEAN_BISON]: {
    name: "欧洲野牛",
    nb: 3,
    tags: [TAGS.EDGE, TAGS.CLOVEN],
    cost: 3,
    type: CARD_TYPES.H_CARD,
    effect: "获得新的回合",
    effectConfig: {
      type: REWARD_TYPES.EXTRA_TURN
    },
    bonus: "",
    points: "每张带有橡木或山毛榉标志的卡片可获得2分",
    scoreConfig: {
      type: SCORING_TYPES.PER_NAME_OR,
      targets: [SPECIES_NAMES.OAK, SPECIES_NAMES.BEECH],
      value: 2
    },
  },

  [SPECIES_NAMES.EUROPEAN_WILDCAT]: {
    name: "欧洲野猫",
    nb: 3,
    tags: [TAGS.EDGE, TAGS.PAW],
    cost: 1,
    type: CARD_TYPES.H_CARD,
    effect: "从空地中拿一张牌",
    effectConfig: {
      type: REWARD_TYPES.ACTION_PICK_FROM_CLEARING
    },
    bonus: "",
    points: "每张带有林地边缘符号的牌得1分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: TAGS.EDGE,
      value: 1
    },
  },

  [SPECIES_NAMES.COMMON_PIPISTRELLE]: {
    name: "伏翼",
    nb: 3,
    tags: [TAGS.EDGE, TAGS.BAT],
    cost: 1,
    type: CARD_TYPES.H_CARD,
    effect: "",
    bonus: "",
    points: "如果你有至少3种不同的蝙蝠，获得5分",
    scoreConfig: {
      type: SCORING_TYPES.DIFFERENT_BATS,
      minCount: 3,
      value: 5
    },
  },

  SQUEAKEREDGE: {
    name: "小野猪",
    nb: 3,
    tags: [TAGS.EDGE, TAGS.CLOVEN],
    cost: 0,
    type: CARD_TYPES.H_CARD,
    effect: "",
    bonus: "",
    points: "获得1分",
    scoreConfig: {
      type: SCORING_TYPES.FLAT,
      value: 1
    },
  },

  [SPECIES_NAMES.MOSQUITO]: {
    name: "大蚊",
    nb: 3,
    tags: [TAGS.EDGE, TAGS.INSECT],
    cost: 1,
    type: CARD_TYPES.H_CARD,
    effect: "免费打出任意数量的蝙蝠牌",
    effectConfig: {
      type: REWARD_TYPES.PLAY_FREE,
      tags: [TAGS.BAT],
      isInfinite: true
    },
    bonus: "把所有有蝙蝠符号的牌从空地上拿到手里",
    bonusConfig: {
      type: REWARD_TYPES.PICK_FROM_CLEARING_TO_HAND,
      tag: TAGS.BAT
    },
    points: "每张带有蝙蝠符号的牌得1分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: TAGS.BAT,
      value: 1
    },
  },

  [SPECIES_NAMES.EUROPEAN_POLECAT]: {
    name: "欧洲林鼬",
    nb: 3,
    tags: [TAGS.EDGE, TAGS.PAW],
    cost: 2,
    type: CARD_TYPES.H_CARD,
    effect: "",
    bonus: "获得新的回合",
    bonusConfig: {
      type: REWARD_TYPES.EXTRA_TURN
    },
    points: "若位于树或灌木上，获得10分",
    scoreConfig: {
      type: SCORING_TYPES.POSITION_ON_TREE_OR_SHRUB,
      value: 10
    },
  },

  [SPECIES_NAMES.MAP_BUTTERFLY]: {
    name: "盛蛱蝶",
    nb: 4,
    tags: [TAGS.EDGE, TAGS.INSECT, TAGS.BUTTERFLY],
    cost: 0,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "",
    points: "每张不同的蝴蝶牌得1分",
    scoreConfig: {
      type: SCORING_TYPES.BUTTERFLY_SET,
      tag: TAGS.BUTTERFLY,
      value: 1
    },
  },

  [SPECIES_NAMES.DIGITALIS]: {
    name: "毛地黄",
    nb: 4,
    tags: [TAGS.EDGE, TAGS.PLANT],
    cost: 0,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "",
    points: "每张不同的植物牌得1分",
    scoreConfig: {
      type: SCORING_TYPES.PER_DIFFERENT_TAG,
      tag: TAGS.PLANT,
      value: 1
    },
  },

  [SPECIES_NAMES.URTICA]: {
    name: "刺荨麻",
    nb: 3,
    tags: [TAGS.EDGE, TAGS.PLANT],
    cost: 0,
    type: CARD_TYPES.V_CARD,
    effect: "任何数量的蝴蝶都可以在这棵树或灌木上共享一个槽",
    effectConfig: {
      type: MODIFIER_TYPES.CAPACITY_SHARE_SLOT,
      tag: TAGS.BUTTERFLY
    },
    // Add slot config for stacking butterflies
    slotConfig: {
      accepts: { tags: [TAGS.BUTTERFLY] },
      capacity: 99
    },
    bonus: "",
    points: "每张带有蝴蝶符号的牌得2分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: TAGS.BUTTERFLY,
      value: 2
    },
  },

  [SPECIES_NAMES.FIREFLIES]: {
    name: "萤火虫",
    nb: 4,
    tags: [TAGS.INSECT],
    cost: 0,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "",
    points: "根据你拥有的萤火虫数量获得分数",
    scoreConfig: {
      type: SCORING_TYPES.SCALE_BY_COUNT,
      target: SPECIES_NAMES.FIREFLIES,
      scale: {
        1: 0, 2: 10, 3: 15, 4: 20
      }
    },
  },

  [SPECIES_NAMES.COMMON_TOAD]: {
    name: "大蟾蜍",
    nb: 6,
    tags: [TAGS.AMPHIBIAN], // Removed EDGE tag as per screenshot
    cost: 0,
    type: CARD_TYPES.V_CARD,
    effect: "该槽位最多可容纳2只大蟾蜍",
    effectConfig: {
      type: MODIFIER_TYPES.CAPACITY_INCREASE,
      value: 2,
      target: SPECIES_NAMES.COMMON_TOAD
    },
    bonus: "",
    points: "若2只大蟾蜍共享此槽位，获得5分",
    scoreConfig: {
      type: SCORING_TYPES.POSITION_SHARE_SLOT,
      target: SPECIES_NAMES.COMMON_TOAD,
      count: 2,
      value: 5
    },
  },

  [SPECIES_NAMES.GREAT_GREEN_BUSH_CRICKET]: {
    name: "绿丛螽",
    nb: 3,
    tags: [TAGS.EDGE, TAGS.INSECT],
    cost: 1,
    type: CARD_TYPES.V_CARD,
    effect: "免费打出一张带有鸟符号的牌",
    effectConfig: {
      type: REWARD_TYPES.FREE_PLAY_SPECIFIC,
      tag: TAGS.BIRD
    },
    bonus: "",
    points: "每张有昆虫符号的牌得1分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: TAGS.INSECT,
      value: 1
    },
  },

  [SPECIES_NAMES.EUROPEAN_WATER_VOLE]: {
    name: "水田鼠",
    nb: 2,
    tags: [TAGS.EDGE, TAGS.PAW],
    cost: 2,
    type: CARD_TYPES.V_CARD,
    effect: "立即打出任意数量的树苗",
    effectConfig: {
      type: REWARD_TYPES.ACTION_PLAY_SAPLINGS,
      isInfinite: true
    },
    bonus: "获得新的回合",
    bonusConfig: {
      type: REWARD_TYPES.EXTRA_TURN
    },
    points: "",
  },

  [SPECIES_NAMES.EURASIAN_MAGPIE]: {
    name: "欧亚喜鹊",
    nb: 3,
    tags: [TAGS.EDGE, TAGS.BIRD],
    cost: 1,
    type: CARD_TYPES.V_CARD,
    effect: "从空地中拿一张牌",
    effectConfig: {
      type: REWARD_TYPES.ACTION_PICK_FROM_CLEARING
    },
    bonus: "从空地上放两张牌到你的洞穴里",
    bonusConfig: {
      type: REWARD_TYPES.CLEARING_TO_CAVE,
      count: 2
    },
    points: "获得3分",
    scoreConfig: {
      type: SCORING_TYPES.FLAT,
      value: 3
    },
  },

  [SPECIES_NAMES.COMMON_NIGHTINGALE]: {
    name: "夜莺",
    nb: 3,
    tags: [TAGS.EDGE, TAGS.BIRD],
    cost: 1,
    type: CARD_TYPES.V_CARD,
    effect: "",
    bonus: "获得新的回合",
    bonusConfig: {
      type: REWARD_TYPES.EXTRA_TURN
    },
    points: "若位于灌木丛上，获得5分",
    scoreConfig: {
      type: SCORING_TYPES.POSITION_ON_SHRUB,
      value: 5
    },
  },

  [SPECIES_NAMES.BARN_OWL]: {
    name: "仓鸮",
    nb: 2,
    tags: [TAGS.EDGE, TAGS.BIRD],
    cost: 2,
    type: CARD_TYPES.V_CARD,
    effect: "如果你的森林里至少有一只蝙蝠，获得新的回合",
    effectConfig: {
      type: REWARD_TYPES.CONDITION_EXTRATURN,
      tag: TAGS.BAT
    },
    bonus: "",
    points: "每张带有蝙蝠符号的牌获得3分",
    scoreConfig: {
      type: SCORING_TYPES.PER_TAG,
      tag: TAGS.BAT,
      value: 3
    },
  },
};

const SAPLING_DATA = {
  name: "树苗", // Sapling
  nb: 0, // Infinite
  tags: [TAGS.TREE, CARD_TYPES.TREE],
  cost: 0,
  type: CARD_TYPES.TREE, // Treated as Tree
  effect: "",
  bonus: "",
  points: "",
};

module.exports = { SPECIES_DATA, SAPLING_DATA };
