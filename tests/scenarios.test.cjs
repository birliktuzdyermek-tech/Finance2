const {test} = require('node:test');
const assert = require('node:assert/strict');
const data = require('../frontend/scenarios-data.js');
const S = require('../frontend/scenario-engine.js');
const E = require('../frontend/analyzer.js');
const scenario = id => data.scenarios.find(s => s.id === id);

test('all seven scenarios have bilingual metadata and valid synthetic turns', () => {
  assert.equal(data.scenarios.length, 7);
  assert.equal(new Set(data.scenarios.map(s => s.id)).size, 7);
  for (const s of data.scenarios) {
    for (const key of ['title','description','note']) for (const lang of ['ru','kk']) assert.ok(s[key][lang]);
    assert.ok(s.turns.length >= 2 && s.turns.length <= 20);
    for (let step = 1; step <= s.turns.length; step++) {
      const content = s.turns.slice(0, step).map(t => t.text).join('\n\n');
      const direct = step === 1 ? E.analyze(content, s.channel, true) : E.analyzeDialogue(content, s.channel);
      assert.deepEqual(S.snapshot(s, step).result, direct);
    }
  }
});

test('warning emerges from observed messages; labels and future text cannot change it', () => {
  const original = scenario('bank-message');
  const changed = JSON.parse(JSON.stringify(original));
  changed.title.ru = 'Completely safe'; changed.note.ru = 'Expected score 0';
  changed.expectedScore = 0; changed.label = false; changed.turns[3].text = 'Обычный чек.';
  assert.deepEqual(S.snapshot(original, 2).result, S.snapshot(changed, 2).result);
  assert.deepEqual([1,2,3,4].map(step => S.snapshot(original, step).result.score), [0,40,40,85]);
  assert.deepEqual(S.snapshot(original, 4).newSignals.map(s => s.code), ['secret_request']);
  assert.equal(S.snapshot(original, 4).scoreDelta, 45);
});

test('rewind, reset and repeated inputs restore the same calculated state', () => {
  const s = scenario('bank-message'), session = S.createSession(s);
  const source = JSON.stringify(s);
  assert.equal(session.current.result, null);
  session.seek(1); const second = session.seek(2);
  session.seek(3); session.seek(4);
  assert.deepEqual(session.seek(2), second);
  assert.deepEqual(session.steps.map(s => s.step), [1,2]);
  assert.equal(JSON.stringify(s), source);
  session.reset(); assert.equal(session.current.step, 0); assert.deepEqual(session.steps, []);
  assert.deepEqual(session.seek(2), second);
  for (const step of [-1, 5, 1.5, true]) assert.throws(() => session.seek(step), /scenario_step/);
});

test('repeated requests retain evidence without adding the secret rule twice', () => {
  const current = S.snapshot(scenario('code-request'), 4);
  assert.equal(current.result.score, 63);
  assert.deepEqual(current.newSignals.map(s => s.code), ['urgency']);
  assert.equal(current.scoreDelta, 18);
  assert.deepEqual(current.result.signals.find(s => s.code === 'secret_request').replies, [2,4]);
});

test('ordinary notice and a quoted warning keep real results, including false alerts', () => {
  const ordinary = scenario('bank-notice'), warning = scenario('security-warning');
  assert.equal(S.snapshot(ordinary, ordinary.turns.length).result.score, 0);
  assert.equal(S.snapshot(warning, 1).result.score, 0);
  assert.equal(S.snapshot(warning, 3).result.score, 63);
  assert.equal(S.snapshot(scenario('friend-transfer'), 4).result.score, 18);
});

test('domain evidence identifies the actual host and preserves exact source text', () => {
  const result = S.snapshot(scenario('domain-switch'), 2).result;
  assert.equal(result.score, 45);
  assert.equal(result.replies[0].signals.length, 0);
  const second = result.replies[1];
  assert.equal(second.signals[0].matches[0].text, 'kaspi.kz.verify.example');
  assert.equal(E.segments(second.text, second.signals).map(s => s.text).join(''), second.text);
});
