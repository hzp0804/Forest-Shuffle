const { calculateTotalScore } = require('./miniprogram/utils/score');
const { calculateEffect, calculateTriggerEffects } = require('./miniprogram/utils/reward');
const { SCORING_TYPES, EFFECT_TYPES } = require('./miniprogram/data/enums');
const { TAGS } = require('./miniprogram/data/constants');

// --- MOCK DATA ---
const TREE_OAK = { uid: 't1', name: 'Oak', tags: [TAGS.TREE], scoreConfig: { type: SCORING_TYPES.FLAT, value: 0 } };
const ANIMAL_DEER = { uid: 'a1', name: 'Deer', tags: [TAGS.DEER], scoreConfig: { type: SCORING_TYPES.PER_TAG, tag: TAGS.TREE, value: 1 } };
const BEE_PURPLE = { uid: 'i1', name: 'Violet Carpenter Bee', tags: [TAGS.INSECT], effectConfig: { type: 'TREE_MULTIPLIER' } };

const p1Forest = [
  { center: TREE_OAK, slots: { right: BEE_PURPLE, left: ANIMAL_DEER } }, // 算2棵
  { center: { ...TREE_OAK, uid: 't2' }, slots: {} }, // 算1棵
  { center: { ...TREE_OAK, uid: 't3' }, slots: {} }  // 算1棵
];
const p1State = { forest: p1Forest, cave: [] };

const p2Forest = [
  { center: { ...TREE_OAK, uid: 'p2_t1' }, slots: {} },
  { center: { ...TREE_OAK, uid: 'p2_t2' }, slots: {} }
];
const p2State = { forest: p2Forest, cave: [] };

const allPlayerStates = { 'p1': p1State, 'p2': p2State };

console.log('DEBUG: TAGS.TREE =', TAGS.TREE);
console.log('DEBUG: Oak Tags =', TREE_OAK.tags);
console.log('DEBUG: Deer Config Tag =', ANIMAL_DEER.scoreConfig.tag);

// --- TEST 1 ---
const s1 = calculateTotalScore(p1State, 'p1', allPlayerStates);
console.log('DEBUG: s1 result =', JSON.stringify(s1, null, 2));

if (s1.breakdown['Deer'] === 4) console.log('[PASS] Test 1: Deer Score (Multiplier)');
else console.log(`[FAIL] Test 1: Expected 4, got ${s1.breakdown['Deer']}`);

// --- TEST 2 ---
const LINDEN = { uid: 'l1', name: 'Linden', tags: [TAGS.TREE], scoreConfig: { type: SCORING_TYPES.MAJORITY, tag: TAGS.TREE, value: 3, valueOnFail: 0 } };
p1State.forest.push({ center: LINDEN, slots: {} }); // P1 now has 5 trees
p2State.forest.push({ center: { ...LINDEN, uid: 'p2_l1' }, slots: {} }); // P2 now has 3 trees

const s1_maj = calculateTotalScore(p1State, 'p1', allPlayerStates);
const s2_maj = calculateTotalScore(p2State, 'p2', allPlayerStates);

if (s1_maj.breakdown['Linden'] === 3) console.log('[PASS] Test 2a: P1 wins Majority');
else console.log(`[FAIL] Test 2a: Expected 3, got ${s1_maj.breakdown['Linden']}`);

if (s2_maj.breakdown['Linden'] === 0) console.log('[PASS] Test 2b: P2 loses Majority');
else console.log(`[FAIL] Test 2b: Expected 0, got ${s2_maj.breakdown['Linden']}`);

// --- TEST 3 ---
const CHANTERELLE = { uid: 'm1', effectConfig: { type: EFFECT_TYPES.TRIGGER_ON_PLAY, tag: TAGS.TREE, reward: { type: 'DRAW', value: 1 } } };
p1State.forest[0].slots.bottom = CHANTERELLE;
const res = calculateTriggerEffects(p1State.forest, { tags: [TAGS.TREE] }, {});
if (res.drawCount === 1) console.log('[PASS] Test 3: Trigger');
else console.log(`[FAIL] Test 3: Expected 1, got ${res.drawCount}`);

// --- TEST 4 ---
const OWL = { effectConfig: { type: EFFECT_TYPES.CONDITION_EXTRATURN, tag: TAGS.BAT } };
const resOwl = calculateEffect(OWL, { forest: [{ slots: { top: { tags: [TAGS.BAT] } } }] });
if (resOwl.extraTurn) console.log('[PASS] Test 4: Extra Turn');
else console.log('[FAIL] Test 4: No Extra Turn');
