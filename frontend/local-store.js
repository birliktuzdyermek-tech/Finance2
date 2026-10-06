/* All message-related operations remain in memory, including legacy UI flows. */
window.QalqanStore = (() => {
  const E=window.QalqanEngine, I=window.QalqanI18n;
  let items=[],sequence=0;
  const brands=[['Kaspi','kaspi'],['Halyk','halyk'],['Freedom','freedom'],['Jusan','jusan'],['Forte','forte'],['eGov','egov'],['Казпочта','kazpost'],['Air Astana','airastana']];
  const advice='Проверьте информацию отдельно через официальный канал банка. Не сообщайте коды, PIN и CVV.';
  const limitation='Qalqan не подтверждает подлинность отправителя и сайта. Правила могут ошибаться; низкий балл не гарантирует безопасность.';
  const schemes=[
    ['family','Родственник в беде',/сын|доч[\p{L}]*|родствен[\p{L}]*|мама.{0,40}(?:срочно|помоги)|son.{0,30}trouble|бала[\p{L}]*.{0,30}көмек/iu],
    ['delivery','Фальшивый курьер',/курьер|посыл[\p{L}]*|достав[\p{L}]*|parcel|delivery|жеткіз[\p{L}]*/iu],
    ['prize','Выигрыш или приз',/выигр[\p{L}]*|приз[\p{L}]*|розыгрыш|prize|reward|ұтып/iu],
    ['investment','Фейковые инвестиции',/инвест[\p{L}]*|доход.{0,30}гарант|investment|guaranteed.{0,30}profit|инвестиция/iu],
    ['government','Пособие или выплата',/пособ[\p{L}]*|субсид[\p{L}]*|государствен[\p{L}]*.{0,30}выплат|egov|жәрдемақы/iu],
    ['job','Фальшивая работа',/работ[\p{L}]*|ваканси[\p{L}]*|зарплат[\p{L}]*|job offer|жұмыс/iu],
    ['bank_support','Служба безопасности банка',/банк[\p{L}]*|сч[её]т|карт[\p{L}]*|bank|account|card|шот|cvv/iu]
  ];
  function decorate(r) {
    r.signals.forEach(s=>Object.defineProperty(s,'title',{get:()=>I.rule(s.code),configurable:true}));
    r.urls.forEach(u=>{u.official=u.known;u.brand_matches=u.known?[]:brands.filter(([,part])=>u.host.includes(part)).map(([name])=>name);u.signals=r.signals.filter(s=>s.source==='url'&&(s.matches||[]).some(m=>u.host.includes(m.text.toLowerCase())||r.urls.length===1));});
    r.replies?.forEach(decorate);
    r.ml_score=null;r.limitations=[limitation];r.scheme={code:'unknown',title:'Тип схемы не определён'};
    // A category is an explanatory hint and never changes the score/evidence.
    const category=r.verdict!=='low'&&schemes.find(([,title,re])=>re.test(r.text));
    if(category)r.scheme={code:category[0],title:category[1]};
    Object.defineProperty(r,'advice',{get:()=>I.t(advice),configurable:true});
    return r;
  }
  function analyze(data) {
    const start=performance.now();let r;
    try {r=data.mode==='dialogue'?E.analyzeDialogue(data.content,data.channel):E.analyze(data.content,data.channel);}
    catch(e){throw new Error(I.t(e.message==='dialogue_count'?'Для диалога нужны 2–20 реплик, разделённых пустой строкой.':'Введите от 3 до 10 000 символов.'));}
    decorate(r);r.id='local-'+(++sequence);r.created_at=new Date().toISOString();r.duration_ms=+(performance.now()-start).toFixed(2);
    items.unshift(r);items=items.slice(0,200);return r;
  }
  function dashboard() {
    const counts={high:0,suspicious:0,low:0},channels={},daily=new Map(),types=new Map(),categories=new Map();
    for(const item of items){counts[item.verdict]++;channels[item.channel]=(channels[item.channel]||0)+1;const date=item.created_at.slice(0,10);daily.set(date,(daily.get(date)||0)+1);item.signals.forEach(s=>types.set(s.title,(types.get(s.title)||0)+1));if(item.scheme.code!=='unknown')categories.set(item.scheme.title,(categories.get(item.scheme.title)||0)+1);}
    return {total:items.length,counts,channels,daily:[...daily].sort(),types:[...types].sort((a,b)=>b[1]-a[1]),schemes:[...categories]};
  }
  function handles(path){return ['analyze','analyze/batch','history','dashboard','health'].includes(path)||/^checks\/[^/]+\/feedback$/.test(path);}
  function request(path,options={}) {
    const data=options.body?JSON.parse(options.body):{};
    if(path==='analyze')return analyze(data);
    if(path==='analyze/batch'){
      if(!Array.isArray(data.items)||data.items.length<1||data.items.length>10)throw new Error('Добавьте от 1 до 10 записей.');
      // Validate the complete batch before adding any result to history.
      data.items.forEach(item=>E.analyze(item.content,item.channel));
      const results=data.items.map(analyze),counts={high:0,suspicious:0,low:0};results.forEach(r=>counts[r.verdict]++);
      return {items:results,total:results.length,counts};
    }
    if(path==='history'){if(options.method==='DELETE'){items=[];return null;}return {items:[...items]};}
    if(path==='dashboard')return dashboard();
    if(path==='health')return {status:'ok',history_persistence:'tab'};
    if(/^checks\/[^/]+\/feedback$/.test(path)){const item=items.find(r=>r.id===path.split('/')[1]);if(item)item.feedback=data.vote;return {message:I.t('Отзыв сохранён только в этой вкладке.')};}
    throw new Error('Unsupported local operation');
  }
  return {handles,request};
})();
