'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const I=window.QalqanI18n, E=window.QalqanEngine, t=I.t;
const names={analyzer:'Анализатор',dashboard:'Обзор угроз',history:'История проверок',research:'Архив эксперимента',settings:'О проекте'};
const verdicts={low:'Низкий риск',suspicious:'Подозрительно',high:'Высокий риск'};
const channels={sms:'SMS',whatsapp:'WhatsApp',email:'Email',url:'Ссылка'};
let channel='sms', mode='single', incident='received', historyItems=[], lastResult=null, sequence=0, toastTimer, routeVersion=0, metrics=null;
I.capture();
function node(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
function toast(message){$('#toast').textContent=t(message);$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('#toast').hidden=true;},5000);}
function setInput(){
  $$('[data-channel]').forEach(b=>{b.classList.toggle('selected',b.dataset.channel===channel);b.setAttribute('aria-pressed',String(b.dataset.channel===channel));b.disabled=mode==='dialogue'&&b.dataset.channel==='url';});
  $$('[data-mode]').forEach(b=>{b.classList.toggle('selected',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
  $('#dialogue-hint').hidden=mode!=='dialogue';
  $('#content-label').textContent=t(mode==='dialogue'?'Реплики диалога':channel==='url'?'Ссылка для проверки':'Текст сообщения');
  $('#content').placeholder=mode==='dialogue'?t('Банк: Карта заблокирована.\n\nЯ: Что делать?\n\nБанк: Введите SMS-код по ссылке.'):channel==='url'?'https://example.com':t('Например: «Ваш счёт будет заблокирован. Срочно подтвердите данные по ссылке…»');
}
function setChannel(value){channel=value;setInput();}
function clearResult(){lastResult=null;$('#result-content').hidden=true;$('#result-empty').hidden=false;$('#result-status').textContent=t('Ожидает проверки');$('#message-evidence').replaceChildren();}
function evidenceCard(result,index){
  const card=node('section',null,'evidence-card');
  if(index!==null){const heading=node('h3',t('Реплика')+' '+(index+1));heading.append(node('span',t(verdicts[result.verdict])+' · '+result.score+' / 100','pill '+result.verdict));card.append(heading);}
  card.append(node('h4',t('Проверенный текст')));
  const original=node('div',null,'marked-message');
  for(const segment of E.segments(result.text,result.signals)){
    if(!segment.codes.length){original.append(document.createTextNode(segment.text));continue;}
    const mark=node('mark',segment.text);mark.title=segment.codes.map(I.rule).join('; ');original.append(mark);
  }
  card.append(original);
  if(result.signals.length){
    card.append(node('h4',t('Точные фрагменты и причины')));
    const list=node('ul',null,'evidence-list');
    for(const signal of result.signals)for(const match of signal.matches){const row=node('li');row.append(node('q',match.text),document.createTextNode(' — '+I.rule(signal.code)));list.append(row);}
    card.append(list);
  }else card.append(node('p',t('Явных признаков не найдено. Это не гарантия безопасности.'),'card-description'));
  return card;
}
function renderResult(result){
  lastResult=result;
  $('#result-empty').hidden=true;$('#result-content').hidden=false;$('#result-status').textContent=t('Проверка завершена');
  $('#risk-score').textContent=result.score;$('#risk-circle').className='risk-circle '+result.verdict;
  $('#risk-verdict').className='pill '+result.verdict;$('#risk-verdict').textContent=t(verdicts[result.verdict]);
  $('#risk-title').textContent=t({high:'Обнаружены признаки угрозы',suspicious:'Стоит проверить внимательнее',low:'Мало явных признаков риска'}[result.verdict]);
  $('#rules-score').textContent=result.rules_score+' / 100';$('#duration').textContent=result.duration_ms+' мс';
  $('#dialogue-summary').hidden=result.mode!=='dialogue';
  $('#signals').replaceChildren(...result.signals.map(s=>{const row=node('div',null,'signal-row');row.append(node('span','!'),node('span',I.rule(s.code)),node('span','+'+s.weight,'signal-weight'));return row;}));
  if(!result.signals.length)$('#signals').append(node('p',t('Явных признаков не найдено. Это не гарантия безопасности.'),'card-description'));
  $('#message-evidence').replaceChildren(...(result.replies?result.replies.map((r,i)=>evidenceCard(r,i)):[evidenceCard(result,null)]));
  $('#url-results').replaceChildren(...result.urls.map(u=>node('div',(u.invalid?t('Некорректный URL'):u.host)+' · '+t(u.known?'Домен в демонстрационном списке; подлинность не подтверждена':'Домен вне демонстрационного списка'),'url-row')));
  $('#advice').textContent=t(result.verdict==='high'?'Не вводите данные и не переводите деньги. Свяжитесь с банком через его официальное приложение или номер на карте.':'Проверьте информацию отдельно через официальный канал банка. Не сообщайте коды, PIN и CVV.');
}
function renderIncident(){
  $('#incident-options').replaceChildren(...Object.entries(I.incident).map(([key,item])=>{const button=node('button',t(item.label));button.type='button';button.dataset.incident=key;button.setAttribute('aria-pressed',String(key===incident));button.addEventListener('click',()=>{incident=key;renderIncident();});return button;}));
  $('#incident-steps').replaceChildren(...I.incident[incident].steps.map(step=>node('li',t(step))));
}
function stat(label,value,description,cls=''){const n=node('article',null,'stat '+cls);n.append(node('span',t(label)),node('strong',value),node('small',t(description)));return n;}
function empty(target,message){target.replaceChildren(node('div',t(message),'empty-state'));}
function printResult(item){location.hash='analyzer';route();renderResult(item);window.print();}
function table(items,limit=200){
  const wrap=node('div',null,'table-wrap');if(!items.length){empty(wrap,'Проверок пока нет. Начните с анализатора.');return wrap;}
  const table=node('table'),head=node('thead'),hr=node('tr'),body=node('tbody');
  ['Дата и время','Источник','Риск-балл','Вердикт','Отчёт'].forEach(value=>hr.append(node('th',t(value))));head.append(hr);
  items.slice(0,limit).forEach(item=>{
    const row=node('tr');row.append(node('td',new Date(item.created_at).toLocaleString(I.locale(),{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})),node('td',item.mode==='dialogue'?t('Диалог'):t(channels[item.channel])));
    const score=node('td'),open=node('button',item.score+' / 100','history-open');open.type='button';open.addEventListener('click',()=>{location.hash='analyzer';renderResult(item);});score.append(open);
    const label=node('td');label.append(node('span',t(verdicts[item.verdict]),'pill '+item.verdict));
    const report=node('td'),button=node('button',t('Печать / PDF'),'history-open');button.type='button';button.addEventListener('click',()=>printResult(item));report.append(button);row.append(score,label,report);body.append(row);
  });table.append(head,body);wrap.append(table);return wrap;
}
function dailyChart(items){
  const target=$('#daily-chart');target.replaceChildren();if(!items.length){empty(target,'График появится после первой проверки.');return;}
  function svg(tag,attrs,text){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));if(text!==undefined)n.textContent=text;return n;}
  const chart=svg('svg',{viewBox:'0 0 440 195',role:'img','aria-label':t('Количество проверок по дням')}),selected=items.slice(-7),max=Math.max(...selected.map(i=>i[1]),1);
  chart.append(svg('line',{x1:15,y1:156,x2:425,y2:156}));
  selected.forEach(([date,count],i)=>{const step=400/selected.length,x=20+i*step,h=count/max*120;chart.append(svg('rect',{x:x+step*.15,y:156-h,width:step*.7,height:h,rx:4}),svg('text',{x:x+step/2,y:145-h,'text-anchor':'middle'},count),svg('text',{x:x+step/2,y:181,'text-anchor':'middle'},date.slice(5).replace('-','.')));});target.append(chart);
}
function typesChart(items){
  const target=$('#types-chart');target.replaceChildren();if(!items.length){empty(target,'Найденных признаков пока нет.');return;}
  const max=Math.max(...items.map(i=>i[1]));items.slice(0,6).forEach(([code,count])=>{const row=node('div',null,'bar-row'),label=node('div',null,'bar-label'),bar=node('progress');label.append(node('span',I.rule(code)),node('strong',count));bar.max=max;bar.value=count;bar.setAttribute('aria-label',I.rule(code)+': '+count);row.append(label,bar);target.append(row);});
}
function dashboard(){
  const counts={high:0,suspicious:0,low:0},daily=new Map(),types=new Map();
  historyItems.forEach(item=>{counts[item.verdict]++;const date=item.created_at.slice(0,10);daily.set(date,(daily.get(date)||0)+1);item.signals.forEach(s=>types.set(s.code,(types.get(s.code)||0)+1));});
  const mean=(historyItems.reduce((sum,item)=>sum+item.duration_ms,0)/Math.max(1,historyItems.length)).toFixed(2);
  $('#dashboard-stats').replaceChildren(stat('Всего проверок',historyItems.length,'Только эта вкладка'),stat('Высокий риск',counts.high,'Требуют внимания','high'),stat('Подозрительно',counts.suspicious,'Нужна дополнительная проверка','suspicious'),stat('Среднее время',mean+' мс','Локальный анализ'));
  dailyChart([...daily].sort());typesChart([...types].sort((a,b)=>b[1]-a[1]));$('#recent-checks').replaceChildren(table(historyItems,5));
}
function renderHistory(){const filter=$('#history-filter').value;$('#history-list').replaceChildren(table(historyItems.filter(i=>filter==='all'||i.verdict===filter)));}
function detail(label,value){const n=node('div',null,'detail-row');n.append(node('span',t(label)),node('strong',value));return n;}
async function research(version){
  // Only fixed non-user research data is requested. Never transmit content,
  // actions or results, including through URLs, analytics or storage APIs.
  if(!metrics){const response=await fetch('/api/metrics',{credentials:'omit'});if(!response.ok)throw new Error('metrics');metrics=await response.json();}
  if(version!==routeVersion)return;const d=metrics;if(d.status!=='evaluated'){empty($('#research-metrics'),'Эксперимент ещё не выполнен.');return;}
  const m=d.hybrid,p=value=>(value*100).toFixed(1)+'%';
  $('#research-metrics').replaceChildren(stat('Precision',p(m.precision),'Архив · синтетический тест'),stat('Recall',p(m.recall),'Архив · синтетический тест'),stat('F1-score',m.f1.toFixed(3),'Архив · синтетический тест'),stat('ROC-AUC',m.roc_auc.toFixed(3),'На малом синтетическом наборе'));
  $('#dataset-details').replaceChildren(detail('Обучение / тест',d.train_rows+' / '+d.test_rows),detail('Независимые шаблоны',d.train_groups+' / '+d.test_groups),detail('Языки','RU · KZ · EN'),detail('Разделение',t('По группам шаблонов')),detail('FPR · hybrid',p(m.false_positive_rate)),detail('p95 · inference',d.latency_ms.p95+' мс'));
  const wrap=node('div',null,'table-wrap'),table=node('table'),head=node('thead'),hr=node('tr'),body=node('tbody');
  ['Метод','Precision','Recall','F1','ROC-AUC','FPR'].forEach(value=>hr.append(node('th',t(value))));head.append(hr);
  [['rules','Правила'],['ml','ML baseline'],['hybrid','Hybrid (архив)']].forEach(([key,title])=>{const row=node('tr'),r=d[key];[t(title),p(r.precision),p(r.recall),r.f1.toFixed(3),r.roc_auc.toFixed(3),p(r.false_positive_rate)].forEach(value=>row.append(node('td',value)));body.append(row);});table.append(head,body);wrap.append(table);$('#method-comparison').replaceChildren(wrap);
}
async function route(){
  const value=location.hash.slice(1),view=names[value]?value:'analyzer',version=++routeVersion;
  $$('.view').forEach(s=>{s.hidden=s.id!=='view-'+view;});$$('[data-view]').forEach(a=>{a.classList.toggle('active',a.dataset.view===view);a.setAttribute('aria-current',a.dataset.view===view?'page':'false');});$('#page-name').textContent=t(names[view]);
  if(view==='dashboard')dashboard();if(view==='history')renderHistory();
  if(view==='research')try{await research(version);}catch{if(version===routeVersion)empty($('#research-metrics'),'Архив метрик сейчас недоступен. Локальная проверка работает.');}
}
const samples={
  ru:{phishing:{channel:'sms',text:'Срочно! Ваш счёт будет заблокирован. Введите код из SMS и CVV карты для проверки на http://kaspi-verify.example/login'},safe:{channel:'sms',text:'Покупка на 3 500 ₸. Чек доступен в приложении банка.'},url:{channel:'url',text:'https://kaspi.kz.verify.example/confirm'}},
  kk:{phishing:{channel:'sms',text:'Шұғыл! Шотыңыз бұғатталады. SMS кодты және CVV енгізіңіз: http://kaspi-verify.example/login'},safe:{channel:'sms',text:'3 500 ₸ сомасына сатып алу. Түбіртек банк қосымшасында.'},url:{channel:'url',text:'https://kaspi.kz.verify.example/confirm'}}
};
$$('[data-channel]').forEach(b=>b.addEventListener('click',()=>setChannel(b.dataset.channel)));
$$('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;if(mode==='dialogue'&&channel==='url')channel='sms';setInput();$('#form-error').hidden=true;}));
$('#content').addEventListener('input',()=>{$('#char-count').textContent=$('#content').value.length.toLocaleString(I.locale())+' / 10 000';$('#form-error').hidden=true;});
$$('[data-sample]').forEach(b=>b.addEventListener('click',()=>{const sample=samples[I.language()][b.dataset.sample];mode='single';setChannel(sample.channel);$('#content').value=sample.text;$('#content').dispatchEvent(new Event('input'));$('#content').focus();}));
$('#analysis-form').addEventListener('submit',event=>{
  event.preventDefault();$('#form-error').hidden=true;
  try{
    const started=performance.now(),text=$('#content').value;
    const result=mode==='dialogue'?E.analyzeDialogue(text,channel):{...E.analyze(text,channel),mode:'single'};
    Object.assign(result,{id:++sequence,created_at:new Date().toISOString(),duration_ms:Number((performance.now()-started).toFixed(2))});
    historyItems.unshift(result);historyItems=historyItems.slice(0,200);renderResult(result);
  }catch(error){$('#form-error').textContent=t(error.message==='dialogue_count'?'Для диалога нужны 2–20 реплик, разделённых пустой строкой.':'Введите от 3 до 10 000 символов.');$('#form-error').hidden=false;$('#result-status').textContent=t('Ошибка проверки');}
});
$('#download-report').addEventListener('click',()=>{if(lastResult)printResult(lastResult);});
$('#history-filter').addEventListener('change',renderHistory);
$('#clear-history').addEventListener('click',()=>{if(!historyItems.length){toast('История уже пустая.');return;}if(!window.confirm(t('Удалить результаты из памяти этой вкладки?')))return;historyItems=[];renderHistory();clearResult();$('#content').value='';$('#content').dispatchEvent(new Event('input'));toast('История удалена.');});
$$('[data-language]').forEach(button=>button.addEventListener('click',()=>{I.set(button.dataset.language);$$('[data-language]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.language===I.language())));setInput();renderIncident();if(lastResult)renderResult(lastResult);else $('#result-status').textContent=t('Ожидает проверки');$('#form-error').hidden=true;$('#toast').hidden=true;route();}));
window.addEventListener('hashchange',route);
setInput();renderIncident();route();
