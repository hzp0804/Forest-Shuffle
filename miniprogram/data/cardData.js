// 卡包：基础版 / 阿尔卑斯扩展 / 林缘扩展
const BASIC_DECK = "basic";
const ALPINE_DECK = "alpine";
const EDGE_DECK = "edge";

// 卡片类型
const TREE = "tree" // 单卡（林缘扩展 / 林地边缘）
const V_CARD = "vCard" // 垂直附属卡
const H_CARD = "hCard" // 水平附属卡
const W_CARD = "wCard" // 冬季卡

// 标签
const BUTTERFLY = "蝴蝶"
const INSECT = "昆虫"
const MUSHROOM = "蘑菇"
const BIRD = "鸟"
const BAT = "蝙蝠"
const PAW = "爪子"
const AMPHIBIAN = "两栖动物"
const PLANT = "植物"
const MOUNTAIN = "高山"
const LARIX = "落叶松属"
const PINUS = "松属"
const CLOVEN = "蹄足"
const SHRUB = "灌木"
const EDGE = "林缘"

// 根据卡片类型获取雪碧图，根据卡片ID定位卡片
const imgUrl = {
  [TREE]: `https://x.boardgamearena.net/data/themereleases/current/games/forestshuffle/250929-1034/img/trees.jpg`,
  [H_CARD]: `https://x.boardgamearena.net/data/themereleases/current/games/forestshuffle/250929-1034/img/hCards.jpg`,
  [V_CARD]: `https://x.boardgamearena.net/data/themereleases/current/games/forestshuffle/250929-1034/img/vCards.jpg`,
  [W_CARD]: `https://x.boardgamearena.net/data/themereleases/current/games/forestshuffle/250929-1034/img/woodlands.Jpg`,
  [MOUNTAIN]: `https://x.boardgamearena.net/data/themereleases/current/games/forestshuffle/250929-1034/img/mountain.jpg`,
};


// 基础树木
const LINDEN = "椴树"
const OAK = "橡树"
const SILVER_FIR = "银杉"
const BIRCH = "桦树"
const BEECH = "山毛榉"
const SYCAMORE = "梧桐"
const DOUGLAS_FIR = "冷杉"
const HORSE_CHESTNUT = "欧洲七叶树"
// 基础生物
const EUROPEAN_HARE = "欧洲野兔"
const EUROPEAN_BADGER = "欧洲獾"
const GREATER_HORSESHOE_BAT = "马铁菊头蝠"
const RED_FOX = "赤狐"
const RACCOON = "浣熊"
const WILD_BOAR = "野猪"
const BROWN_LONG_EARED_BAT = "褐大耳蝠"
const ROE_DEER = "西方狍"
const BARBASTELLE_BAT = "宽耳犬吻蝠"
const BROWN_BEAR = "棕熊"
const BEECH_MARTEN = "石貂"
const RED_DEER = "马鹿"
const LYNX = "猞猁"
const GNAT = "蚊子"
const VIOLET_CARPENTER_BEE = "紫木蜂"
const FALLOW_DEER = "小鹿"
const EUROPEAN_FAT_DORMOUSE = "欧洲睡鼠"
const WOLF = "狼"
const BECHSTEIN = "贝希斯坦蝙蝠"
const SQUEAKER = "小野猪"
const GOSHAWK = "苍鹰"
const MOSS = "苔藓"
const GREAT_SPOTTED_WOODPECKER = "大斑啄木鸟"
const WOOD_ANT = "红褐林蚁"
const CHAFFINCH = "苍头燕雀"
const TAWNY_OWL = "灰林鸮"
const STAG_BEETLE = "锹甲"
const SILVER_WASHED_FRITILLARY = "绿豹蛱蝶"
const FIRE_SALAMANDER = "火蝾螈"
const PURPLE_EMPEROR = "紫闪蛱蝶"
const POND_TURTLE = "泽龟"
const CAMBERWELL_BEAUTY = "黄缘蛱蝶"
const LARGE_TORTOISESHELL = "榆蛱蝶"
const BULLFINCH = "红腹灰雀"
const TREE_FROG = "树蛙"
const COMMON_TOAD = "大蟾蜍"
const EURASIAN_JAY = "松鸦"
const TREE_FERNS = "树蕨"
const WILD_STRAWBERRIES = "野草莓"
const BLACKBERRIES = "黑莓"
const FIREFLIES = "萤火虫"
const HEDGEHOG = "刺猬"
const PEACOCK_BUTTERFLY = "孔雀蛱蝶"
const RED_SQUIRREL = "红松松鼠"
const CHANTERELLE = "鸡油菌"
const MOLE = "鼹鼠"
const FLY_AGARIC = "毒蝇伞"
const PENNY_BUN = "牛肝菌"
const PARASOL_MUSHROOM = "高大环柄菇"

// 树木（阿尔卑斯扩展）
const LARIX_DECIDUA = "欧洲落叶松"
const PINUS_CEMBRA = "瑞士石松"
// 阿尔卑斯生物（阿尔卑斯扩展）
const MARMOTA_MARMOTA = "阿尔卑斯旱獭"
const RUPICAPRA_RUPICAPRA = "臆羚"
const TETRAO_UROGALLUS = "松鸡"
const LEPUS_TIMIDUS = "雪兔"
const CAPRA_IBEX = "羱羊"
const HYPSUGO_SAVII = "萨维伏翼"
const PARNASSIUS_PHOEBUS = "小阿波罗绢蝶"
const CRATERELLUS_CORNUCOPIODES = "灰号角菇"
const LEONTOPODIUM_NIVALE = "高山火绒草"
const VACCINIUM_MYRTILLUS = "黑果越橘"
const ICHTHYOSAURA_ALPESTRIS = "高山欧叶螈"
const AQUILA_CHRYSAETOS = "金雕"
const GYPAETUS_BARBATUS = "胡兀鹫"
const GENTIANA = "龙胆草"
const CORVUS_CORAX = "渡鸦"

// 灌木（林缘扩展）
const SAMBUCUS = "接骨木"
const COMMON_HAZEL = "欧榛"
const BLACKTHORN = "黑刺李"
// 林缘生物（林缘扩展）
const MAP_BUTTERFLY = "盛蛱蝶"
const DIGITALIS = "毛地黄"
const URTICA = "荨麻"
const GREAT_GREEN_BUSH_CRICKET = "绿丛螽"
const EUROPEAN_WATER_VOLE = "水田鼠"
const EURASIAN_MAGPIE = "欧亚喜鹊"
const COMMON_NIGHTINGALE = "夜莺"
const BARN_OWL = "仓鸮"
const WILD_BOAR_FEMALE_ = "野猪（雌性）"
const BEEHIVE = "蜂群"
const EUROPEAN_BISON = "欧洲野牛"
const EUROPEAN_WILDCAT = "欧洲野猫"
const COMMON_PIPISTRELLE = "伏翼"
const MOSQUITO = "大蚊"
const EUROPEAN_POLECAT = "欧洲林鼬"
// const SQUEAKER_EDGE = "小野猪" // 用SQUEAKER


// const WITH_OTHERS = [
//   FIREFLIES,
//   HORSE_CHESTNUT,
//   FIRE_SALAMANDER,
//   CAMBERWELL_BEAUTY,
//   LARGE_TORTOISESHELL,
//   PEACOCK_BUTTERFLY,
//   PURPLE_EMPEROR,
//   PARNASSIUS_PHOEBUS,
//   SILVER_WASHED_FRITILLARY,
// ];
// const SLOT_SCORE = [EUROPEAN_HARE, COMMON_TOAD];

const SPECIES_DATA = {
  BLACKBERRIES: {
    name: "黑莓",
    nb: 3,
    tags: [PLANT],
    cost: 0,
    type: "vCard",
    effect: "",
    bonus: "",
    points: "每张带有植物符号的牌得2分",
  },

  BULLFINCH: {
    name: "红腹灰雀",
    nb: 4,
    tags: [BIRD],
    cost: 1,
    type: "vCard",
    effect: "",
    bonus: "",
    points: "每张带有昆虫符号的牌得2分",
  },

  CAMBERWELLBEAUTY: {
    name: "黄缘蛱蝶",
    nb: 4,
    tags: [INSECT, BUTTERFLY],
    cost: 0,
    type: "vCard",
    effect: "",
    bonus: "",
    points: "每张不同的蝴蝶牌得1分",
  },

  CHAFFINCH: {
    name: "苍头燕雀",
    nb: 4,
    tags: [BIRD],
    cost: 1,
    type: "vCard",
    effect: "",
    bonus: "",
    points: "若位于山毛榉上，获得5分",
  },

  CHANTERELLE: {
    name: "鸡油菌",
    nb: 2,
    tags: [MUSHROOM],
    cost: 2,
    type: "vCard",
    effect: "每当你打出一张带有树木符号的牌时，获得1张牌",
    bonus: "",
    points: "",
  },

  COMMONTOAD: {
    name: "大蟾蜍",
    nb: 6,
    tags: [AMPHIBIAN],
    cost: 0,
    type: "vCard",
    effect: "该槽位最多可容纳2只大蟾蜍",
    bonus: "",
    points: "若2只大蟾蜍共享此槽位，获得5分",
  },

  EURASIANJAY: {
    name: "松鸦",
    nb: 4,
    tags: [BIRD],
    cost: 1,
    type: "vCard",
    effect: "获得新的回合",
    bonus: "",
    points: "获得3分",
  },

  FIRESALAMANDER: {
    name: "火蛾螈",
    nb: 3,
    tags: [AMPHIBIAN],
    cost: 1,
    type: "vCard",
    effect: "",
    bonus: "免费打出一张带有爪印符号的牌",
    points: "根据你拥有的火蛾螈数量获得分数",
  },

  FIREFLIES: {
    name: "萤火虫",
    nb: 4,
    tags: [INSECT],
    cost: 0,
    type: "vCard",
    effect: "",
    bonus: "",
    points: "根据你拥有的萤火虫数量获得分数",
  },

  FLYAGARIC: {
    name: "毒蝇伞",
    nb: 2,
    tags: [MUSHROOM],
    cost: 2,
    type: "vCard",
    effect: "每当你打出一张带有爪印符号的牌时，获得1张牌",
    bonus: "",
    points: "",
  },

  GOSHAWK: {
    name: "苍鹰",
    nb: 4,
    tags: [BIRD],
    cost: 2,
    type: "vCard",
    effect: "",
    bonus: "",
    points: "每张带有鸟类符号的牌得3分",
  },

  GREATSPOTTEDWOODPECKER: {
    name: "大斑啄木鸟",
    nb: 4,
    tags: [BIRD],
    cost: 1,
    type: "vCard",
    effect: "获得1张牌",
    bonus: "",
    points: "若没有其他森林的树木数量比你多，获得10分",
  },

  HEDGEHOG: {
    name: "刺猬",
    nb: 3,
    tags: [PAW],
    cost: 1,
    type: "vCard",
    effect: "",
    bonus: "获得1张牌",
    points: "每张带有蝴蝶符号的牌得2分",
  },

  LARGETORTOISESHELL: {
    name: "榆蛱蝶",
    nb: 4,
    tags: [INSECT, BUTTERFLY],
    cost: 0,
    type: "vCard",
    effect: "",
    bonus: "",
    points: "每张不同的蝴蝶牌得1分",
  },

  MOLE: {
    name: "鼹鼠",
    nb: 2,
    tags: [PAW],
    cost: 2,
    type: "vCard",
    effect: "立即支付费用打出任意数量的牌",
    bonus: "",
    points: "",
  },

  MOSS: {
    name: "苔藓",
    nb: 3,
    tags: [PLANT],
    cost: 0,
    type: "vCard",
    effect: "",
    bonus: "",
    points: "如果你至少拥有10棵树，获得10分",
  },

  PARASOLMUSHROOM: {
    name: "高大环柄菇",
    nb: 2,
    tags: [MUSHROOM],
    cost: 2,
    type: "vCard",
    effect: "每当你打出一张位于树木下方的牌时，获得1张牌",
    bonus: "",
    points: "",
  },

  PEACOCKBUTTERFLY: {
    name: "孔雀蛱蝶",
    nb: 4,
    tags: [INSECT, BUTTERFLY],
    cost: 0,
    type: "vCard",
    effect: "",
    bonus: "",
    points: "每张不同的蝴蝶牌得1分",
  },

  PENNYBUN: {
    name: "牛肝菌",
    nb: 2,
    tags: [MUSHROOM],
    cost: 2,
    type: "vCard",
    effect: "每当你往树木顶端打一张牌将会奖励一张牌（仅树木，灌木不算）",
    bonus: "",
    points: "",
  },

  PONDTURTLE: {
    name: "泽龟",
    nb: 2,
    tags: [AMPHIBIAN],
    cost: 2,
    type: "vCard",
    effect: "获得1张牌",
    bonus: "",
    points: "获得5分",
  },

  PURPLEEMPEROR: {
    name: "紫闪蛱蝶",
    nb: 4,
    tags: [INSECT, BUTTERFLY],
    cost: 0,
    type: "vCard",
    effect: "",
    bonus: "",
    points: "每张不同的蝴蝶牌得1分",
  },

  REDSQUIRREL: {
    name: "红松鼠",
    nb: 4,
    tags: [PAW],
    cost: 0,
    type: "vCard",
    effect: "",
    bonus: "",
    points: "若位于橡树上，获得5分",
  },

  SILVERWASHEDFRITILLARY: {
    name: "绿豹蛱蝶",
    nb: 4,
    tags: [INSECT, BUTTERFLY],
    cost: 0,
    type: "vCard",
    effect: "",
    bonus: "",
    points: "每张不同的蝴蝶牌得1分",
  },

  STAGBEETLE: {
    name: "锹甲",
    nb: 2,
    tags: [INSECT],
    cost: 2,
    type: "vCard",
    effect: "",
    bonus: "免费打出一张带有鸟符号的牌",
    points: "每张带有爪印符号的牌得1分",
  },

  TAWNYOWL: {
    name: "灰林鸮",
    nb: 4,
    tags: [BIRD],
    cost: 2,
    type: "vCard",
    effect: "获得1张牌",
    bonus: "获得2张牌",
    points: "获得5分",
  },

  TREEFERNS: {
    name: "树蕨",
    nb: 3,
    tags: [PLANT],
    cost: 1,
    type: "vCard",
    effect: "获得1张牌",
    bonus: "",
    points: "每张带有两栖动物符号的牌得6分",
  },

  TREEFROG: {
    name: "树蛙",
    nb: 3,
    tags: [AMPHIBIAN],
    cost: 0,
    type: "vCard",
    effect: "",
    bonus: "",
    points: "每有一只蚊子获得5分",
  },

  WILDSTRAWBERRIES: {
    name: "野草莓",
    nb: 3,
    tags: [PLANT],
    cost: 0,
    type: "vCard",
    effect: "",
    bonus: "",
    points: "如果你集齐所有8种不同的树木，获得10分",
  },

  WOODANT: {
    name: "红褐林蚁",
    nb: 3,
    tags: [INSECT],
    cost: 1,
    type: "vCard",
    effect: "",
    bonus: "",
    points: "每张树下的牌得2分",
  },

  BARBASTELLEBAT: {
    name: "宽耳犬吻蝠",
    nb: 3,
    tags: [BAT],
    cost: 1,
    type: "hCard",
    effect: "",
    bonus: "",
    points: "如果你有至少3种不同的蝙蝠，获得5分",
  },

  BECHSTEINSBAT: {
    name: "贝希斯坦蝙蝠",
    nb: 3,
    tags: [BAT],
    cost: 1,
    type: "hCard",
    effect: "",
    bonus: "",
    points: "如果你有至少3种不同的蝙蝠，获得5分",
  },

  BEECHMARTEN: {
    name: "石貂",
    nb: 5,
    tags: [PAW],
    cost: 1,
    type: "hCard",
    effect: "获得1张牌",
    bonus: "",
    points: "每棵完全被占据的树木得5分",
  },

  BROWNBEAR: {
    name: "棕熊",
    nb: 3,
    tags: [PAW],
    cost: 3,
    type: "hCard",
    effect: "将空地上的所有卡牌放入你的洞穴",
    bonus: "获得1张牌并获得新的回合",
    points: "",
  },

  BROWNLONGEAREDBAT: {
    name: "褐大耳蝠",
    nb: 3,
    tags: [BAT],
    cost: 1,
    type: "hCard",
    effect: "",
    bonus: "",
    points: "如果你有至少3种不同的蝙蝠，获得5分",
  },

  EUROPEANBADGER: {
    name: "欧洲獾",
    nb: 4,
    tags: [PAW],
    cost: 1,
    type: "hCard",
    effect: "",
    bonus: "免费打出一张带有爪印符号的牌",
    points: "获得2分",
  },

  EUROPEANFATDORMOUSE: {
    name: "欧洲睡鼠",
    nb: 4,
    tags: [PAW],
    cost: 1,
    type: "hCard",
    effect: "",
    bonus: "",
    points: "如果该树上也有一只蝙蝠，获得15分",
  },

  EUROPEANHARE: {
    name: "欧洲野兔",
    nb: 11,
    tags: [PAW],
    cost: 0,
    type: "hCard",
    effect: "该槽位可以容纳任意数量的欧洲野兔",
    bonus: "",
    points: "每有一只欧洲野兔获得1分",
  },

  FALLOWDEER: {
    name: "小鹿",
    nb: 4,
    tags: ["Cloven-hoofed animal", "Deer"],
    cost: 2,
    type: "hCard",
    effect: "",
    bonus: "获得2张牌",
    points: "每张带有偶蹄动物符号的牌得3分",
  },

  GNAT: {
    name: "蚊子",
    nb: 3,
    tags: [INSECT],
    cost: 0,
    type: "hCard",
    effect: "免费打出任意数量的蝙蝠牌",
    bonus: "",
    points: "每张带有蝙蝠符号的牌得1分",
  },

  GREATERHORSESHOEBAT: {
    name: "马铁菊头蝠",
    nb: 3,
    tags: [BAT],
    cost: 1,
    type: "hCard",
    effect: "",
    bonus: "",
    points: "如果你有至少3种不同的蝙蝠，获得5分",
  },

  LYNX: {
    name: "猞猁",
    nb: 6,
    tags: [PAW],
    cost: 1,
    type: "hCard",
    effect: "",
    bonus: "",
    points: "如果你至少有1只西方狍，获得10分",
  },

  RACCOON: {
    name: "浣熊",
    nb: 4,
    tags: [PAW],
    cost: 1,
    type: "hCard",
    effect: "将手牌中任意数量的卡牌放入你的洞穴；从牌库中抽出相同数量的牌",
    bonus: "",
    points: "",
  },

  REDDEER: {
    name: "马鹿",
    nb: 5,
    tags: ["Cloven-hoofed animal", "Deer"],
    cost: 2,
    type: "hCard",
    effect: "",
    bonus: "免费打出一张带有鹿符号的牌",
    points: "每张带有树木或植物符号的牌得1分",
  },

  REDFOX: {
    name: "赤狐",
    nb: 5,
    tags: [PAW],
    cost: 2,
    type: "hCard",
    effect: "每有一只欧洲野兔获得1张牌",
    bonus: "",
    points: "每有一只欧洲野兔获得2分",
  },

  ROEDEER: {
    name: "西方狍",
    nb: 5,
    tags: ["Cloven-hoofed animal", "Deer"],
    cost: 2,
    type: "hCard",
    effect: "",
    bonus: "获得1张牌",
    points: "每张带有匹配树木符号的牌得3分",
  },

  SQUEAKER: {
    name: "小野猪",
    nb: 4,
    tags: ["Cloven-hoofed animal"],
    cost: 0,
    type: "hCard",
    effect: "",
    bonus: "",
    points: "获得1分",
  },

  VIOLETCARPENTERBEE: {
    name: "紫木蜂",
    nb: 4,
    tags: [INSECT],
    cost: 1,
    type: "hCard",
    effect: "这只蜜蜂占据的树木被算作同类型的一棵额外树木",
    bonus: "",
    points: "",
  },

  WILDBOAR: {
    name: "野猪",
    nb: 5,
    tags: ["Cloven-hoofed animal"],
    cost: 2,
    type: "hCard",
    effect: "",
    bonus: "",
    points: "如果你至少有1只小野猪，获得10分",
  },

  WOLF: {
    name: "狼",
    nb: 4,
    tags: [PAW],
    cost: 3,
    type: "hCard",
    effect: "每有一只鹿获得1张牌",
    bonus: "获得新的回合",
    points: "每张带有鹿符号的牌得5分",
  },

  LINDEN: {
    name: "椴树",
    nb: 9,
    tags: [TREE],
    cost: 1,
    type: 'tree',
    effect: "",
    bonus: "",
    points: "获得1分，若没有其他森林的椴树数量比你多，则改为获得3分",
  },

  OAK: {
    name: "橡树",
    nb: 7,
    tags: [TREE],
    cost: 2,
    type: 'tree',
    effect: "",
    bonus: "获得新的回合",
    points: "如果你集齐所有8种不同的树木，获得10分",
  },

  SILVERFIR: {
    name: "银杉",
    nb: 6,
    tags: [TREE],
    cost: 2,
    type: 'tree',
    effect: "",
    bonus: "免费打出一张带有爪印符号的牌",
    points: "连接到这棵银冷杉的每张牌得2分",
  },

  BIRCH: {
    name: "桦树",
    nb: 10,
    tags: [TREE],
    cost: 0,
    type: 'tree',
    effect: "获得1张牌",
    bonus: "",
    points: "获得1分",
  },

  BEECH: {
    name: "山毛榉",
    nb: 10,
    tags: [TREE],
    cost: 1,
    type: 'tree',
    effect: "获得1张牌",
    bonus: "",
    points: "如果你至少有4棵山毛榉，获得5分",
  },

  SYCAMORE: {
    name: "梧桐",
    nb: 6,
    tags: [TREE],
    cost: 2,
    type: 'tree',
    effect: "",
    bonus: "",
    points: "每张带有树木符号的牌得1分",
  },

  DOUGLASFIR: {
    name: "冷杉",
    nb: 7,
    tags: [TREE],
    cost: 2,
    type: 'tree',
    effect: "",
    bonus: "获得新的回合",
    points: "获得5分",
  },

  HORSECHESTNUT: {
    name: "欧洲七叶树",
    nb: 11,
    tags: [TREE],
    cost: 1,
    type: 'tree',
    effect: "",
    bonus: "",
    points: "根据你拥有的欧洲七叶树数量获得分数",
  },

  HYPSUGOSAVII: {
    name: "萨维伏翼",
    nb: 3,
    tags: [BAT],
    cost: 1,
    type: "hCard",
    effect: "",
    bonus: "",
    points: "如果你有至少3种不同的蝙蝠，获得5分",
  },

  LARIXDECIDUA: {
    name: "欧洲落叶松",
    nb: 7,
    tags: [TREE, MOUNTAIN],
    cost: 1,
    type: 'tree',
    effect: "",
    bonus: "免费打出一张带有高山符号的牌",
    points: "获得3分",
  },

  PINUSCEMBRA: {
    name: "瑞士石松",
    nb: 7,
    tags: [TREE, MOUNTAIN],
    cost: 2,
    type: 'tree',
    effect: "获得1张牌",
    bonus: "获得1张牌",
    points: "每张带有高山符号的牌得1分",
  },

  CRATERELLUSCORNUCOPIODES: {
    name: "灰号角菇",
    nb: 2,
    tags: [MUSHROOM, MOUNTAIN],
    cost: 2,
    type: "vCard",
    effect: "每当你打出一张带有高山符号的牌时，获得1张牌",
    bonus: "",
    points: "",
  },

  PARNASSIUSPHOEBUS: {
    name: "小阿波罗绢蝶",
    nb: 4,
    tags: [BUTTERFLY, MOUNTAIN],
    cost: 0,
    type: "vCard",
    effect: "",
    bonus: "",
    points: "每张不同的蝴蝶牌得1分",
  },

  GENTIANA: {
    name: "龙胆草",
    nb: 3,
    tags: [PLANT, MOUNTAIN],
    cost: 0,
    type: "vCard",
    effect: "免费打出一张带有蝴蝶符号的牌",
    bonus: "",
    points: "每张带有蝴蝶符号的牌得3分",
  },

  VACCINIUMMYRTILLUS: {
    name: "越橘",
    nb: 3,
    tags: [PLANT, MOUNTAIN],
    cost: 1,
    type: "vCard",
    effect: "免费打出一张带有两栖动物符号的牌",
    bonus: "",
    points: "每张不同的鸟类牌得2分",
  },

  ICHTHYOSAURAALPESTRIS: {
    name: "高山欧叶螈",
    nb: 3,
    tags: [AMPHIBIAN, MOUNTAIN],
    cost: 1,
    type: "vCard",
    effect: "",
    bonus: "免费打出一张带有高山符号的牌和一张带有昆虫符号的牌",
    points: "每张带有昆虫符号的牌得2分",
  },

  AQUILACHRYSAETOS: {
    name: "金雕",
    nb: 3,
    tags: [BIRD, MOUNTAIN],
    cost: 1,
    type: "vCard",
    effect: "",
    bonus: "",
    points: "每张带有爪印或两栖动物符号的牌得1分",
  },

  CORVUSCORAX: {
    name: "渡鸦",
    nb: 2,
    tags: [BIRD, MOUNTAIN],
    cost: 1,
    type: "vCard",
    effect: "获得1张牌",
    bonus: "",
    points: "获得5分",
  },

  LEONTOPODIUMNIVALE: {
    name: "高山火绒草",
    nb: 2,
    tags: [PLANT, MOUNTAIN],
    cost: 1,
    type: "vCard",
    effect: "获得1张牌",
    bonus: "获得1张牌",
    points: "获得3分",
  },

  GYPAETUSBARBATUS: {
    name: "胡兀鹫",
    nb: 3,
    tags: [BIRD, MOUNTAIN],
    cost: 1,
    type: "vCard",
    effect: "将空地上的2张牌放入你的洞穴",
    bonus: "",
    points: "你洞穴里的每张牌得1分",
  },

  CAPRAIBEX: {
    name: "羱羊",
    nb: 3,
    tags: ["Cloven-hoofed animal", MOUNTAIN],
    cost: 3,
    type: "hCard",
    effect: "获得新的回合",
    bonus: "",
    points: "获得10分",
  },

  LEPUSTIMIDUS: {
    name: "雪兔",
    nb: 3,
    tags: [PAW, MOUNTAIN],
    cost: 0,
    type: "hCard",
    effect: "被视为一只欧洲野兔",
    bonus: "",
    points: "每有一只欧洲野兔获得1分",
  },

  MARMOTAMARMOTA: {
    name: "高山旱獭",
    nb: 4,
    tags: [PAW, MOUNTAIN],
    cost: 1,
    type: "hCard",
    effect: "该槽位可以容纳任意数量的高山旱獭",
    bonus: "",
    points: "每有一只高山旱獭获得2分",
  },

  RUPICAPRARUPICAPRA: {
    name: "臆羚",
    nb: 3,
    tags: ["Cloven-hoofed animal", MOUNTAIN],
    cost: 1,
    type: "hCard",
    effect: "",
    bonus: "",
    points: "每张不同的植物牌得3分",
  },

  TETRAOUROGALLUS: {
    name: "松鸡",
    nb: 4,
    tags: [BIRD, MOUNTAIN],
    cost: 1,
    type: "hCard",
    effect: "免费打出一张带有植物符号的牌",
    bonus: "",
    points: "每张带有植物符号的牌得1分",
  },

  SAMBUCUS: {
    name: "接骨木",
    nb: 4,
    tags: [EDGE, SHRUB],
    cost: 2,
    type: 'tree',
    effect: "每当你打出一张带有植物符号的牌时，获得1张牌",
    bonus: "免费打出一张带有植物符号的牌",
    points: "",
  },

  COMMONHAZEL: {
    name: "欧榛",
    nb: 4,
    tags: [EDGE, SHRUB],
    cost: 2,
    type: 'tree',
    effect: "每当你打出一张带有蝙蝠符号的牌时，获得1张牌",
    bonus: "免费打出一张带有蝙蝠符号的牌",
    points: "",
  },

  BLACKTHORN: {
    name: "黑刺李",
    nb: 4,
    tags: [EDGE, SHRUB],
    cost: 2,
    type: 'tree',
    effect: "每当你打出一张带有蝴蝶符号的牌时，获得1张牌",
    bonus: "免费打出一张带有蝴蝶符号的牌",
    points: "",
  },

  WILDBOARFEMALE: {
    name: "野猪（雌性）",
    nb: 3,
    tags: [EDGE, CLOVEN],
    cost: 2,
    type: H_CARD,
    effect: "将空地上所有的牌从游戏中移除",
    bonus: "免费打出一只小野猪",
    points: "每有一只小野猪获得10分",
  },

  BEEHIVE: {
    name: "蜂群",
    nb: 3,
    tags: [EDGE, INSECT],
    cost: 1,
    type: H_CARD,
    effect: "将所有带有植物、灌木或树木符号的卡片放进你的洞穴",
    bonus: "",
    points: "每张带有植物符号的卡片得1分",
  },

  EUROPEANBISON: {
    name: "欧洲野牛",
    nb: 3,
    tags: [EDGE, CLOVEN],
    cost: 3,
    type: H_CARD,
    effect: "获得新的回合",
    bonus: "",
    points: "每张带有橡木或山毛榉标志的卡片可获得2分",
  },

  EUROPEANWILDCAT: {
    name: "欧洲野猫",
    nb: 3,
    tags: [EDGE, PAW],
    cost: 1,
    type: H_CARD,
    effect: "从空地中拿一张牌",
    bonus: "",
    points: "每张带有林地边缘符号的牌得1分",
  },

  COMMONPIPISTRELLE: {
    name: "伏翼",
    nb: 3,
    tags: [EDGE, BAT],
    cost: 1,
    type: H_CARD,
    effect: "",
    bonus: "",
    points: "如果你有至少3种不同的蝙蝠，获得5分",
  },

  SQUEAKEREDGE: {
    name: "小野猪",
    nb: 3,
    tags: [EDGE, CLOVEN],
    cost: 0,
    type: H_CARD,
    effect: "",
    bonus: "",
    points: "获得1分",
  },

  MOSQUITO: {
    name: "大蚊",
    nb: 3,
    tags: [EDGE, INSECT],
    cost: 1,
    type: H_CARD,
    effect: "免费打出任意数量的蝙蝠牌",
    bonus: "把所有有蝙蝠符号的牌从空地上拿到手里",
    points: "每张带有蝙蝠符号的牌得1分",
  },

  EUROPEANPOLECAT: {
    name: "欧洲林鼬",
    nb: 3,
    tags: [EDGE, PAW],
    cost: 2,
    type: H_CARD,
    effect: "",
    bonus: "获得新的回合",
    points: "若位于树或灌木上，获得10分",
  },

  MAPBUTTERFLY: {
    name: "盛蛱蝶",
    nb: 4,
    tags: [EDGE, INSECT, BUTTERFLY],
    cost: 0,
    type: V_CARD,
    effect: "",
    bonus: "",
    points: "每张不同的蝴蝶牌得1分",
  },

  DIGITALIS: {
    name: "毛地黄",
    nb: 4,
    tags: [EDGE, PLANT],
    cost: 0,
    type: V_CARD,
    effect: "",
    bonus: "",
    points: "每张不同的植物牌得1分",
  },

  URTICA: {
    name: "荨麻",
    nb: 3,
    tags: [EDGE, PLANT],
    cost: 0,
    type: V_CARD,
    effect: "任何数量的蝴蝶都可以在这棵树或灌木上共享一个槽",
    bonus: "",
    points: "每张带有蝴蝶符号的牌得2分",
  },

  GREATGREENBUSHCRICKET: {
    name: "绿丛螽",
    nb: 3,
    tags: [EDGE, INSECT],
    cost: 1,
    type: V_CARD,
    effect: "免费打出一张带有鸟符号的牌",
    bonus: "",
    points: "每张有昆虫符号的牌得1分",
  },

  EUROPEANWATERVOLE: {
    name: "水田鼠",
    nb: 2,
    tags: [EDGE, PAW],
    cost: 2,
    type: V_CARD,
    effect: "立即打出任意数量的树苗",
    bonus: "获得新的回合",
    points: "",
  },

  EURASIANMAGPIE: {
    name: "欧亚喜鹊",
    nb: 3,
    tags: [EDGE, BIRD],
    cost: 1,
    type: V_CARD,
    effect: "从空地中拿一张牌",
    bonus: "从空地上放两张牌到你的洞穴里",
    points: "获得3分",
  },

  COMMONNIGHTINGALE: {
    name: "夜莺",
    nb: 3,
    tags: [EDGE, BIRD],
    cost: 1,
    type: V_CARD,
    effect: "",
    bonus: "获得新的回合",
    points: "若位于灌木丛上，获得5分",
  },

  BARNOWL: {
    name: "仓鸮",
    nb: 2,
    tags: [EDGE, BIRD],
    cost: 2,
    type: V_CARD,
    effect: "如果你的森林里至少有一只蝙蝠，获得新的回合",
    bonus: "",
    points: "每张带有蝙蝠符号的牌获得3分",
  },
}

let $f = (data) => {
  return {
    type: data[0], // 卡片类型
    species: data[1], // 物种：1个或2个，根据卡片类型确定
    tree_symbol: data[2], // 树木符号
    deck: data[3], // 牌堆
  };
};

// 卡片信息
const CARDS_DATA = {
  // 基础卡
  1: $f([TREE, [LINDEN], [LINDEN], BASIC_DECK]),
  2: $f([TREE, [LINDEN], [LINDEN], BASIC_DECK]),
  3: $f([TREE, [LINDEN], [LINDEN], BASIC_DECK]),
  4: $f([TREE, [LINDEN], [LINDEN], BASIC_DECK]),
  5: $f([TREE, [LINDEN], [LINDEN], BASIC_DECK]),
  6: $f([TREE, [LINDEN], [LINDEN], BASIC_DECK]),
  7: $f([TREE, [LINDEN], [LINDEN], BASIC_DECK]),
  8: $f([TREE, [LINDEN], [LINDEN], BASIC_DECK]),
  9: $f([TREE, [LINDEN], [LINDEN], BASIC_DECK]),
  10: $f([TREE, [OAK], [OAK], BASIC_DECK]),
  11: $f([TREE, [OAK], [OAK], BASIC_DECK]),
  12: $f([TREE, [OAK], [OAK], BASIC_DECK]),
  13: $f([TREE, [OAK], [OAK], BASIC_DECK]),
  14: $f([TREE, [OAK], [OAK], BASIC_DECK]),
  15: $f([TREE, [OAK], [OAK], BASIC_DECK]),
  16: $f([TREE, [OAK], [OAK], BASIC_DECK]),
  17: $f([TREE, [SILVER_FIR], [SILVER_FIR], BASIC_DECK]),
  18: $f([TREE, [SILVER_FIR], [SILVER_FIR], BASIC_DECK]),
  19: $f([TREE, [SILVER_FIR], [SILVER_FIR], BASIC_DECK]),
  20: $f([TREE, [SILVER_FIR], [SILVER_FIR], BASIC_DECK]),
  21: $f([TREE, [SILVER_FIR], [SILVER_FIR], BASIC_DECK]),
  22: $f([TREE, [SILVER_FIR], [SILVER_FIR], BASIC_DECK]),
  23: $f([TREE, [BIRCH], [BIRCH], BASIC_DECK]),
  24: $f([TREE, [BIRCH], [BIRCH], BASIC_DECK]),
  25: $f([TREE, [BIRCH], [BIRCH], BASIC_DECK]),
  26: $f([TREE, [BIRCH], [BIRCH], BASIC_DECK]),
  27: $f([TREE, [BIRCH], [BIRCH], BASIC_DECK]),
  28: $f([TREE, [BIRCH], [BIRCH], BASIC_DECK]),
  29: $f([TREE, [BIRCH], [BIRCH], BASIC_DECK]),
  30: $f([TREE, [BIRCH], [BIRCH], BASIC_DECK]),
  31: $f([TREE, [BIRCH], [BIRCH], BASIC_DECK]),
  32: $f([TREE, [BIRCH], [BIRCH], BASIC_DECK]),
  33: $f([TREE, [BEECH], [BEECH], BASIC_DECK]),
  34: $f([TREE, [BEECH], [BEECH], BASIC_DECK]),
  35: $f([TREE, [BEECH], [BEECH], BASIC_DECK]),
  36: $f([TREE, [BEECH], [BEECH], BASIC_DECK]),
  37: $f([TREE, [BEECH], [BEECH], BASIC_DECK]),
  38: $f([TREE, [BEECH], [BEECH], BASIC_DECK]),
  39: $f([TREE, [BEECH], [BEECH], BASIC_DECK]),
  40: $f([TREE, [BEECH], [BEECH], BASIC_DECK]),
  41: $f([TREE, [BEECH], [BEECH], BASIC_DECK]),
  42: $f([TREE, [BEECH], [BEECH], BASIC_DECK]),
  43: $f([TREE, [SYCAMORE], [SYCAMORE], BASIC_DECK]),
  44: $f([TREE, [SYCAMORE], [SYCAMORE], BASIC_DECK]),
  45: $f([TREE, [SYCAMORE], [SYCAMORE], BASIC_DECK]),
  46: $f([TREE, [SYCAMORE], [SYCAMORE], BASIC_DECK]),
  47: $f([TREE, [SYCAMORE], [SYCAMORE], BASIC_DECK]),
  48: $f([TREE, [SYCAMORE], [SYCAMORE], BASIC_DECK]),
  49: $f([TREE, [DOUGLAS_FIR], [DOUGLAS_FIR], BASIC_DECK]),
  50: $f([TREE, [DOUGLAS_FIR], [DOUGLAS_FIR], BASIC_DECK]),
  51: $f([TREE, [DOUGLAS_FIR], [DOUGLAS_FIR], BASIC_DECK]),
  52: $f([TREE, [DOUGLAS_FIR], [DOUGLAS_FIR], BASIC_DECK]),
  53: $f([TREE, [DOUGLAS_FIR], [DOUGLAS_FIR], BASIC_DECK]),
  54: $f([TREE, [DOUGLAS_FIR], [DOUGLAS_FIR], BASIC_DECK]),
  55: $f([TREE, [DOUGLAS_FIR], [DOUGLAS_FIR], BASIC_DECK]),
  56: $f([TREE, [HORSE_CHESTNUT], [HORSE_CHESTNUT], BASIC_DECK]),
  57: $f([TREE, [HORSE_CHESTNUT], [HORSE_CHESTNUT], BASIC_DECK]),
  58: $f([TREE, [HORSE_CHESTNUT], [HORSE_CHESTNUT], BASIC_DECK]),
  59: $f([TREE, [HORSE_CHESTNUT], [HORSE_CHESTNUT], BASIC_DECK]),
  60: $f([TREE, [HORSE_CHESTNUT], [HORSE_CHESTNUT], BASIC_DECK]),
  61: $f([TREE, [HORSE_CHESTNUT], [HORSE_CHESTNUT], BASIC_DECK]),
  62: $f([TREE, [HORSE_CHESTNUT], [HORSE_CHESTNUT], BASIC_DECK]),
  63: $f([TREE, [HORSE_CHESTNUT], [HORSE_CHESTNUT], BASIC_DECK]),
  64: $f([TREE, [HORSE_CHESTNUT], [HORSE_CHESTNUT], BASIC_DECK]),
  65: $f([TREE, [HORSE_CHESTNUT], [HORSE_CHESTNUT], BASIC_DECK]),
  66: $f([TREE, [HORSE_CHESTNUT], [HORSE_CHESTNUT], BASIC_DECK]),
  67: $f([W_CARD, [''], [''], BASIC_DECK]),
  68: $f([W_CARD, [''], [''], BASIC_DECK]),
  69: $f([W_CARD, [''], [''], BASIC_DECK]),
  70: $f([H_CARD, [EUROPEAN_HARE, EUROPEAN_BADGER], [LINDEN, DOUGLAS_FIR], BASIC_DECK]),
  71: $f([H_CARD, [EUROPEAN_HARE, GREATER_HORSESHOE_BAT], [OAK, LINDEN], BASIC_DECK]),
  72: $f([H_CARD, [EUROPEAN_HARE, RED_FOX], [SILVER_FIR, OAK], BASIC_DECK]),
  73: $f([H_CARD, [RACCOON, EUROPEAN_HARE], [DOUGLAS_FIR, SYCAMORE], BASIC_DECK]),
  74: $f([H_CARD, [WILD_BOAR, EUROPEAN_HARE], [SYCAMORE, SILVER_FIR], BASIC_DECK]),
  75: $f([H_CARD, [BROWN_LONG_EARED_BAT, EUROPEAN_HARE], [SYCAMORE, LINDEN], BASIC_DECK]),
  76: $f([H_CARD, [RACCOON, ROE_DEER], [SILVER_FIR, BEECH], BASIC_DECK]),
  77: $f([H_CARD, [BROWN_LONG_EARED_BAT, EUROPEAN_BADGER], [SYCAMORE, DOUGLAS_FIR], BASIC_DECK]),
  78: $f([H_CARD, [BARBASTELLE_BAT, WILD_BOAR], [HORSE_CHESTNUT, OAK], BASIC_DECK]),
  79: $f([H_CARD, [BROWN_BEAR, RACCOON], [LINDEN, SILVER_FIR], BASIC_DECK]),
  80: $f([H_CARD, [BEECH_MARTEN, BROWN_BEAR], [SYCAMORE, HORSE_CHESTNUT], BASIC_DECK]),
  81: $f([H_CARD, [RED_DEER, BROWN_BEAR], [LINDEN, BEECH], BASIC_DECK]),
  82: $f([H_CARD, [BARBASTELLE_BAT, BEECH_MARTEN], [SILVER_FIR, HORSE_CHESTNUT], BASIC_DECK]),
  83: $f([H_CARD, [LYNX, EUROPEAN_HARE], [DOUGLAS_FIR, BIRCH], BASIC_DECK]),
  84: $f([H_CARD, [WILD_BOAR, BEECH_MARTEN], [BIRCH, OAK], BASIC_DECK]),
  85: $f([H_CARD, [EUROPEAN_BADGER, GNAT], [HORSE_CHESTNUT, OAK], BASIC_DECK]),
  86: $f([H_CARD, [RED_FOX, VIOLET_CARPENTER_BEE], [LINDEN, DOUGLAS_FIR], BASIC_DECK]),
  87: $f([H_CARD, [WILD_BOAR, ROE_DEER], [SYCAMORE, HORSE_CHESTNUT], BASIC_DECK]),
  88: $f([H_CARD, [FALLOW_DEER, WILD_BOAR], [LINDEN, DOUGLAS_FIR], BASIC_DECK]),
  89: $f([H_CARD, [FALLOW_DEER, ROE_DEER], [LINDEN, BIRCH], BASIC_DECK]),
  90: $f([H_CARD, [RED_DEER, FALLOW_DEER], [SILVER_FIR, SYCAMORE], BASIC_DECK]),
  91: $f([H_CARD, [VIOLET_CARPENTER_BEE, LYNX], [DOUGLAS_FIR, BEECH], BASIC_DECK]),
  92: $f([H_CARD, [EUROPEAN_FAT_DORMOUSE, BARBASTELLE_BAT], [BEECH, OAK], BASIC_DECK]),
  93: $f([H_CARD, [GREATER_HORSESHOE_BAT, EUROPEAN_FAT_DORMOUSE], [BEECH, DOUGLAS_FIR], BASIC_DECK]),
  94: $f([H_CARD, [RED_FOX, WOLF], [LINDEN, SILVER_FIR], BASIC_DECK]),
  95: $f([H_CARD, [EUROPEAN_FAT_DORMOUSE, BROWN_LONG_EARED_BAT], [SILVER_FIR, BEECH], BASIC_DECK]),
  96: $f([H_CARD, [BECHSTEIN, EUROPEAN_FAT_DORMOUSE], [BEECH, OAK], BASIC_DECK]),
  97: $f([H_CARD, [GNAT, VIOLET_CARPENTER_BEE], [BIRCH, DOUGLAS_FIR], BASIC_DECK]),
  98: $f([H_CARD, [WOLF, GNAT], [DOUGLAS_FIR, HORSE_CHESTNUT], BASIC_DECK]),
  99: $f([H_CARD, [ROE_DEER, SQUEAKER], [LINDEN, SYCAMORE], BASIC_DECK]),
  100: $f([H_CARD, [BECHSTEIN, WOLF], [OAK, SILVER_FIR], BASIC_DECK]),
  101: $f([H_CARD, [ROE_DEER, LYNX], [SILVER_FIR, LINDEN], BASIC_DECK]),
  102: $f([H_CARD, [BEECH_MARTEN, BECHSTEIN], [BEECH, BIRCH], BASIC_DECK]),
  103: $f([H_CARD, [EUROPEAN_HARE, RED_DEER], [BEECH, HORSE_CHESTNUT], BASIC_DECK]),
  104: $f([H_CARD, [WOLF, GREATER_HORSESHOE_BAT], [SYCAMORE, LINDEN], BASIC_DECK]),
  105: $f([H_CARD, [SQUEAKER, RED_DEER], [HORSE_CHESTNUT, OAK], BASIC_DECK]),
  106: $f([H_CARD, [RED_FOX, SQUEAKER], [BEECH, OAK], BASIC_DECK]),
  107: $f([H_CARD, [LYNX, RACCOON], [DOUGLAS_FIR, BIRCH], BASIC_DECK]),
  108: $f([H_CARD, [SQUEAKER, LYNX], [OAK, SILVER_FIR], BASIC_DECK]),
  109: $f([H_CARD, [EUROPEAN_HARE, BEECH_MARTEN], [BIRCH, HORSE_CHESTNUT], BASIC_DECK]),
  110: $f([H_CARD, [LYNX, RED_FOX], [HORSE_CHESTNUT, DOUGLAS_FIR], BASIC_DECK]),
  111: $f([H_CARD, [EUROPEAN_HARE, RED_DEER], [BIRCH, HORSE_CHESTNUT], BASIC_DECK]),
  112: $f([H_CARD, [VIOLET_CARPENTER_BEE, EUROPEAN_HARE], [SILVER_FIR, SYCAMORE], BASIC_DECK]),
  113: $f([H_CARD, [EUROPEAN_BADGER, FALLOW_DEER], [HORSE_CHESTNUT, BIRCH], BASIC_DECK]),
  114: $f([V_CARD, [GOSHAWK, MOSS], [DOUGLAS_FIR, LINDEN], BASIC_DECK]),
  115: $f([V_CARD, [GREAT_SPOTTED_WOODPECKER, WOOD_ANT], [LINDEN, BIRCH], BASIC_DECK]),
  116: $f([V_CARD, [CHAFFINCH, WOOD_ANT], [BIRCH, BEECH], BASIC_DECK]),
  117: $f([V_CARD, [TAWNY_OWL, STAG_BEETLE], [BEECH, SYCAMORE], BASIC_DECK]),
  118: $f([V_CARD, [SILVER_WASHED_FRITILLARY, FIRE_SALAMANDER], [OAK, HORSE_CHESTNUT], BASIC_DECK]),
  119: $f([V_CARD, [PURPLE_EMPEROR, POND_TURTLE], [HORSE_CHESTNUT, SYCAMORE], BASIC_DECK]),
  120: $f([V_CARD, [CAMBERWELL_BEAUTY, POND_TURTLE], [SYCAMORE, BIRCH], BASIC_DECK]),
  121: $f([V_CARD, [LARGE_TORTOISESHELL, FIRE_SALAMANDER], [SILVER_FIR, DOUGLAS_FIR], BASIC_DECK]),
  122: $f([V_CARD, [BULLFINCH, TREE_FROG], [DOUGLAS_FIR, LINDEN], BASIC_DECK]),
  123: $f([V_CARD, [CHAFFINCH, STAG_BEETLE], [SYCAMORE, BIRCH], BASIC_DECK]),
  124: $f([V_CARD, [GOSHAWK, WOOD_ANT], [SILVER_FIR, BEECH], BASIC_DECK]),
  125: $f([V_CARD, [GREAT_SPOTTED_WOODPECKER, COMMON_TOAD], [LINDEN, OAK], BASIC_DECK]),
  126: $f([V_CARD, [EURASIAN_JAY, TREE_FERNS], [BIRCH, HORSE_CHESTNUT], BASIC_DECK]),
  127: $f([V_CARD, [TAWNY_OWL, WILD_STRAWBERRIES], [BEECH, SYCAMORE], BASIC_DECK]),
  128: $f([V_CARD, [SILVER_WASHED_FRITILLARY, BLACKBERRIES], [OAK, SILVER_FIR], BASIC_DECK]),
  129: $f([V_CARD, [PURPLE_EMPEROR, MOSS], [HORSE_CHESTNUT, DOUGLAS_FIR], BASIC_DECK]),
  130: $f([V_CARD, [CAMBERWELL_BEAUTY, FIREFLIES], [SYCAMORE, LINDEN], BASIC_DECK]),
  131: $f([V_CARD, [LARGE_TORTOISESHELL, BLACKBERRIES], [SILVER_FIR, BIRCH], BASIC_DECK]),
  132: $f([V_CARD, [BULLFINCH, HEDGEHOG], [DOUGLAS_FIR, BEECH], BASIC_DECK]),
  133: $f([V_CARD, [PEACOCK_BUTTERFLY, HEDGEHOG], [SILVER_FIR, OAK], BASIC_DECK]),
  134: $f([V_CARD, [RED_SQUIRREL, COMMON_TOAD], [DOUGLAS_FIR, HORSE_CHESTNUT], BASIC_DECK]),
  135: $f([V_CARD, [RED_SQUIRREL, FIREFLIES], [HORSE_CHESTNUT, SYCAMORE], BASIC_DECK]),
  136: $f([V_CARD, [CHAFFINCH, COMMON_TOAD], [BEECH, SILVER_FIR], BASIC_DECK]),
  137: $f([V_CARD, [EURASIAN_JAY, FIREFLIES], [BIRCH, DOUGLAS_FIR], BASIC_DECK]),
  138: $f([V_CARD, [SILVER_WASHED_FRITILLARY, MOSS], [BEECH, LINDEN], BASIC_DECK]),
  139: $f([V_CARD, [PEACOCK_BUTTERFLY, CHANTERELLE], [OAK, SILVER_FIR], BASIC_DECK]),
  140: $f([V_CARD, [PEACOCK_BUTTERFLY, FIREFLIES], [HORSE_CHESTNUT, BEECH], BASIC_DECK]),
  141: $f([V_CARD, [LARGE_TORTOISESHELL, MOLE], [SYCAMORE, OAK], BASIC_DECK]),
  142: $f([V_CARD, [GOSHAWK, HEDGEHOG], [SILVER_FIR, HORSE_CHESTNUT], BASIC_DECK]),
  143: $f([V_CARD, [GREAT_SPOTTED_WOODPECKER, WILD_STRAWBERRIES], [DOUGLAS_FIR, SYCAMORE], BASIC_DECK]),
  144: $f([V_CARD, [EURASIAN_JAY, FLY_AGARIC], [SYCAMORE, SILVER_FIR], BASIC_DECK]),
  145: $f([V_CARD, [TAWNY_OWL, PENNY_BUN], [BIRCH, DOUGLAS_FIR], BASIC_DECK]),
  146: $f([V_CARD, [RED_SQUIRREL, FIRE_SALAMANDER], [BEECH, LINDEN], BASIC_DECK]),
  147: $f([V_CARD, [PURPLE_EMPEROR, TREE_FROG], [BIRCH, OAK], BASIC_DECK]),
  148: $f([V_CARD, [PEACOCK_BUTTERFLY, COMMON_TOAD], [LINDEN, BEECH], BASIC_DECK]),
  149: $f([V_CARD, [CAMBERWELL_BEAUTY, TREE_FROG], [BIRCH, OAK], BASIC_DECK]),
  150: $f([V_CARD, [BULLFINCH, PARASOL_MUSHROOM], [DOUGLAS_FIR, HORSE_CHESTNUT], BASIC_DECK]),
  151: $f([V_CARD, [GOSHAWK, COMMON_TOAD], [OAK, SYCAMORE], BASIC_DECK]),
  152: $f([V_CARD, [EURASIAN_JAY, TREE_FERNS], [HORSE_CHESTNUT, SILVER_FIR], BASIC_DECK]),
  153: $f([V_CARD, [TAWNY_OWL, COMMON_TOAD], [SYCAMORE, DOUGLAS_FIR], BASIC_DECK]),
  154: $f([V_CARD, [BULLFINCH, TREE_FERNS], [SILVER_FIR, LINDEN], BASIC_DECK]),
  155: $f([V_CARD, [RED_SQUIRREL, WILD_STRAWBERRIES], [OAK, BIRCH], BASIC_DECK]),
  156: $f([V_CARD, [SILVER_WASHED_FRITILLARY, BLACKBERRIES], [OAK, BEECH], BASIC_DECK]),
  157: $f([V_CARD, [PURPLE_EMPEROR, FLY_AGARIC], [LINDEN, OAK], BASIC_DECK]),
  158: $f([V_CARD, [CAMBERWELL_BEAUTY, CHANTERELLE], [HORSE_CHESTNUT, BIRCH], BASIC_DECK]),
  159: $f([V_CARD, [LARGE_TORTOISESHELL, MOLE], [BEECH, SYCAMORE], BASIC_DECK]),
  160: $f([V_CARD, [CHAFFINCH, PARASOL_MUSHROOM], [SYCAMORE, SILVER_FIR], BASIC_DECK]),
  161: $f([V_CARD, [GREAT_SPOTTED_WOODPECKER, PENNY_BUN], [LINDEN, DOUGLAS_FIR], BASIC_DECK]),
  // 阿尔卑斯扩展
  162: $f([TREE, [LARIX_DECIDUA], [LARIX], ALPINE_DECK]),
  163: $f([TREE, [LARIX_DECIDUA], [LARIX], ALPINE_DECK]),
  164: $f([TREE, [LARIX_DECIDUA], [LARIX], ALPINE_DECK]),
  165: $f([TREE, [LARIX_DECIDUA], [LARIX], ALPINE_DECK]),
  166: $f([TREE, [LARIX_DECIDUA], [LARIX], ALPINE_DECK]),
  167: $f([TREE, [LARIX_DECIDUA], [LARIX], ALPINE_DECK]),
  168: $f([TREE, [LARIX_DECIDUA], [LARIX], ALPINE_DECK]),
  169: $f([TREE, [PINUS_CEMBRA], [PINUS], ALPINE_DECK]),
  170: $f([TREE, [PINUS_CEMBRA], [PINUS], ALPINE_DECK]),
  171: $f([TREE, [PINUS_CEMBRA], [PINUS], ALPINE_DECK]),
  172: $f([TREE, [PINUS_CEMBRA], [PINUS], ALPINE_DECK]),
  173: $f([TREE, [PINUS_CEMBRA], [PINUS], ALPINE_DECK]),
  174: $f([TREE, [PINUS_CEMBRA], [PINUS], ALPINE_DECK]),
  175: $f([TREE, [PINUS_CEMBRA], [PINUS], ALPINE_DECK]),
  176: $f([H_CARD, [MARMOTA_MARMOTA, RUPICAPRA_RUPICAPRA], [BEECH, PINUS], ALPINE_DECK]),
  177: $f([H_CARD, [MARMOTA_MARMOTA, TETRAO_UROGALLUS], [LARIX, DOUGLAS_FIR], ALPINE_DECK]),
  178: $f([H_CARD, [LEPUS_TIMIDUS, MARMOTA_MARMOTA], [SILVER_FIR, PINUS], ALPINE_DECK]),
  179: $f([H_CARD, [CAPRA_IBEX, MARMOTA_MARMOTA], [LARIX, BIRCH], ALPINE_DECK]),
  180: $f([H_CARD, [RUPICAPRA_RUPICAPRA, TETRAO_UROGALLUS], [LARIX, BEECH], ALPINE_DECK]),
  181: $f([H_CARD, [LEPUS_TIMIDUS, RUPICAPRA_RUPICAPRA], [LARIX, DOUGLAS_FIR], ALPINE_DECK]),
  182: $f([H_CARD, [HYPSUGO_SAVII, CAPRA_IBEX], [SILVER_FIR, PINUS], ALPINE_DECK]),
  183: $f([H_CARD, [TETRAO_UROGALLUS, HYPSUGO_SAVII], [LARIX, PINUS], ALPINE_DECK]),
  184: $f([H_CARD, [TETRAO_UROGALLUS, CAPRA_IBEX], [PINUS, DOUGLAS_FIR], ALPINE_DECK]),
  185: $f([V_CARD, [PARNASSIUS_PHOEBUS, CRATERELLUS_CORNUCOPIODES], [PINUS, LARIX], ALPINE_DECK]),
  186: $f([V_CARD, [PARNASSIUS_PHOEBUS, LEONTOPODIUM_NIVALE], [DOUGLAS_FIR, PINUS], ALPINE_DECK]),
  187: $f([V_CARD, [PARNASSIUS_PHOEBUS, VACCINIUM_MYRTILLUS], [LARIX, BIRCH], ALPINE_DECK]),
  188: $f([V_CARD, [PARNASSIUS_PHOEBUS, ICHTHYOSAURA_ALPESTRIS], [SILVER_FIR, PINUS], ALPINE_DECK]),
  189: $f([V_CARD, [AQUILA_CHRYSAETOS, CRATERELLUS_CORNUCOPIODES], [BEECH, PINUS], ALPINE_DECK]),
  190: $f([V_CARD, [GYPAETUS_BARBATUS, GENTIANA], [SILVER_FIR, LARIX], ALPINE_DECK]),
  191: $f([V_CARD, [AQUILA_CHRYSAETOS, ICHTHYOSAURA_ALPESTRIS], [LARIX, DOUGLAS_FIR], ALPINE_DECK]),
  192: $f([V_CARD, [CORVUS_CORAX, GENTIANA], [LARIX, BEECH], ALPINE_DECK]),
  193: $f([V_CARD, [CORVUS_CORAX, VACCINIUM_MYRTILLUS], [DOUGLAS_FIR, PINUS], ALPINE_DECK]),
  194: $f([V_CARD, [GYPAETUS_BARBATUS, ICHTHYOSAURA_ALPESTRIS], [LARIX, SILVER_FIR], ALPINE_DECK]),
  195: $f([V_CARD, [GYPAETUS_BARBATUS, LEONTOPODIUM_NIVALE], [PINUS, LARIX], ALPINE_DECK]),
  196: $f([V_CARD, [AQUILA_CHRYSAETOS, GENTIANA], [SILVER_FIR, PINUS], ALPINE_DECK]),
  197: $f([H_CARD, [HYPSUGO_SAVII, LEPUS_TIMIDUS], [LARIX, PINUS], ALPINE_DECK]),
  // 林缘扩展
  198: $f([TREE, [SAMBUCUS], [LINDEN], EDGE_DECK]),
  199: $f([TREE, [SAMBUCUS], [SYCAMORE], EDGE_DECK]),
  200: $f([TREE, [SAMBUCUS], [BIRCH], EDGE_DECK]),
  201: $f([TREE, [SAMBUCUS], [OAK], EDGE_DECK]),
  202: $f([TREE, [COMMON_HAZEL], [HORSE_CHESTNUT], EDGE_DECK]),
  203: $f([TREE, [COMMON_HAZEL], [OAK], EDGE_DECK]),
  204: $f([TREE, [COMMON_HAZEL], [BEECH], EDGE_DECK]),
  205: $f([TREE, [COMMON_HAZEL], [BIRCH], EDGE_DECK]),
  206: $f([TREE, [BLACKTHORN], [DOUGLAS_FIR], EDGE_DECK]),
  207: $f([TREE, [BLACKTHORN], [BIRCH], EDGE_DECK]),
  208: $f([TREE, [BLACKTHORN], [SILVER_FIR], EDGE_DECK]),
  209: $f([TREE, [BLACKTHORN], [SYCAMORE], EDGE_DECK]),
  210: $f([V_CARD, [MAP_BUTTERFLY, DIGITALIS], [LINDEN, DOUGLAS_FIR], EDGE_DECK]),
  211: $f([V_CARD, [MAP_BUTTERFLY, URTICA], [SYCAMORE, BIRCH], EDGE_DECK]),
  212: $f([V_CARD, [MAP_BUTTERFLY, GREAT_GREEN_BUSH_CRICKET], [OAK, SILVER_FIR], EDGE_DECK]),
  213: $f([V_CARD, [MAP_BUTTERFLY, EUROPEAN_WATER_VOLE], [SILVER_FIR, SYCAMORE], EDGE_DECK]),
  214: $f([V_CARD, [EURASIAN_MAGPIE, DIGITALIS], [BEECH, BIRCH], EDGE_DECK]),
  215: $f([V_CARD, [EURASIAN_MAGPIE, URTICA], [SILVER_FIR, HORSE_CHESTNUT], EDGE_DECK]),
  216: $f([V_CARD, [EURASIAN_MAGPIE, GREAT_GREEN_BUSH_CRICKET], [BIRCH, BEECH], EDGE_DECK]),
  217: $f([V_CARD, [COMMON_NIGHTINGALE, DIGITALIS], [BEECH, SYCAMORE], EDGE_DECK]),
  218: $f([V_CARD, [COMMON_NIGHTINGALE, URTICA], [OAK, SYCAMORE], EDGE_DECK]),
  219: $f([V_CARD, [COMMON_NIGHTINGALE, EUROPEAN_WATER_VOLE], [HORSE_CHESTNUT, BEECH], EDGE_DECK]),
  220: $f([V_CARD, [BARN_OWL, DIGITALIS], [BIRCH, OAK], EDGE_DECK]),
  221: $f([V_CARD, [BARN_OWL, GREAT_GREEN_BUSH_CRICKET], [SYCAMORE, OAK], EDGE_DECK]),
  222: $f([H_CARD, [WILD_BOAR_FEMALE_, BEEHIVE], [BIRCH, SYCAMORE], EDGE_DECK]),
  223: $f([H_CARD, [EUROPEAN_BISON, WILD_BOAR_FEMALE_], [OAK, SYCAMORE], EDGE_DECK]),
  224: $f([H_CARD, [WILD_BOAR_FEMALE_, EUROPEAN_WILDCAT], [SILVER_FIR, HORSE_CHESTNUT], EDGE_DECK]),
  225: $f([H_CARD, [COMMON_PIPISTRELLE, SQUEAKER], [LINDEN, SILVER_FIR], EDGE_DECK]),
  226: $f([H_CARD, [SQUEAKER, MOSQUITO], [HORSE_CHESTNUT, BEECH], EDGE_DECK]),
  227: $f([H_CARD, [EUROPEAN_POLECAT, SQUEAKER], [SILVER_FIR, DOUGLAS_FIR], EDGE_DECK]),
  228: $f([H_CARD, [BEEHIVE, COMMON_PIPISTRELLE], [BEECH, SYCAMORE], EDGE_DECK]),
  229: $f([H_CARD, [EUROPEAN_WILDCAT, BEEHIVE], [OAK, BIRCH], EDGE_DECK]),
  230: $f([H_CARD, [COMMON_PIPISTRELLE, EUROPEAN_BISON], [BIRCH, BEECH], EDGE_DECK]),
  231: $f([H_CARD, [EUROPEAN_BISON, EUROPEAN_POLECAT], [BEECH, SYCAMORE], EDGE_DECK]),
  232: $f([H_CARD, [MOSQUITO, EUROPEAN_POLECAT], [BIRCH, OAK], EDGE_DECK]),
  233: $f([H_CARD, [EUROPEAN_WILDCAT, MOSQUITO], [SYCAMORE, OAK], EDGE_DECK]),
};

// 获取卡片视图
const getCardVisual = (card) => {
  if (!card) return { bgImg: "", bgSize: "0 0", cssClass: "" };
  const deck = card.deck;
  const type = card.type;
  let img = "";
  let cols = 1;
  let rows = 1;


  if (deck === ALPINE_DECK) {
    img = imgUrl[MOUNTAIN]; // 阿尔卑斯扩展
    cols = 7;
    rows = 4;
  } else if (deck === EDGE_DECK) { // 林缘扩展
    img = imgUrl[W_CARD];
    cols = 6;
    rows = 6;
  } else { // 基础班
    if (type === TREE || type === W_CARD) {
      img = imgUrl[TREE];
      cols = 5;
      rows = 5;
    } else if (type === H_CARD) {
      img = imgUrl[H_CARD];
      cols = 7;
      rows = 7;
    } else if (type === V_CARD) {
      img = imgUrl[V_CARD];
      cols = 7;
      rows = 7;
    } else {
      img = imgUrl[TREE];
      cols = 5;
      rows = 5;
    }
  }
  const cssClass = card.id ? `card-${card.id}` : "";

  return {
    bgImg: img, // 图片链接
    bgSize: `${cols * 100}% ${rows * 100}%`, // 图片大小
    cssClass, // CSS定位
  };
};

// 获取树苗视图
const getSaplingVisual = () => {
  const img = imgUrl[V_CARD];
  const cols = 7;
  const rows = 7;
  return {
    bgImg: img,
    bgSize: `${cols * 100}% ${rows * 100}%`,
    bgPosition: "100% 100%",
  };
};

// 导出常量以便其他模块使用
module.exports = {
  CARDS_DATA,
  TREE,
  H_CARD,
  V_CARD,
  W_CARD,
  SPECIES_DATA,
  getCardVisual,
  getSaplingVisual,
};
