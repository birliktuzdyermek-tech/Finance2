'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('../frontend/guidance.js'),E=require('../frontend/analyzer.js');
const {evaluate}=require('../scripts/evaluate_browser_development.cjs');
const data=require('./fixtures/browser-development.json');
test('every incident has bilingual practical steps and fixed official sources',()=>{
  for(const key of ['received','opened','entered','transferred'])for(const lang of ['ru','kk']){
    const p=G.plan(key,E.analyze('Покупка в магазине.'),lang);
    assert.ok(p.steps.length>=2);assert.ok(p.sources.length>=2);assert.equal(p.reviewed,'2026-10-07');
    assert.ok(p.sources.every(s=>['www.gov.kz','www.ncsc.gov.uk'].includes(new URL(s.url).hostname)));
    assert.equal(p.key,key);
  }
  assert.notDeepEqual(G.plan('entered',null,'ru').steps,G.plan('entered',null,'kk').steps);
  assert.throws(()=>G.plan('unknown'),/incident/);
});
test('low score cannot suppress response to transferred money or disclosed data',()=>{
  const low=E.analyze('Добрый день.'),high=E.analyze('Срочно! Счёт заблокирован. Введите код.');
  for(const key of ['entered','transferred']){
    assert.deepEqual(G.plan(key,low).steps,G.plan(key,high).steps);
    assert.match(G.plan(key,low).context,/независимо от балла/);
  }
  assert.match(G.plan('transferred',low).steps.join(' '),/Возврат денег не гарантирован/);
  assert.match(G.plan('transferred',low).steps.join(' '),/102/);
});
test('advice context is based on actual signals and never copies untrusted contacts',()=>{
  const input='Введите код на https://kaspi.evil.example. Звоните 123456.';
  const p=G.plan('received',E.analyze(input));assert.match(p.context,/запрос секретных данных/);
  assert.ok(!JSON.stringify(p).includes('evil.example'));assert.ok(!JSON.stringify(p).includes('123456'));
  assert.match(G.plan('received',E.analyze('Обычная покупка.')).context,/подлинность не подтверждена/);
});
test('development report preserves ordinary cases, false alerts and misses without tuning rules',()=>{
  const report=evaluate(data);assert.equal(report.cases.length,20);assert.equal(report.analyzer_version,E.version);
  assert.deepEqual(report.falseAlerts,['quoted-warning','coupon-code']);
  assert.deepEqual(report.misses,['implicit-request','mixed-script-obfuscation','ip-only']);
  assert.deepEqual(report.counts,{tp:8,tn:7,fp:2,fn:3});
  assert.equal(report.cases.find(c=>c.id==='repeated-secret').score,45);
  assert.deepEqual(evaluate(data),report);
});
