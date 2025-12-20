// 测试 CAVE_COUNT 得分计算
// 运行方式: node test_cave_count.js

const { calculateCardScore } = require('./miniprogram/utils/score/index.js');
const { SCORING_TYPES } = require('./miniprogram/data/enums.js');

// 模拟胡兀鹫卡牌
const beardedVultureCard = {
  name: '胡兀鹫',
  uid: 'test_vulture_1',
  scoreConfig: {
    type: SCORING_TYPES.CAVE_COUNT,
    value: 1
  }
};

// 测试场景 1: 洞穴中有 3 张卡牌
console.log('\n=== 测试场景 1: 洞穴中有 3 张卡牌 ===');
const context1 = {
  hand: [],
  forest: [{
    center: beardedVultureCard,
    slots: { top: null, bottom: null, left: null, right: null }
  }],
  cave: [
    { id: 'card1', uid: 'cave_1' },
    { id: 'card2', uid: 'cave_2' },
    { id: 'card3', uid: 'cave_3' }
  ]
};

const score1 = calculateCardScore(beardedVultureCard, context1, null, 'player1', null);
console.log('预期得分: 3');
console.log('实际得分:', score1);
console.log('测试结果:', score1 === 3 ? '✅ 通过' : '❌ 失败');

// 测试场景 2: 洞穴为空
console.log('\n=== 测试场景 2: 洞穴为空 ===');
const context2 = {
  hand: [],
  forest: [{
    center: beardedVultureCard,
    slots: { top: null, bottom: null, left: null, right: null }
  }],
  cave: []
};

const score2 = calculateCardScore(beardedVultureCard, context2, null, 'player1', null);
console.log('预期得分: 0');
console.log('实际得分:', score2);
console.log('测试结果:', score2 === 0 ? '✅ 通过' : '❌ 失败');

// 测试场景 3: cave 字段不存在
console.log('\n=== 测试场景 3: cave 字段不存在 ===');
const context3 = {
  hand: [],
  forest: [{
    center: beardedVultureCard,
    slots: { top: null, bottom: null, left: null, right: null }
  }]
  // 注意：没有 cave 字段
};

const score3 = calculateCardScore(beardedVultureCard, context3, null, 'player1', null);
console.log('预期得分: 0');
console.log('实际得分:', score3);
console.log('测试结果:', score3 === 0 ? '✅ 通过' : '❌ 失败');

console.log('\n=== 测试完成 ===\n');
