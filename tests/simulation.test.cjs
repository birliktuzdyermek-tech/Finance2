const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../frontend/simulation-engine.js'),E=require('../frontend/analyzer.js');

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
