const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../frontend/analyzer.js');
const codes=r=>r.signals.map(s=>s.code);

for(const [name,text,expected] of [
  ['Russian attack','Срочно! Ваш счёт заблокирован. Введите код из SMS и CVV.','high'],
  ['Kazakh attack','Шұғыл! Шотыңыз бұғатталады. SMS кодты және CVV енгізіңіз.','high'],
  ['Mixed languages','Картаңыз бұғатталды. Срочно введите SMS кодты.','high'],
  ['Ordinary Russian notification','Покупка на 3 500 ₸. Чек доступен в приложении банка.','low'],
  ['Ordinary Kazakh notification','Жаңа картаңыз дайын. Банк қосымшасынан қараңыз.','low'],
  ['Russian warning, not a request','Никогда не сообщайте код из SMS и CVV сотрудникам банка.','low'],
  ['Kazakh warning, not a request','SMS кодты ешкімге жібермеңіз. Құпиясөзді енгізбеңіз.','low'],
  ['Russian negated threat','Ваша карта не заблокирована.','low'],
  ['Kazakh negated threat','Картаңыз бұғатталмаған.','low'],
  ['Benign bare domain','Выписка: example.com','low'],
  ['Informational noun is not a command','Сообщение содержит код операции 123.','low'],
  ['Passive notification is not a request','Код отправлен. Жіберілген код туралы хабарлама.','low']
])test(name,()=>assert.equal(E.analyze(text).verdict,expected));

test('evidence retains original spaces, case, emoji and UTF-16 offsets',()=>{
  const text='🔐  СРОЧНО!\nВведите   код из SMS. Обычный текст.';
  const result=E.analyze(text),spans=result.signals.flatMap(s=>s.matches);
  for(const m of spans)assert.equal(text.slice(m.start,m.end),m.text);
  assert.ok(spans.some(m=>m.text==='СРОЧНО'));
  assert.ok(spans.some(m=>m.text==='Введите'));
  assert.ok(spans.some(m=>m.text==='код'));
  assert.ok(!spans.some(m=>m.text.includes('Обычный')));
  const segments=E.segments(text,result.signals);
  assert.equal(segments.map(s=>s.text).join(''),text);
  assert.equal(segments.filter(s=>s.codes.length).map(s=>s.text).join('|'),'СРОЧНО|Введите|код');
});
test('domain flag highlights host, HTTP flag highlights scheme only',()=>{
  const result=E.analyze('Текст http://kaspi-verify.example/pay?next=normal');
  assert.equal(result.signals.find(s=>s.code==='impersonation').matches[0].text,'kaspi-verify.example');
  assert.equal(result.signals.find(s=>s.code==='no_https').matches[0].text,'http:');
  assert.ok(!E.segments(result.text,result.signals).some(s=>s.codes.length&&s.text.includes('?next')));
});
test('URL checks retain IP, IDN, shortener, malformed and userinfo protections',()=>{
  for(const [url,code] of [['http://192.0.2.1/pay','ip_host'],['https://қаспи.kz','idn'],['https://bit.ly/test','shortener'],['http://[bad','malformed_url'],['https://kaspi.kz@evil.example','userinfo'],['https://kasp1.kz','impersonation']])assert.ok(codes(E.analyze(url,'url')).includes(code),url);
  assert.equal(E.analyze('https://pay.kaspi.kz','url').urls[0].known,true);
  assert.equal(E.analyze('https://kaspi.kz.evil.example','url').urls[0].known,false);
});
test('repeated rules get evidence for each occurrence but weight once',()=>{
  const once=E.analyze('Срочно проверьте.'),twice=E.analyze('Срочно, срочно проверьте.');
  assert.equal(twice.score,once.score);
  assert.equal(twice.signals[0].matches.length,2);
});
test('negation must be a whole word, not the ending of a pronoun',()=>{
  assert.ok(codes(E.analyze('Мне отправьте код из SMS.')).includes('secret_request'));
  assert.ok(codes(E.analyze('Мне срочно нужны данные.')).includes('urgency'));
  assert.ok(!codes(E.analyze('Не отправьте код из SMS.')).includes('secret_request'));
});
test('noncanonical URL authorities fail safely without misleading host evidence',()=>{
  for(const url of ['https:///kaspi.kz', 'https://evil.example\\@kaspi.kz', 'https://kaspi.\nkz']){
    const result=E.analyze(url,'url');
    assert.deepEqual(codes(result),['malformed_url']);
    assert.equal(result.signals[0].matches[0].text,url);
    assert.equal(result.urls[0].known,false);
  }
});
test('dialogue combines different cues from separate replies',()=>{
  const result=E.analyzeDialogue('Банк: Срочно, ваш счёт заблокирован.\n\nЯ: Что делать?\n\nБанк: SMS кодты енгізіңіз.');
  assert.equal(result.replies.length,3);
  assert.equal(result.verdict,'high');
  assert.equal(result.replies[1].score,0);
  assert.equal(result.score,85);
  assert.deepEqual(result.signals.find(s=>s.code==='secret_request').replies,[3]);
});
test('benign and repeated dialogues do not gain artificial risk',()=>{
  assert.equal(E.analyzeDialogue('Здравствуйте, выписка готова.\n\nРақмет!').score,0);
  assert.equal(E.analyzeDialogue('Срочно проверьте.\n\nСрочно проверьте.').score,18);
  assert.equal(E.analyzeDialogue('Выписка готова.\n\nДа\n\n?').replies.length,3);
});
test('dialogue accepts CRLF and blank lines without renumbering real replies',()=>{
  const result=E.analyzeDialogue('  Сәлем.\r\n \r\n\r\nРақмет!  ');
  assert.equal(result.replies.length,2);
  assert.equal(result.replies[0].text,'  Сәлем.');
});
test('invalid inputs fail intentionally',()=>{
  for(const text of ['',null,'x','x'.repeat(10001)])assert.throws(()=>E.analyze(text),RangeError);
  assert.throws(()=>E.analyzeDialogue('Только одна реплика'),/dialogue_count/);
  assert.throws(()=>E.analyzeDialogue(Array(21).fill('hello').join('\n\n')),/dialogue_count/);
});
test('overlapping URL evidence preserves every original character once',()=>{
  const result=E.analyze('http://kaspi.kz@evil.example','url');
  assert.equal(E.segments(result.text,result.signals).map(s=>s.text).join(''),result.text);
});
