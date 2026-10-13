const test = require('node:test'); const assert = require('node:assert');
const C = require('../coach-core.js');
test('normalizes case, punctuation, numbers, contractions', () => {
  assert.deepStrictEqual(C.normWords("Hello, World! I'm 25."), ['hello','world','i','am','twenty','five']);
  assert.deepStrictEqual(C.normWords('50% off'), ['fifty','percent','off']);
  assert.deepStrictEqual(C.normWords('end-to-end'), ['end','to','end']);
});
test('perfect attempt scores 100', () => {
  const r = C.evaluate('The quick brown fox.', 'the quick brown fox');
  assert.strictEqual(r.score, 100); assert.strictEqual(r.counts.correct, 4);
});
test('numbers spoken as words still match digits', () => {
  assert.strictEqual(C.evaluate('I have 3 cats', 'I have three cats').score, 100);
});
test('homophones are accepted', () => {
  assert.strictEqual(C.evaluate('I want to go there', 'I want two go their').score, 100);
});
test('missed word detected', () => {
  const r = C.evaluate('please run the regression tests', 'please run regression tests');
  assert.strictEqual(r.counts.missed, 1);
  assert.strictEqual(r.ops.find((o) => o.type === 'missed').target, 'the');
  assert.strictEqual(r.score, 80);
});
test('extra word penalized', () => {
  const r = C.evaluate('good morning', 'good um morning');
  assert.strictEqual(r.counts.extra, 1); assert.ok(r.score < 100 && r.score >= 80);
});
test('unclear word gets th tip', () => {
  const r = C.evaluate('I think so', 'I sink so');
  const u = r.ops.find((o) => o.type === 'unclear');
  assert.strictEqual(u.target, 'think'); assert.match(u.tip, /th/);
});
test('v/w confusion tip', () => {
  const u = C.evaluate('very good', 'wery good').ops.find((o) => o.type === 'unclear');
  assert.match(u.tip, /"v"/);
});
test('empty transcript scores 0, all missed', () => {
  const r = C.evaluate('hello there', ''); assert.strictEqual(r.score, 0); assert.strictEqual(r.counts.missed, 2);
});
test('best alternative chosen', () => {
  const r = C.evaluate('light the lamp', [{ transcript: 'right the ramp', confidence: 0.8 }, { transcript: 'light the lamp', confidence: 0.7 }]);
  assert.strictEqual(r.score, 100); assert.strictEqual(r.transcript, 'light the lamp');
});
test('low confidence lowers score slightly', () => {
  const hi = C.score(C.align(['a','b','c'], ['a','b','x']), 0.9), lo = C.score(C.align(['a','b','c'], ['a','b','x']), 0.2);
  assert.ok(lo < hi);
});
test('tokenStatus maps back to display words', () => {
  const r = C.evaluate("It's 10 o'clock", "it is ten clock");
  const st = C.tokenStatus("It's 10 o'clock", r.ops);
  assert.deepStrictEqual(st.map((s) => s.text), ["It's", '10', "o'clock"]);
  assert.strictEqual(st[0].type, 'correct'); assert.strictEqual(st[1].type, 'correct'); assert.notStrictEqual(st[2].type, 'correct');
});
test('alignment order is stable', () => {
  const ops = C.align(['a','b','c','d'], ['a','c','d','e']);
  assert.deepStrictEqual(ops.map((o) => o.type), ['correct','missed','correct','correct','extra']);
});
test('numToWords', () => { assert.strictEqual(C.numToWords(2026), 'two thousand twenty six'); });
