const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../frontend/samples.js'),E=require('../frontend/analyzer.js');
// Indices are what the current rules produce on these authored examples; they document intended lessons, not accuracy.
const expected={'sms-parcel':73,'sms-bonus':62,'sms-otp':0,'wa-relative':18,'wa-prize':60,'wa-kk':95,'email-invoice':45,'email-job':50,'email-news':0,
  'url-short':28,'url-ip':35,'url-user':30,'url-ok':0,'dlg-bank':63,'dlg-safe':53,'dlg-relative':18,'dlg-market':62,'dlg-normal':0,'dlg-quote':63};
const run=item=>item.mode==='dialogue'?E.analyzeDialogue(item.text,item.channel):E.analyze(item.text,item.channel);

test('examples are well formed, bilingual and unique',()=>{
  assert.equal(S.list.length,19);assert.equal(new Set(S.list.map(i=>i.key)).size,19);
  assert.deepEqual(Object.keys(expected).sort(),S.list.map(i=>i.key).sort());
  for(const item of S.list){
    for(const k of ['label','hint'])for(const lang of ['ru','kk'])assert.ok(item[k][lang],item.key);
    assert.ok(['single','dialogue'].includes(item.mode));assert.ok(['sms','whatsapp','email','url'].includes(item.channel));
    assert.ok(item.text.length>=3&&item.text.length<=10000);
    if(item.mode==='dialogue'){assert.notEqual(item.channel,'url');const n=item.text.split(/\n\s*\n/).length;assert.ok(n>=2&&n<=20,item.key);}
    else assert.equal(item.text.split(/\n\s*\n/).length,1,item.key+' must be one message');
  }
});
test('every example analyzes and gives the intended index',()=>{
  for(const item of S.list)assert.equal(run(item).score,expected[item.key],item.key);
});
test('examples never contain a working domain or a real-looking secret',()=>{
  const allowed=new Set(['egov.kz','kaspi.kz','halykbank.kz','bit.ly']);
  for(const item of S.list)for(const host of item.text.match(/(?:https?:\/\/)?(?:[\w-]+@)?([\w.-]+\.[a-z]{2,})/gi)||[]){
    const name=host.replace(/^https?:\/\//,'').replace(/^[\w-]+@/,'').split('/')[0].toLowerCase();
    if(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(name))continue;
    assert.ok(name.endsWith('.example')||allowed.has(name),item.key+': '+name);
  }
  for(const item of S.list)assert.ok(!/\b\d{16}\b/.test(item.text),item.key);
});
test('both limits are shown: a low index on a risky request and a false alarm on a quote',()=>{
  assert.ok(run(S.list.find(i=>i.key==='wa-relative')).score<35);
  assert.ok(run(S.list.find(i=>i.key==='dlg-quote')).score>=35);
  assert.equal(run(S.list.find(i=>i.key==='sms-otp')).score,0);
});
