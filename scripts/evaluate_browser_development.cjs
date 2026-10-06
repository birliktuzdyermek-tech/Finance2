'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const E=require('../frontend/analyzer.js');
const fixturePath=path.join(__dirname,'../tests/fixtures/browser-development.json');
function evaluate(dataset){
  const counts={tp:0,tn:0,fp:0,fn:0};
  const cases=dataset.cases.map(item=>{
    const run=()=>item.mode==='dialogue'?E.analyzeDialogue(item.text,item.channel):E.analyze(item.text,item.channel);
    const result=run(),again=run();
    if(JSON.stringify(result)!==JSON.stringify(again))throw new Error('Nondeterministic result: '+item.id);
    for(const reply of result.replies||[result])for(const signal of reply.signals)for(const match of signal.matches){
      if(reply.text.slice(match.start,match.end)!==match.text)throw new Error('Invalid evidence: '+item.id);
    }
    const actualWarning=result.score>=35,outcome=item.authoredWarning?(actualWarning?'tp':'fn'):(actualWarning?'fp':'tn');counts[outcome]++;
    return {...item,score:result.score,actualWarning,outcome,signals:result.signals.map(s=>s.code)};
  });
  return {scope:'current_browser_rules_only',dataset:dataset.name,limitations:dataset.scope,analyzer_version:E.version,
    analyzer_sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../frontend/analyzer.js'),'utf8').replace(/\r\n/g,'\n')).digest('hex'),
    dataset_sha256:crypto.createHash('sha256').update(JSON.stringify(dataset)).digest('hex'),
    decision:'score >= 35; authored labels are development judgments, not real-world ground truth',counts,cases,
    falseAlerts:cases.filter(c=>c.outcome==='fp').map(c=>c.id),misses:cases.filter(c=>c.outcome==='fn').map(c=>c.id)};
}
if(require.main===module){
  const output=process.argv[2]||path.join(__dirname,'../artifacts/browser-development-report.json');
  const report=evaluate(JSON.parse(fs.readFileSync(fixturePath,'utf8')));
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(`${report.cases.length} authored development cases: ${JSON.stringify(report.counts)}; deterministic results and exact evidence checked.\nFalse alerts: ${report.falseAlerts.join(', ')}\nMisses: ${report.misses.join(', ')}\nReport: ${output}`);
}
module.exports={evaluate};
