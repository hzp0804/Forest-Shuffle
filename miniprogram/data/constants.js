// 卡包：基础版 / 阿尔卑斯扩展 / 林缘扩展
const DECK_TYPES = {
  BASIC: "basic",
  ALPINE: "alpine",
  EDGE: "edge"
};

// 卡片类型
const CARD_TYPES = {
  TREE: "tree", // 单卡（林缘扩展 / 林地边缘）
  V_CARD: "vCard", // 垂直附属卡
  H_CARD: "hCard", // 水平附属卡
  W_CARD: "wCard" // 冬季卡
};

// 标签
const TAGS = {
  BUTTERFLY: "蝴蝶",
  INSECT: "昆虫",
  MUSHROOM: "蘑菇",
  BIRD: "鸟",
  BAT: "蝙蝠",
  PAW: "爪子",
  AMPHIBIAN: "两栖动物",
  PLANT: "植物",
  MOUNTAIN: "高山",
  LARIX: "落叶松属",
  PINUS: "松属",
  CLOVEN: "蹄足",
  SHRUB: "灌木",
  EDGE: "林缘",
  DEER: "鹿",
  CLOVEN_HOOFED_ANIMAL: "蹄足动物",
  TREE: "树",
};

// 基础树木名称
const SPECIES_NAMES = {
  LINDEN: "椴树",
  OAK: "橡树",
  SILVER_FIR: "银杉",
  BIRCH: "桦树",
  BEECH: "山毛榉",
  SYCAMORE: "梧桐",
  DOUGLAS_FIR: "冷杉",
  HORSE_CHESTNUT: "欧洲七叶树",
  // 基础生物
  EUROPEAN_HARE: "欧洲野兔",
  EUROPEAN_BADGER: "欧洲獾",
  GREATER_HORSESHOE_BAT: "马铁菊头蝠",
  RED_FOX: "赤狐",
  RACCOON: "浣熊",
  WILD_BOAR: "野猪",
  BROWN_LONG_EARED_BAT: "褐大耳蝠",
  ROE_DEER: "西方狍",
  BARBASTELLE_BAT: "宽耳犬吻蝠",
  BROWN_BEAR: "棕熊",
  BEECH_MARTEN: "石貂",
  RED_DEER: "马鹿",
  LYNX: "猞猁",
  GNAT: "蚊子",
  VIOLET_CARPENTER_BEE: "紫木蜂",
  FALLOW_DEER: "小鹿",
  EUROPEAN_FAT_DORMOUSE: "欧洲睡鼠",
  WOLF: "狼",
  BECHSTEIN: "贝希斯坦蝙蝠",
  SQUEAKER: "小野猪",
  GOSHAWK: "苍鹰",
  MOSS: "苔藓",
  GREAT_SPOTTED_WOODPECKER: "大斑啄木鸟",
  WOOD_ANT: "红褐林蚁",
  CHAFFINCH: "苍头燕雀",
  TAWNY_OWL: "灰林鸮",
  STAG_BEETLE: "锹甲",
  SILVER_WASHED_FRITILLARY: "绿豹蛱蝶",
  FIRE_SALAMANDER: "火蝾螈",
  PURPLE_EMPEROR: "紫闪蛱蝶",
  POND_TURTLE: "泽龟",
  CAMBERWELL_BEAUTY: "黄缘蛱蝶",
  LARGE_TORTOISESHELL: "榆蛱蝶",
  BULLFINCH: "红腹灰雀",
  TREE_FROG: "树蛙",
  COMMON_TOAD: "大蟾蜍",
  EURASIAN_JAY: "松鸦",
  TREE_FERNS: "树蕨",
  WILD_STRAWBERRIES: "野草莓",
  BLACKBERRIES: "黑莓",
  FIREFLIES: "萤火虫",
  HEDGEHOG: "刺猬",
  PEACOCK_BUTTERFLY: "孔雀蛱蝶",
  RED_SQUIRREL: "红松松鼠",
  CHANTERELLE: "鸡油菌",
  MOLE: "鼹鼠",
  FLY_AGARIC: "毒蝇伞",
  PENNY_BUN: "牛肝菌",
  PARASOL_MUSHROOM: "高大环柄菇",
  // 树木（阿尔卑斯扩展）
  LARIX_DECIDUA: "欧洲落叶松",
  PINUS_CEMBRA: "瑞士石松",
  // 阿尔卑斯生物（阿尔卑斯扩展）
  MARMOTA_MARMOTA: "阿尔卑斯旱獭",
  RUPICAPRA_RUPICAPRA: "臆羚",
  TETRAO_UROGALLUS: "松鸡",
  LEPUS_TIMIDUS: "雪兔",
  CAPRA_IBEX: "羱羊",
  HYPSUGO_SAVII: "萨维伏翼",
  PARNASSIUS_PHOEBUS: "小阿波罗绢蝶",
  CRATERELLUS_CORNUCOPIODES: "灰号角菇",
  LEONTOPODIUM_NIVALE: "高山火绒草",
  VACCINIUM_MYRTILLUS: "黑果越橘",
  ICHTHYOSAURA_ALPESTRIS: "高山欧叶螈",
  AQUILA_CHRYSAETOS: "金雕",
  GYPAETUS_BARBATUS: "胡兀鹫",
  GENTIANA: "龙胆草",
  CORVUS_CORAX: "渡鸦",
  // 灌木（林缘扩展）
  SAMBUCUS: "接骨木",
  COMMON_HAZEL: "欧榛",
  BLACKTHORN: "黑刺李",
  // 林缘生物（林缘扩展）
  MAP_BUTTERFLY: "盛蛱蝶",
  DIGITALIS: "毛地黄",
  URTICA: "荨麻",
  GREAT_GREEN_BUSH_CRICKET: "绿丛螽",
  EUROPEAN_WATER_VOLE: "水田鼠",
  EURASIAN_MAGPIE: "欧亚喜鹊",
  COMMON_NIGHTINGALE: "夜莺",
  BARN_OWL: "仓鸮",
  WILD_BOAR_FEMALE: "野猪（雌性）",
  BEEHIVE: "蜂群",
  EUROPEAN_BISON: "欧洲野牛",
  EUROPEAN_WILDCAT: "欧洲野猫",
  COMMON_PIPISTRELLE: "伏翼",
  MOSQUITO: "大蚊",
  EUROPEAN_POLECAT: "欧洲林鼬"
};

const IMG_URLS = {
  [CARD_TYPES.TREE]: `https://x.boardgamearena.net/data/themereleases/current/games/forestshuffle/250929-1034/img/trees.jpg`,
  [CARD_TYPES.H_CARD]: `https://x.boardgamearena.net/data/themereleases/current/games/forestshuffle/250929-1034/img/hCards.jpg`,
  [CARD_TYPES.V_CARD]: `https://x.boardgamearena.net/data/themereleases/current/games/forestshuffle/250929-1034/img/vCards.jpg`,
  [CARD_TYPES.W_CARD]: `https://x.boardgamearena.net/data/themereleases/current/games/forestshuffle/250929-1034/img/woodlands.Jpg`,
  [TAGS.MOUNTAIN]: `https://x.boardgamearena.net/data/themereleases/current/games/forestshuffle/250929-1034/img/mountain.jpg`,
};

const GAME_CONFIG = {
  BASE_DECK_SIZE: 233, // 一套牌:230张普通卡 + 3张冬季卡
  WINTER_CARD_COUNT: 3, // 冬季卡数量
  MAX_DECK_SIZE: 693, // 最大牌库:230*3 + 3 = 693张
};

module.exports = {
  DECK_TYPES,
  CARD_TYPES,
  TAGS,
  SPECIES_NAMES,
  IMG_URLS,
  GAME_CONFIG,
  PRESET_AVATARS: [
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI0ZGQjY1QyIvPjx0ZXh0IHg9IjUwIiB5PSI2NSIgZm9udC1zaXplPSI1MCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+QlTwvdGV4dD48L3N2Zz4=", // Fox 🦊
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzgxQzc4NCIvPjx0ZXh0IHg9IjUwIiB5PSI2NSIgZm9udC1zaXplPSI1MCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+QTYPC90ZXh0Pjwvc3ZnPg==", // Deer 🦌
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzk1NzVDRCIvPjx0ZXh0IHg9IjUwIiB5PSI2NSIgZm9udC1zaXplPSI1MCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+Qjg==PC90ZXh0Pjwvc3ZnPg==", // Owl 🦉 (Corrected)
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzY0QjVGNiIvPjx0ZXh0IHg9IjUwIiB5PSI2NSIgZm9udC1zaXplPSI1MCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+QmzwvdGV4dD48L3N2Zz4=", // Bear 🐻
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI0YwNjI5MiIvPjx0ZXh0IHg9IjUwIiB5PSI2NSIgZm9udC1zaXplPSI1MCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+QlzwvdGV4dD48L3N2Zz4=", // Butterfly 🦋
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzkwQTQAESIvPjx0ZXh0IHg9IjUwIiB5PSI2NSIgZm9udC1zaXplPSI1MCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+QlTwvdGV4dD48L3N2Zz4=" // Wolf 🐺
  ]
};
