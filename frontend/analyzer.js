/* Pure local rules. No network, storage, DOM, or model calls. Offsets are UTF-16
 * offsets into the original input, not a normalized/lowercased copy. */
(function (root) {
  'use strict';
  const domains = ['kaspi.kz', 'halykbank.kz', 'homebank.kz', 'bcc.kz', 'forte.kz', 'bankffin.kz', 'jusan.kz', 'egov.kz', 'post.kz', 'airastana.com'];
  const brandNames = [...domains.map(domain=>domain.split('.')[0]),'freedom','halyk','kazpost'];
  const shorteners = new Set(['bit.ly', 'tinyurl.com', 't.co', 'clck.ru', 'cutt.ly']);
  const weights = {secret_request:45, urgency:18, account_threat:22, reward:15, transfer:35,
    payment:17, malformed_url:25, no_https:10, userinfo:30, ip_host:25, local_host:25,
    shortener:18, idn:18, impersonation:45, long_url:8, subdomains:12};
  const textRules = [
    ['urgency', /(?<![\p{L}\p{N}])(?:сроч[\p{L}]*|немедлен[\p{L}]*|urgent|immediately|шұғыл|дереу|қазір|(?:в течение\s+)?\d+\s+(?:минут[\p{L}]*|сағат[\p{L}]*|minutes))(?![\p{L}\p{N}])/giu],
    ['account_threat', /(?<![\p{L}\p{N}])(?:заблокир[\p{L}]*|блокиров[\p{L}]*|suspend[\p{L}]*|бұғат(?:талды|талған|талады|таймыз|тау))(?![\p{L}\p{N}])/giu],
    ['reward', /(?<![\p{L}\p{N}])(?:выигр[\p{L}]*|розыгрыш|ұтып|сыйақы|won\s+(?:a\s+)?prize|claim\s+(?:a\s+)?reward)(?![\p{L}\p{N}])/giu],
    ['payment', /(?:подтвердите\s+(?:плат[её]ж|операцию)|төлемді\s+растаңыз|операцияны\s+растаңыз)/giu],
    ['transfer', /(?:перевед[\p{L}]*|перевести|transfer|аудар[\p{L}]*)[^.!?\n]{0,65}(?:безопасн[\p{L}]*|резервн[\p{L}]*|safe account|secure account|қауіпсіз)|қауіпсіз\s+шотқа[^.!?\n]{0,40}аудар[\p{L}]*/giu]
  ];
  const actionPattern = /(?<![\p{L}\p{N}])(?:сообщи(?:те|ть)?|отправ(?:ьте|ь|ить)|введ(?:ите|и)|ввести|укаж(?:ите|и)|указать|подтверд(?:ите|и|ить)|назов(?:ите|и)|назвать|пришл(?:ите|и)|переда(?:йте|й|ть)|send|enter|share|confirm|provide|жібер(?:іңіз|іңдер)?|енгіз(?:іңіз|іңдер)?|айтыңыз|айтыңдар)(?![\p{L}\p{N}])/giu;
  const secretPattern = /(?<![\p{L}\p{N}])(?:cvv|cvc|парол[\p{L}]*|password|pin|пин|код[\p{L}]*|otp|құпиясөз[\p{L}]*|карт[\p{L}]*|card)(?![\p{L}\p{N}])/giu;
  function matches(text, re) { return [...text.matchAll(new RegExp(re.source, re.flags))]; }
  function negated(text, start, end) {
    return /(?<![\p{L}\p{N}])(?:do not|never|не|никогда|ешқашан)\s*$/iu.test(text.slice(Math.max(0,start-35),start)) ||
      /(?:меңіз|маңыз|паңыз|пеңіз|баңыз|беңіз)/iu.test(text.slice(start,end)) ||
      /^\s+(?:қажет\s+емес|емес|нет|отменена|не\s+нужно)/iu.test(text.slice(end,end+35));
  }
  function oneEdit(a,b) {
    if (Math.abs(a.length-b.length)>1) return false;
    let i=0,j=0,edits=0;
    while(i<a.length && j<b.length) {
      if(a[i]===b[j]) {i++;j++;continue;}
      if(++edits>1)return false;
      if(a.length>=b.length)i++;
      if(b.length>=a.length)j++;
    }
    return edits+(a.length-i)+(b.length-j)<=1;
  }
  const verdict = score => score>=70?'high':score>=35?'suspicious':'low';
  function analyze(text, channel='sms', allowShort=false) {
    if(typeof text!=='string' || text.trim().length<(allowShort?1:3) || text.length>10000) throw new RangeError('content_length');
    if(!['sms','whatsapp','email','url'].includes(channel))throw new RangeError('channel');
    const found = new Map(), urls=[];
    function add(code, source, ranges) {
      const signal=found.get(code)||{code,weight:weights[code],source,matches:[]};
      for(const [start,end] of ranges) {
        if(start<0 || end>text.length || start>=end)throw new RangeError('Invalid evidence range');
        if(!signal.matches.some(m=>m.start===start && m.end===end))signal.matches.push({start,end,text:text.slice(start,end)});
      }
      found.set(code,signal);
    }
    // Highlight only the request verb and data token actually matched. The gap
    // establishes proximity but is not presented as evidence itself.
    const secrets=matches(text,secretPattern);
    for(const action of matches(text,actionPattern)) {
      const a=action.index,b=a+action[0].length;
      if(negated(text,a,b))continue;
      for(const secret of secrets) {
        const c=secret.index,d=c+secret[0].length;
        const gap = a<c ? text.slice(b,c) : text.slice(d,a);
        if(gap.length>65 || /[.!?\n]/u.test(gap))continue;
        add('secret_request','text',[[a,b],[c,d]]);
      }
    }
    for(const [code,re] of textRules)for(const match of matches(text,re)) {
      const start=match.index,end=start+match[0].length;
      if(!negated(text,start,end))add(code,'text',[[start,end]]);
    }
    const urlPattern=/(?:https?:\/\/|www\.)[^\s<>"']+|(?<![\p{L}\p{N}@])(?:[\p{L}\p{N}][\p{L}\p{N}-]*\.)+(?:[a-z]{2,}|қаз)(?:\/[^\s<>"']*)?/giu;
    const rawUrls=channel==='url'?[{0:text.trim(),index:text.indexOf(text.trim())}]:matches(text,urlPattern);
    for(const item of rawUrls) {
      const raw=item[0].replace(/[.,;!?)»]+$/u,''),start=item.index,end=start+raw.length;
      if(!raw)continue;
      let url;
      try {
        // Reject spellings URL() would silently repair: their raw authority
        // cannot be mapped reliably to the parsed host for exact highlighting.
        if(/[\\\s]/u.test(raw)||!/^(?:https?:\/\/)?[^/?#]+/iu.test(raw))throw new Error();
        url=new URL(raw.includes('://')?raw:'https://'+raw);
        if(!['http:','https:'].includes(url.protocol)||/^https?:\/\/[/]/iu.test(raw))throw new Error();
      }
      catch {add('malformed_url','url',[[start,end]]);urls.push({host:raw,known:false,invalid:true});continue;}
      const host=url.hostname.toLowerCase().replace(/\.$/,''), authority=raw.match(/^(?:[a-z]+:\/\/)?([^/?#]+)/iu)[1];
      const authorityStart=start+raw.indexOf(authority),hostPort=authority.slice(authority.lastIndexOf('@')+1);
      const rawHost=hostPort.startsWith('[')?hostPort.slice(0,hostPort.indexOf(']')+1):hostPort.split(':')[0];
      const h=authorityStart+authority.lastIndexOf(hostPort),hostRange=[h,h+rawHost.length];
      const flag=(code,range=hostRange)=>add(code,'url',[range]);
      const known=domains.some(d=>host===d||host.endsWith('.'+d));
      urls.push({host,known,invalid:false});
      if(url.protocol==='http:')flag('no_https',[start,start+5]);
      if(authority.includes('@'))flag('userinfo',[authorityStart,authorityStart+authority.lastIndexOf('@')+1]);
      if(/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)||host.startsWith('['))flag('ip_host');
      if(host==='localhost'||host.endsWith('.local'))flag('local_host');
      if(shorteners.has(host))flag('shortener');
      if(host.split('.').some(s=>s.startsWith('xn--')))flag('idn');
      if(!known && brandNames.some(brand=>host.includes(brand)||host.split('.').some(label=>oneEdit(brand,label))))flag('impersonation');
      if(raw.length>180)flag('long_url',[start,end]);
      if(host.split('.').length>4)flag('subdomains');
    }
    const signals=[...found.values()],score=Math.min(100,signals.reduce((sum,s)=>sum+s.weight,0));
    return {text,channel,score,rules_score:score,verdict:verdict(score),signals,urls};
  }
  function splitDialogue(text) {
    if(typeof text!=='string'||text.length>10000)throw new RangeError('content_length');
    const parts=text.split(/\r?\n[\t ]*\r?\n(?:[\t ]*\r?\n)*/u).filter(part=>part.trim());
    if(parts.length<2||parts.length>20)throw new RangeError('dialogue_count');
    return parts;
  }
  function analyzeDialogue(text,channel='sms') {
    const replies=splitDialogue(text).map(part=>analyze(part,channel==='url'?'sms':channel,true));
    // Distinct rules accumulate across turns; repeating a rule does not inflate risk.
    const byCode=new Map();replies.forEach((reply,index)=>reply.signals.forEach(signal=>{
      if(!byCode.has(signal.code))byCode.set(signal.code,{code:signal.code,weight:signal.weight,source:signal.source,replies:[]});
      byCode.get(signal.code).replies.push(index+1);
    }));
    const signals=[...byCode.values()],score=Math.min(100,signals.reduce((sum,s)=>sum+s.weight,0));
    return {mode:'dialogue',text,channel,score,rules_score:score,verdict:verdict(score),signals,replies,urls:replies.flatMap(r=>r.urls)};
  }
  // Split overlap at every evidence boundary: one character is rendered once.
  function segments(text,signals) {
    const spans=signals.flatMap(s=>(s.matches||[]).map(m=>({...m,code:s.code})));
    const points=[...new Set([0,text.length,...spans.flatMap(s=>[s.start,s.end])])].sort((a,b)=>a-b);
    return points.slice(0,-1).map((start,i)=>({text:text.slice(start,points[i+1]),start,end:points[i+1],codes:[...new Set(spans.filter(s=>s.start<=start&&s.end>=points[i+1]).map(s=>s.code))]}));
  }
  const api={analyze,analyzeDialogue,splitDialogue,segments,weights};
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.QalqanEngine=api;
})(typeof globalThis==='object'?globalThis:this);
