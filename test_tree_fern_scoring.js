// 测试树蕨计分是否正确处理堆叠卡片
const { precalculateStats } = require('./miniprogram/utils/score/helpers');
const { TAGS } = require('./miniprogram/data/constants');

// 模拟森林: 1只树蛙(无堆叠) + 3只火蝾螈(堆叠)
const testContext = {
  forest: [
    {
      center: { uid: 'tree1', name: '橡树', tags: ['树'] },
      slots: {
        top: { uid: 'frog1', name: '树蛙', tags: [TAGS.AMPHIBIAN] },
        bottom: null,
        left: null,
        right: null
      }
    },
    {
      center: { uid: 'tree2', name: '山毛榉', tags: ['树'] },
      slots: {
        top: {
          uid: 'salamander2',
          name: '火蝾螈',
          tags: [TAGS.AMPHIBIAN],
          list: [
            { uid: 'salamander1', name: '火蝾螈', tags: [TAGS.AMPHIBIAN] },
            { uid: 'salamander2', name: '火蝾螈', tags: [TAGS.AMPHIBIAN] },
            { uid: 'salamander3', name: '火蝾螈', tags: [TAGS.AMPHIBIAN] }
          ],
          max: 99
        },
        bottom: null,
        left: null,
        right: null
      }
    }
  ]
};

const stats = precalculateStats(testContext);
const amphibianCount = stats.tagCounts[TAGS.AMPHIBIAN] || 0;

console.log('预期: 4只两栖动物');
console.log('实际:', amphibianCount, '只两栖动物');
console.log(amphibianCount === 4 ? '✅ 通过' : '❌ 失败');
