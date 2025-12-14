const cardData = [
  {
    id: '101',
    split: true,
    top: {
      name: '黑榆蛱蝶',
      cost: 0,
      type: 'butterfly',
      tags: ['insect', 'butterfly'],
      effect: '不同的蝴蝶: 1➜0, 2➜3, 3➜6, 4➜12, 5➜20, 6➜35, 7➜55'
    },
    bottom: {
      name: '鼹鼠',
      cost: 2,
      type: 'paw',
      tags: ['paw'],
      effect: '支付费用并打出任意数量的牌'
    }
  },
  {
    id: '102',
    split: true,
    top: {
      name: '黄缘蛱蝶',
      cost: 0,
      type: 'butterfly',
      tags: ['insect', 'butterfly'],
      effect: '不同的蝴蝶: 1➜0, 2➜3, 3➜6, 4➜12, 5➜20, 6➜35, 7➜55'
    },
    bottom: {
      name: '鸡油菌',
      cost: 2,
      type: 'mushroom',
      tags: ['mushroom'],
      effect: '每当你打出一张包含此图标 [Plant] 的卡牌时: 1分'
    }
  },
  {
    id: '103',
    split: true,
    top: {
      name: '紫闪蛱蝶',
      cost: 0,
      type: 'butterfly',
      tags: ['insect', 'butterfly'],
      effect: '不同的蝴蝶: 1➜0, 2➜3, 3➜6, 4➜12, 5➜20, 6➜35, 7➜55'
    },
    bottom: {
      name: '毒蝇伞',
      cost: 2,
      type: 'mushroom',
      tags: ['mushroom'],
      effect: '每当你打出一张包含此图标 [Paw] 的卡牌时: 1分'
    }
  },
  {
    id: '104',
    split: true,
    top: {
      name: '绿豹蛱蝶',
      cost: 0,
      type: 'butterfly',
      tags: ['insect', 'butterfly'],
      effect: '不同的蝴蝶: 1➜0, 2➜3, 3➜6, 4➜12, 5➜20, 6➜35, 7➜55'
    },
    bottom: {
      name: '黑莓',
      cost: 0,
      type: 'plant',
      tags: ['plant'],
      effect: '2 [Acorn] x [Plant]'
    }
  },
  {
    id: '105',
    split: true,
    top: {
      name: '松鼠',
      cost: 0,
      type: 'paw',
      tags: ['paw'],
      effect: '当它在 橡树 上时: 5 [Acorn]'
    },
    bottom: {
      name: '野草莓',
      cost: 0,
      type: 'plant',
      tags: ['plant'],
      effect: '10 [Acorn] 如果你的森林内有 8 种不同的树'
    }
  },
  {
    id: '106',
    split: true,
    top: {
      name: '红腹灰雀',
      cost: 1,
      type: 'bird',
      tags: ['bird'],
      effect: '2 [Acorn] x [Insect]'
    },
    bottom: {
      name: '树蕨',
      cost: 1,
      type: 'plant',
      tags: ['plant'],
      effect: '1 分 | 6 [Acorn] x [Hare]'
    }
  }
];

module.exports = {
  cardData
};
