'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const E=require('../frontend/analyzer.js');
const T=require('../frontend/trainer-engine.js');
const D=require('../frontend/trainer-data.js');
const S=require('../frontend/scenarios-data.js');
const Scenario=require('../frontend/scenario-engine.js');

test('all authored exercise spans are exact, bilingual, immutable and independently analyzed',()=>{
  const scores=[85,45,35,45,0,0,63];
  assert.equal(D.exercises.length,7);
  for(const [i,exercise] of D.exercises.entries()){
    assert.ok(exercise.author.note.ru&&exercise.author.note.kk);
    for(const span of exercise.author.spans){assert.equal(exercise.text.slice(span.start,span.end),span.text);assert.ok(span.reason.ru&&span.reason.kk);}
    assert.ok(Object.isFrozen(exercise.author.spans));
    const r=T.review(exercise,[],true);
    assert.equal(r.result.score,scores[i]);assert.deepEqual(r.result,E.analyze(exercise.text,exercise.channel));
  }
});
test('human choices and author labels cannot alter analyzer features or score',()=>{
  const exercise=D.exercises[0],all=T.tokens(exercise.text).map(t=>t.id),a=T.review(exercise,all),b=T.review(exercise,[],true);
  assert.deepEqual(a.result,b.result);
  const other=structuredClone(exercise);other.id='ordinary';other.author={spans:[],note:{ru:'БЕЗОПАСНО',kk:'ҚАУІПСІЗ'}};
  assert.deepEqual(T.review(other,[0]).result,a.result);
  assert.deepEqual(a.user.spans.map(s=>s.id),all);assert.equal(b.user.noSignals,true);
});
test('quoted warning retains real false alert and explicit system/author disagreement',()=>{
  const r=T.review(D.exercises.find(e=>e.id==='quotation'),[],true);
  assert.equal(r.result.score,63);assert.equal(r.author.spans.length,0);
  assert.ok(r.differences.systemOnly.some(s=>s.text.includes('Срочно')));
  assert.equal(r.differences.authorOnly.length,0);
  assert.equal(r.differences.userOnly.length,0);
});
test('implicit request preserves a missed example instead of injecting author features',()=>{
  const r=T.review(D.exercises.find(e=>e.id==='implicit'),[],true);
  assert.equal(r.result.score,0);assert.ok(r.differences.authorOnly.length>0);
  assert.ok(r.differences.authorMissed.some(s=>s.text==='Переведи'));
  assert.equal(r.differences.systemOnly.length,0);
});
test('ordinary financial notification supports an explicit no-signals answer',()=>{
  const exercise=D.exercises.find(e=>e.id==='notice'),r=T.review(exercise,[],true);
  assert.equal(r.result.score,0);assert.ok(Object.values(r.differences).every(rows=>rows.length===0));
  const selected=T.review(exercise,[0]);assert.deepEqual(selected.differences.userOnly.map(s=>s.text),['Покупка']);
});
test('selection tokenization retains UTF-16 offsets, mixed languages, whitespace and literal HTML',()=>{
  const text='🔐  Срочно!\nSMS кодты\t<svg/onload=alert(1)> https://kaspi.kz.verify.example';
  const tokens=T.tokens(text);let reconstructed='',offset=0;
  tokens.forEach(token=>{assert.equal(text.slice(token.start,token.end),token.text);reconstructed+=text.slice(offset,token.start)+token.text;offset=token.end;});
  assert.equal(reconstructed+text.slice(offset),text);
  const result=T.review({text,channel:'sms',author:{spans:[],note:{ru:'x',kk:'x'}}},[0]);
  assert.equal(result.user.spans[0].text,'🔐');assert.equal(result.result.text,text);
});
test('word overlap comparison is explicit while analyzer retains exact domain evidence',()=>{
  const exercise=D.exercises.find(e=>e.id==='domain'),url=T.tokens(exercise.text).find(t=>t.text.startsWith('https://'));
  const r=T.review(exercise,[url.id]);assert.equal(r.differences.authorMissed.length,0);assert.equal(r.differences.userOnly.length,0);
  assert.equal(r.user.spans[0].text,'https://kaspi.kz.verify.example/confirm');
  assert.equal(r.result.signals[0].matches[0].text,'kaspi.kz.verify.example');
});
test('ambiguous, invalid and empty unconfirmed selections are rejected',()=>{
  const exercise=D.exercises[0];
  for(const ids of [[-1],[999],[.5],[0,0]])assert.throws(()=>T.review(exercise,ids),/selection/);
  assert.throws(()=>T.review(exercise,[]),/answer_required/);
  assert.throws(()=>T.review(exercise,[0],true),/answer_required/);
  assert.deepEqual(T.review(exercise,[0]),T.review(exercise,[0]));
});
function store(){const context={window:{QalqanEngine:E,QalqanI18n:{rule:c=>c,t:s=>s}},performance,structuredClone};vm.runInNewContext(fs.readFileSync(require.resolve('../frontend/local-store.js'),'utf8'),context);return context.window.QalqanStore;}
test('saved attempts clone context and never pass author or user labels to analysis',()=>{
  const storage=store(),exercise=D.exercises[6],r=T.review(exercise,[],true);
  const context={kind:'trainer',user:r.user,author:structuredClone(r.author),differences:r.differences};
  const saved=storage.saveLearning({content:exercise.text,channel:exercise.channel},context);
  assert.equal(saved.score,63);assert.equal(saved.analyzer_version,E.version);
  context.user.noSignals=false;context.author.note.ru='changed';
  assert.equal(saved.learning.user.noSignals,true);assert.notEqual(saved.learning.author.note.ru,'changed');
  assert.ok(Object.isFrozen(saved.learning));
  assert.equal(storage.request('history').items.length,1);
  storage.request('history',{method:'DELETE'});assert.equal(storage.request('history').items.length,0);
});
test('saved scenario trail is bounded to selected prefix and survives later reset',()=>{
  const s=S.scenarios[0],session=Scenario.createSession(s),storage=store();
  for(let step=1;step<=4;step++)session.seek(step);session.seek(2);
  const r=session.current.result,context={kind:'scenario',steps:session.steps.map(s=>({step:s.step,score:s.result.score,new_codes:s.newSignals.map(s=>s.code)}))};
  const saved=storage.saveLearning({content:r.text,channel:r.channel,mode:'dialogue'},context);
  session.reset();context.steps.length=0;
  assert.deepEqual(JSON.parse(JSON.stringify(saved.learning.steps.map(s=>s.score))),[0,40]);
  assert.equal(saved.score,40);assert.equal(saved.replies.length,2);assert.ok(!saved.text.includes('Введите код'));
});
