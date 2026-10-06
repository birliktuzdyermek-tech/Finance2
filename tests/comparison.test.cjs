'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const E = require('../frontend/analyzer.js');
const C = require('../frontend/comparison-engine.js');
const codes = items => items.map(s => s.code).sort();
const compare = (text, draft, options = {}) => C.createSession({text, ...options}).compare(draft);

test('removing pressure explains only the urgency weight; inputs use the current engine', () => {
  const text = 'Срочно! Введите код из SMS.', draft = 'Введите код из SMS.';
  const r = compare(text, draft);
  assert.deepEqual(r.original, E.analyze(text)); assert.deepEqual(r.edited, E.analyze(draft));
  assert.equal(r.original.score, 63); assert.equal(r.edited.score, 45);
  assert.deepEqual(codes(r.removed), ['urgency']); assert.equal(r.scoreDelta, -18);
  assert.deepEqual(codes(r.retained), ['secret_request']);
  assert.equal(r.original.analyzer_version, E.version); assert.equal(r.edited.analyzer_version, E.version);
});
test('domain replacement removes only structural signals actually checked', () => {
  const r = compare('http://kaspi-verify.example/pay', 'https://kaspi.kz/pay', {channel:'url'});
  assert.deepEqual(codes(r.removed), ['impersonation', 'no_https']);
  assert.equal(r.edited.score, 0); assert.equal(r.edited.urls[0].known, true);
  assert.deepEqual(C.evidence(r.original, 'impersonation').map(m => m.text), ['kaspi-verify.example']);
  assert.deepEqual(C.evidence(r.original, 'no_https').map(m => m.text), ['http:']);
});
test('removing secret request and introducing a different signal yields both changes', () => {
  const r = compare('Введите код из SMS.', 'Шұғыл! Банкке хабарласыңыз.');
  assert.deepEqual(codes(r.removed), ['secret_request']); assert.deepEqual(codes(r.added), ['urgency']);
  assert.equal(r.scoreDelta, -27);
});
test('ordinary financial messages and simple negations remain unflagged', () => {
  const r = compare('Покупка на 3 500 ₸. Чек в приложении банка.', 'Картаңыз дайын. Никогда не сообщайте код. SMS кодты ешкімге жібермеңіз.');
  assert.equal(r.original.score, 0); assert.equal(r.edited.score, 0);
  assert.deepEqual([...r.added, ...r.removed, ...r.retained], []);
});
test('adding warning context does not fabricate understanding of a quotation', () => {
  const text = 'Срочно! Введите код из SMS.';
  const r = compare(text, 'Пересланное предупреждение: мошенники пишут «'+text+'»');
  assert.equal(r.edited.score, 63); assert.equal(r.scoreDelta, 0);
  assert.deepEqual(r.added, []); assert.deepEqual(r.removed, []);
  assert.deepEqual(codes(r.evidenceChanged), ['secret_request', 'urgency']);
});
test('repeated mixed-language dialogue rules are counted once; removing one occurrence has no weight effect', () => {
  const text = 'Срочно введите код.\n\nШұғыл! SMS кодты жіберіңіз.\n\nЧек в приложении банка.';
  const draft = 'Добрый день.\n\nШұғыл! SMS кодты жіберіңіз.\n\nЧек в приложении банка.';
  const r = compare(text, draft, {mode:'dialogue',channel:'whatsapp'});
  assert.equal(r.original.score, 63); assert.equal(r.edited.score, 63); assert.equal(r.weightDelta, 0);
  assert.equal(r.removed.length, 0);
  assert.ok(C.evidence(r.original,'secret_request').some(m => m.reply === 1));
  assert.ok(C.evidence(r.edited,'secret_request').every(m => m.reply === 2));
  for (const result of [r.original,r.edited]) for (const s of result.signals) for (const m of C.evidence(result,s.code)) {
    assert.equal(result.replies[m.reply-1].text.slice(m.start,m.end),m.text);
  }
});
test('score ceiling explains a smaller visible delta than removed rule weights', () => {
  const text='Срочно! Счёт заблокирован. Введите код. http://kaspi-verify.example';
  const r=compare(text,text.replace('Срочно!', 'Добрый день.'));
  assert.equal(r.originalWeight,140); assert.equal(r.editedWeight,122);
  assert.equal(r.original.score,100); assert.equal(r.edited.score,100);
  assert.equal(r.capped,true); assert.equal(r.weightDelta,-18); assert.equal(r.scoreDelta,0);
});
test('determinism, no-op edit and immutable original including nested evidence', () => {
  const input={text:'🔐  Срочно! Введите   код.',channel:'sms',score:99};
  const snapshot=JSON.stringify(input), session=C.createSession(input);
  assert.equal(JSON.stringify(input),snapshot); assert.equal(session.original.score,63);
  assert.throws(() => { session.original.signals[0].matches[0].text='bad'; },TypeError);
  input.text='Новое сообщение';
  const a=session.compare(session.original.text), b=session.compare(session.original.text);
  assert.deepEqual(a,b); assert.equal(a.scoreDelta,0); assert.equal(a.evidenceChanged.length,0);
  a.edited.signals.length=0; assert.ok(session.original.signals.length>0);
});
test('HTML-looking text remains literal data with exact offsets and gaps', () => {
  const text='<img src=x onerror=alert(1)> 🔐 Срочно! Введите   код.';
  const r=compare(text,text);
  assert.equal(r.original.text,text);
  for (const s of r.edited.signals) for (const m of C.evidence(r.edited,s.code)) assert.equal(text.slice(m.start,m.end),m.text);
  const pieces=E.segments(text,r.edited.signals);
  assert.equal(pieces.map(p=>p.text).join(''),text);
  assert.ok(!pieces.filter(p=>p.codes.length).some(p=>p.text.includes('<img')));
});
test('invalid edits and configuration fail without modifying the anchor', () => {
  const session=C.createSession({text:'Добрый день!'});
  for (const draft of ['', '  ', 'x', 'я'.repeat(10001), null]) assert.throws(()=>session.compare(draft),RangeError);
  assert.equal(session.original.text,'Добрый день!');
  const dialogue=C.createSession({text:'Да\n\nНет',mode:'dialogue'});
  assert.throws(()=>dialogue.compare('Одна реплика'),/dialogue_count/);
  assert.throws(()=>dialogue.compare(Array(21).fill('Реплика').join('\n\n')),/dialogue_count/);
  assert.throws(()=>C.createSession({text:'Текст',mode:'invalid'}),/mode/);
  assert.throws(()=>C.createSession({text:'Текст',channel:'invalid'}),/channel/);
});
