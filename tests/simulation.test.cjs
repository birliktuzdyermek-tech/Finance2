const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../frontend/simulation-engine.js'),E=require('../frontend/analyzer.js');
const L=require('../frontend/simulation-lessons.js');

test('every story analyzes its unchanged source, excluding author labels and actions',()=>{
  for(const story of S.stories){
    const session=S.createSession(story.id);
    assert.equal(session.result(),null);
    session.act('open_phone');session.act('analyze');
    assert.deepEqual(session.result(),E.analyze(story.message,story.channel));
    session.act('contact');
    assert.deepEqual(session.result(),E.analyze(story.message,story.channel));
    for(const signal of session.result().signals)for(const span of signal.matches)
      assert.equal(story.message.slice(span.start,span.end),span.text);
  }
});
test('code story moves from received to opened to entered with immutable snapshots',()=>{
  const s=S.createSession('blocked-card'),initial=s.state;s.act('open_phone');
  assert.equal(s.state.incident,'received');s.act('open_link');assert.equal(s.state.incident,'opened');
  const page=s.state;s.act('send_demo');assert.equal(s.state.incident,'entered');
  assert.equal(s.state.phase,'outcome');assert.equal(s.state.ending,'send_demo');
  assert.equal(initial.phase,'notification');assert.equal(initial.journal.length,0);
  assert.equal(page.incident,'opened');assert.deepEqual(s.state.journal,['open_phone','open_link','send_demo']);
  assert.ok(Object.isFrozen(s.state.journal));assert.ok(Object.isFrozen(s.story));
  assert.equal(s.result(),null);s.act('analyze');assert.ok(s.result());
});
test('money story has a simulated transfer, never code entry',()=>{
  const s=S.createSession('safe-transfer');s.act('open_phone');s.act('open_link');
  assert.equal(s.options().includes('send_demo'),false);s.act('transfer_demo');
  assert.equal(s.state.incident,'transferred');assert.equal(s.state.ending,'transfer_demo');
  s.act('analyze');assert.equal(s.result().score,53);
});
test('ordinary mixed-language receipt has no link, no secret request and no false warning',()=>{
  const s=S.createSession('ordinary-receipt');s.act('open_phone');
  assert.equal(s.options().includes('open_link'),false);s.act('analyze');
  assert.equal(s.result().score,0);assert.deepEqual(s.result().signals,[]);
  s.act('ignore');assert.equal(s.state.incident,'received');
  assert.equal(s.state.phase,'outcome');assert.deepEqual(s.options(),[]);
});
test('independent contact and stopping preserve what has already happened',()=>{
  for(const action of ['contact','ignore'])for(const opened of [false,true]){
    const s=S.createSession('blocked-card');s.act('open_phone');if(opened)s.act('open_link');s.act(action);
    assert.equal(s.state.incident,opened?'opened':'received');assert.equal(s.state.ending,action);
  }
});
test('out-of-order and repeated actions cannot change the state',()=>{
  assert.throws(()=>S.createSession('unknown'),RangeError);
  const s=S.createSession('blocked-card');
  for(const action of ['analyze','send_demo','open_link'])assert.throws(()=>s.act(action),RangeError);
  assert.equal(s.state.journal.length,0);s.act('open_phone');s.act('analyze');
  const prior=s.state;assert.throws(()=>s.act('analyze'),RangeError);assert.equal(s.state,prior);
  s.act('ignore');assert.throws(()=>s.act('open_link'),RangeError);
});
test('a fresh session has no previous choices, result or incident',()=>{
  const old=S.createSession('blocked-card');old.act('open_phone');old.act('open_link');old.act('send_demo');
  const fresh=S.createSession(old.story.id);assert.equal(fresh.state.phase,'notification');
  assert.equal(fresh.state.incident,'received');assert.deepEqual(fresh.state.journal,[]);assert.equal(fresh.result(),null);
});

test('different replies enter distinct finite branches; hidden replies and user answers are excluded',()=>{
  for(const story of S.stories)for(const first of ['ask_reason','verify_sender']){
    const s=S.createSession(story.id);s.act('open_phone');s.act(first,'kk');
    const target=L.dialogues[story.id].start.options[first];
    assert.equal(s.state.node,target);assert.equal(s.state.transcript.length,3);
    assert.equal(s.state.transcript[1].text,L.choices[first].kk);
    assert.deepEqual(s.input(),{content:story.message+'\n\n'+L.dialogues[story.id][target].text,channel:story.channel,mode:'dialogue'});
    assert.equal(s.input().content.includes(L.choices[first].kk),false);
    s.act('analyze');assert.deepEqual(s.result(),E.analyzeDialogue(s.input().content,story.channel));
    const follow=Object.keys(L.dialogues[story.id][target].options)[0];s.act(follow);s.act('analyze');
    assert.equal(s.result().replies.length,3);
    assert.equal(s.options().some(a=>L.choices[a]),false);
    for(const reply of s.result().replies)for(const signal of reply.signals)for(const m of signal.matches)assert.equal(reply.text.slice(m.start,m.end),m.text);
  }
});
test('a new incoming reply invalidates previous analysis while preserving its decision-map snapshot',()=>{
  const s=S.createSession('blocked-card');s.act('open_phone');s.act('analyze');
  const first=s.state.trace[1];s.act('verify_sender');
  assert.equal(s.result(),null);assert.equal(s.state.analyzed,false);
  assert.equal(first.replyCount,1);assert.equal(first.analysis.codes.includes('secret_request'),false);
  s.act('analyze');assert.ok(s.result().signals.some(s=>s.code==='secret_request'));
  assert.equal(s.state.trace[3].replyCount,2);assert.ok(Object.isFrozen(first.analysis.codes));
  assert.equal(first.analysis.codes.includes('secret_request'),false);
});
test('the ordinary receipt and every ordinary branch stay at zero without invented suspicion',()=>{
  for(const first of ['ask_reason','verify_sender']){
    const s=S.createSession('ordinary-receipt');s.act('open_phone');s.act(first);
    const next=Object.keys(L.dialogues['ordinary-receipt'][s.state.node].options)[0];s.act(next);s.act('analyze');
    assert.equal(s.result().score,0);assert.deepEqual(s.result().signals,[]);
    assert.deepEqual(s.parts(),[]);assert.equal(s.options().includes('inspect_link'),false);
    assert.throws(()=>s.act('inspect_link'),RangeError);s.act('ignore');assert.equal(s.state.incident,'received');
  }
});
test('URL parts reconstruct only the exact authored URL; reading an address never opens it',()=>{
  for(const story of S.stories.filter(s=>s.url)){
    const s=S.createSession(story.id);
    assert.equal(s.parts().map(p=>p.text).join(''),story.url);
    assert.equal(s.parts().filter(p=>p.id==='domain').length,1);
    s.act('open_phone');s.act('inspect_link');assert.equal(s.state.incident,'received');
    assert.equal(s.state.phase,'message');assert.equal(s.result(),null);
  }
});
test('domain answers have separate educational feedback; no answer affects the analyzer or incident',()=>{
  for(const story of S.stories.filter(s=>s.url))for(const part of L.parts[story.id]){
    const s=S.createSession(story.id);s.act('open_phone');s.act('analyze');const before=s.result();
    s.act('inspect_link');s.choosePart(part.id);s.checkPart();
    assert.equal(s.state.inspection.correct,part.id==='domain');assert.equal(s.state.incident,'received');
    assert.deepEqual(s.result(),before);assert.equal(s.state.trace.at(-1).selection,part.id);
    assert.equal(s.state.trace.at(-1).correct,part.id==='domain');
    assert.throws(()=>s.checkPart(),RangeError);assert.throws(()=>s.choosePart('domain'),RangeError);
  }
});
test('inspector rejects missing, invalid and late answers without recording false completions',()=>{
  const s=S.createSession('blocked-card');
  assert.throws(()=>s.choosePart('domain'),RangeError);s.act('open_phone');s.act('inspect_link');
  assert.throws(()=>s.checkPart(),RangeError);assert.throws(()=>s.choosePart('unknown'),RangeError);
  s.choosePart('scheme');s.choosePart('domain');assert.equal(s.state.inspection.selection,'domain');
  s.act('ignore');assert.throws(()=>s.checkPart(),RangeError);assert.throws(()=>s.choosePart('scheme'),RangeError);
  assert.equal(s.state.inspection.checked,false);assert.equal(s.state.trace.some(e=>e.action==='check_link'),false);
});
test('decision map records the real order, selected replies and incident transitions, not unchosen branches',()=>{
  const s=S.createSession('safe-transfer');
  for(const action of ['open_phone','ask_reason','ask_time','inspect_link'])s.act(action);
  s.choosePart('domain');s.checkPart();
  for(const action of ['open_link','transfer_demo','analyze'])s.act(action);
  assert.deepEqual(s.state.trace.map(e=>e.action),s.state.journal);
  assert.deepEqual(s.state.trace.filter(e=>e.reply).map(e=>e.to),['reason','pressure']);
  assert.equal(s.state.trace[4].before,'received');assert.equal(s.state.trace[4].after,'received');
  assert.equal(s.state.trace[5].after,'opened');assert.equal(s.state.trace[6].before,'opened');assert.equal(s.state.trace[6].after,'transferred');
  assert.equal(s.state.trace[7].replyCount,3);assert.ok(Object.isFrozen(s.state.trace[6]));
  const fresh=S.createSession('safe-transfer');assert.deepEqual(fresh.state.trace,[]);assert.deepEqual(fresh.state.transcript,[]);assert.equal(fresh.state.inspection.open,false);
});

test('simulator 3.0 has eight stories with the intended analyzer lessons',()=>{
  assert.equal(S.version,'simulation-3.0');
  assert.deepEqual(S.stories.map(s=>s.id),['blocked-card','safe-transfer','ordinary-receipt','qr-parking','relative-transfer','bank-call','marketplace-prepay','fake-job']);
  assert.equal(new Set(S.stories.map(s=>s.number)).size,8);
  const expected={'qr-parking':28,'relative-transfer':18,'bank-call':45,'marketplace-prepay':62,'fake-job':50};
  for(const [id,score] of Object.entries(expected)){
    const s=S.createSession(id);s.act('open_phone');s.act('analyze');assert.equal(s.result().score,score,id);
  }
  // The relative story is a deliberate analyzer limit: low index, yet the request is a money transfer.
  assert.equal(S.createSession('relative-transfer').story.url,null);
});
test('direct stories ask for code or money in the chat itself, with no page',()=>{
  for(const [id,action,incident] of [['relative-transfer','transfer_demo','transferred'],['bank-call','send_demo','entered']]){
    const s=S.createSession(id);s.act('open_phone');
    assert.equal(s.options().includes('open_link'),false);assert.equal(s.options().includes('inspect_link'),false);
    assert.equal(s.options().includes(action),true);
    s.act(action);assert.equal(s.state.incident,incident);assert.equal(s.state.phase,'outcome');assert.equal(s.state.ending,action);
  }
  // Stories with a page never allow the demo action before the page is opened.
  const s=S.createSession('qr-parking');s.act('open_phone');assert.equal(s.options().includes('transfer_demo'),false);
});
test('every address breaks into exact parts and exactly one domain',()=>{
  for(const story of S.stories.filter(s=>s.url)){
    assert.equal(L.parts[story.id].map(p=>p.text).join(''),story.url,story.id);
    assert.equal(L.parts[story.id].filter(p=>p.id==='domain').length,1,story.id);
  }
  for(const story of S.stories.filter(s=>!s.url))assert.deepEqual(L.parts[story.id],[],story.id);
});

const Badges=require('../frontend/simulation-badges.js');
const play=(id,actions,part)=>{
  const s=S.createSession(id);
  for(const action of actions){
    if(action==='check_link'){s.act('inspect_link');s.choosePart(part||'domain');s.checkPart();}else s.act(action);
  }
  return s;
};
test('badges: a careful path earns five badges and is idempotent',()=>{
  const progress=Badges.createProgress(S.stories.length);
  const s=play('blocked-card',['open_phone','analyze','check_link','contact']);
  assert.deepEqual(Badges.earnedBy(s).sort(),['calm','domain','selfcall','stop','verify']);
  assert.deepEqual(progress.record(s).sort(),['calm','domain','selfcall','stop','verify']);
  assert.deepEqual(progress.record(s),[],'recording the same session again earns nothing new');
  assert.equal(progress.done.size,1);assert.equal(progress.earned.size,5);
});
test('badges: handing over a code earns none, and late analysis does not count as verifying first',()=>{
  const bad=play('blocked-card',['open_phone','open_link','analyze','send_demo']);
  assert.deepEqual(Badges.earnedBy(bad),[]);
  const early=play('blocked-card',['open_phone','analyze','open_link','send_demo']);
  assert.deepEqual(Badges.earnedBy(early),['verify']);
  assert.deepEqual(Badges.earnedBy(S.createSession('blocked-card')),[],'nothing before the outcome');
});
test('badges: stopping an ordinary story is a stop but not resisting pressure; a wrong domain earns nothing',()=>{
  const calm=play('ordinary-receipt',['open_phone','ignore']);
  assert.deepEqual(Badges.earnedBy(calm),['stop']);
  const wrong=play('blocked-card',['open_phone','check_link','ignore'],'prefix');
  assert.equal(Badges.earnedBy(wrong).includes('domain'),false);
  assert.equal(Badges.earnedBy(wrong).includes('calm'),true);
});
test('badges: all stories are required for the last badge, with any ending',()=>{
  const progress=Badges.createProgress(S.stories.length);
  const ids=S.stories.map(s=>s.id);
  ids.slice(0,-1).forEach(id=>{progress.record(play(id,['open_phone','ignore']));assert.equal(progress.earned.has('all'),false);});
  const last=progress.record(play(ids.at(-1),['open_phone','ignore']));
  assert.ok(last.includes('all'));assert.equal(progress.done.size,8);
});
test('every story with pressure has positive whole minutes and the others have none',()=>{
  const timed=S.stories.filter(s=>s.pressure).map(s=>s.id);
  assert.deepEqual(timed,['blocked-card','safe-transfer','qr-parking','relative-transfer','bank-call','fake-job']);
  for(const story of S.stories)assert.ok(story.pressure===undefined||(Number.isInteger(story.pressure)&&story.pressure>0));
  for(const badge of Badges.badges){assert.ok(badge.name.ru&&badge.name.kk&&badge.text.ru&&badge.text.kk);assert.ok(Badges.icons[badge.icon]);}
});

test('only the bank call is presented as a phone call',()=>{
  assert.deepEqual(S.stories.filter(s=>s.call).map(s=>s.id),['bank-call']);
});
