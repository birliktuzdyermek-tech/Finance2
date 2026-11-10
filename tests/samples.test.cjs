const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../frontend/samples.js'),E=require('../frontend/analyzer.js');
// Indices are what the current rules produce on these authored examples; they document intended lessons, not accuracy.
const expected={'sms-parcel':73,'sms-bonus':62,'sms-otp':0,'wa-relative':18,'wa-prize':60,'wa-kk':95,'email-invoice':45,'email-job':50,'email-news':0,
  'url-short':28,'url-ip':35,'url-user':30,'url-ok':0,'dlg-bank':63,'dlg-safe':53,'dlg-relative':18,'dlg-market':62,'dlg-normal':0,'dlg-quote':63,
  'kk-sms-prize':60,'kk-email':67,'kk-wa-relative':18,'kk-sms-safe':0,'en-sms-bank':95,'en-sms-parcel':28,'en-wa-prize':60,'en-wa-code':0,'en-email-invoice':50,'en-email-job':35,'en-email-news':0,
  'dlg-kk':63,'dlg-en':63,'dlg-mix':85,'dlg-en-normal':0};
const run=item=>item.mode==='dialogue'?E.analyzeDialogue(item.text,item.channel):E.analyze(item.text,item.channel);

test('examples are well formed, bilingual and unique',()=>{
  assert.equal(S.list.length,34);assert.equal(new Set(S.list.map(i=>i.key)).size,34);
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

test('every example is tagged with the language it is really written in',()=>{
  const kazakh=/[әғқңөұүһі]/i,cyrillic=/[а-яё]/i,latin=/[a-z]{3,}/i;
  const counts={ru:0,kk:0,en:0,mix:0,any:0};
  for(const item of S.list){
    assert.ok(['ru','kk','en','mix','any'].includes(item.lang),item.key);counts[item.lang]++;
    if(item.lang==='any'){assert.equal(item.channel,'url',item.key);assert.equal(item.text.split(/\s+/).length,1,item.key);continue;}
    const body=item.text.replace(/https?:\/\/\S+/g,'');
    if(item.lang==='en'){assert.ok(!cyrillic.test(body),item.key);assert.ok(latin.test(body),item.key);}
    if(item.lang==='kk'){assert.ok(kazakh.test(body),item.key);}
    if(item.lang==='ru'&&item.key!=='wa-kk'){assert.ok(cyrillic.test(body),item.key);}
    if(item.lang==='mix'){assert.ok(kazakh.test(body)&&/срочно|помощь|сообщите|случилось/i.test(body),item.key);}
  }
  assert.ok(counts.ru>=11&&counts.kk>=5&&counts.en>=7&&counts.mix>=1&&counts.any===4,JSON.stringify(counts));
});
test('English and Kazakh examples show both what the rules catch and a known gap',()=>{
  const by=k=>run(S.list.find(i=>i.key===k));
  assert.ok(by('en-sms-bank').score>=70&&by('kk-email').score>=35&&by('dlg-kk').score>=35&&by('dlg-en').score>=35);
  assert.equal(by('en-wa-code').score,0,'the English word "code" is not in the rules: documented gap');
  assert.equal(by('en-email-news').score,0);assert.equal(by('dlg-en-normal').score,0);
});
