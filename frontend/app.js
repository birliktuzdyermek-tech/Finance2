'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const names = {analyzer:'Анализатор',dashboard:'Обзор угроз',history:'История проверок',research:'Модель и метрики',settings:'О проекте'};
const verdicts = {low:'Низкий риск',suspicious:'Подозрительно',high:'Высокий риск'};
const channels = {sms:'SMS',whatsapp:'WhatsApp',email:'Email',url:'Ссылка'};
let channel='sms', historyItems=[], busy=false, toastTimer, routeVersion=0;
function node(tag,text,cls) { const n=document.createElement(tag); if(text!=null)n.textContent=text; if(cls)n.className=cls; return n; }
function toast(message) { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>{$('#toast').hidden=true;},5000); }
async function api(path,options={}) {
  const r=await fetch('/api/'+path,{credentials:'same-origin',...options});
  if(!r.ok) { let message='Ошибка сервера. Попробуйте ещё раз.'; try{const e=await r.json();message=typeof e.detail==='string'?e.detail:'Проверьте данные: от 3 до 10 000 символов.';}catch(_){} if(r.status===429)message='Лимит проверок. Подождите минуту и повторите.';throw new Error(message); }
  return r.status===204?null:r.json();
}
function setChannel(value) {
  channel=value;
  $$('[data-channel]').forEach(b=>{b.classList.toggle('selected',b.dataset.channel===value);b.setAttribute('aria-pressed',String(b.dataset.channel===value));});
  $('#content-label').textContent=value==='url'?'Ссылка для проверки':'Текст сообщения';
  $('#content').placeholder=value==='url'?'https://example.com':'Например: «Ваш счёт будет заблокирован. Срочно подтвердите данные по ссылке…»';
}
function renderResult(r) {
  $('#result-empty').hidden=true;$('#result-content').hidden=false;$('#result-status').textContent='Проверка завершена';
  $('#risk-score').textContent=r.score;$('#risk-circle').className='risk-circle '+r.verdict;
  $('#risk-verdict').className='pill '+r.verdict;$('#risk-verdict').textContent=verdicts[r.verdict];
  $('#risk-title').textContent={high:'Обнаружены признаки угрозы',suspicious:'Стоит проверить внимательнее',low:'Мало явных признаков риска'}[r.verdict];
  $('#rules-score').textContent=r.rules_score+' / 100';$('#ml-score').textContent=r.ml_score===null?'Не применяется':r.ml_score+' / 100';$('#duration').textContent=r.duration_ms+' мс';
  $('#signals').replaceChildren(...r.signals.map(s=>{const row=node('div',null,'signal-row');row.append(node('span','!'),node('span',s.title),node('span','+'+s.weight,'signal-weight'));return row;}));
  if(!r.signals.length)$('#signals').append(node('p','Эвристические признаки не обнаружены. ML оценивает сходство с обучающими примерами; это не гарантия безопасности.','card-description'));
  $('#url-results').replaceChildren(...r.urls.map(u=>node('div',u.host+(u.official?' · домен в демонстрационном справочнике':' · вне справочника банков'),'url-row')));
  $('#advice').textContent=r.advice;$('#download-report').href='/api/reports/'+encodeURIComponent(r.id)+'.pdf';
}
function stat(label,value,detail,cls='') { const n=node('article',null,'stat '+cls);n.append(node('span',label),node('strong',value),node('small',detail));return n; }
function empty(target,message) { target.replaceChildren(node('div',message,'empty-state')); }
function table(items,limit=200) {
  const wrap=node('div',null,'table-wrap');if(!items.length){empty(wrap,'Проверок пока нет. Начните с анализатора.');return wrap;}
  const t=node('table'),head=node('thead'),hr=node('tr'),body=node('tbody');
  ['Дата и время','Источник','Риск-балл','Вердикт','Отчёт'].forEach(v=>hr.append(node('th',v)));head.append(hr);
  items.slice(0,limit).forEach(item=>{
    const row=node('tr');row.append(node('td',new Date(item.created_at).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})),node('td',channels[item.channel]));
    const sc=node('td'),open=node('button',item.score+' / 100','history-open');open.type='button';open.addEventListener('click',()=>{renderResult(item);location.hash='analyzer';});sc.append(open);
    const vc=node('td');vc.append(node('span',verdicts[item.verdict],'pill '+item.verdict));
    const rc=node('td'),link=node('a','PDF ↓');link.href='/api/reports/'+encodeURIComponent(item.id)+'.pdf';rc.append(link);row.append(sc,vc,rc);body.append(row);
  });t.append(head,body);wrap.append(t);return wrap;
}
function dailyChart(items) {
  const target=$('#daily-chart');target.replaceChildren();if(!items.length){empty(target,'График появится после первой проверки.');return;}
  function svg(tag,attrs,text){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));if(text!==undefined)n.textContent=text;return n;}
  const chart=svg('svg',{viewBox:'0 0 440 195',role:'img','aria-label':'Количество проверок по дням'}),selected=items.slice(-7),max=Math.max(...selected.map(i=>i[1]),1);
  chart.append(svg('line',{x1:15,y1:156,x2:425,y2:156}));
  selected.forEach(([date,count],i)=>{const step=400/selected.length,x=20+i*step,h=count/max*120;chart.append(svg('rect',{x:x+step*.15,y:156-h,width:step*.7,height:h,rx:4}),svg('text',{x:x+step/2,y:145-h,'text-anchor':'middle'},count),svg('text',{x:x+step/2,y:181,'text-anchor':'middle'},date.slice(5).replace('-','.')));});target.append(chart);
}
function typesChart(items) {
  const target=$('#types-chart');target.replaceChildren();if(!items.length){empty(target,'Найденных признаков пока нет.');return;}
  const max=Math.max(...items.map(i=>i[1]));items.slice(0,6).forEach(([title,count])=>{const row=node('div',null,'bar-row'),label=node('div',null,'bar-label'),bar=node('progress');label.append(node('span',title),node('strong',count));bar.max=max;bar.value=count;bar.setAttribute('aria-label',title+': '+count);row.append(label,bar);target.append(row);});
}
async function dashboard(version) {
  const [d,h]=await Promise.all([api('dashboard'),api('history')]);if(version!==routeVersion)return;
  $('#dashboard-stats').replaceChildren(stat('Всего проверок',d.total,'Только текущая сессия'),stat('Высокий риск',d.counts.high,'Требуют внимания','high'),stat('Подозрительно',d.counts.suspicious,'Нужна дополнительная проверка','suspicious'),stat('Среднее время',d.average_ms+' мс','Анализ, без HTTP и сохранения'));
  dailyChart(d.daily);typesChart(d.types);$('#recent-checks').replaceChildren(table(h.items,5));
}
function renderHistory() {const filter=$('#history-filter').value;$('#history-list').replaceChildren(table(historyItems.filter(i=>filter==='all'||i.verdict===filter)));}
function detail(label,value) {const n=node('div',null,'detail-row');n.append(node('span',label),node('strong',value));return n;}
async function research(version) {
  const d=await api('metrics');if(version!==routeVersion)return;if(d.status!=='evaluated'){empty($('#research-metrics'),'Эксперимент ещё не выполнен.');return;}
  const m=d.hybrid,p=v=>(v*100).toFixed(1)+'%';
  $('#research-metrics').replaceChildren(stat('Precision',p(m.precision),'Hybrid · synthetic test'),stat('Recall',p(m.recall),'Hybrid · synthetic test'),stat('F1-score',m.f1.toFixed(3),'Hybrid · synthetic test'),stat('ROC-AUC',m.roc_auc.toFixed(3),'На малом синтетическом наборе'));
  $('#dataset-details').replaceChildren(detail('Обучение / тест',d.train_rows+' / '+d.test_rows+' строк'),detail('Независимые шаблоны',d.train_groups+' / '+d.test_groups),detail('Языки','RU · KZ · EN'),detail('Разделение','По группам шаблонов'),detail('FPR · hybrid',p(m.false_positive_rate)),detail('p95 · inference',d.latency_ms.p95+' мс'));
  const wrap=node('div',null,'table-wrap'),t=node('table'),head=node('thead'),hr=node('tr'),body=node('tbody');
  ['Метод','Precision','Recall','F1','ROC-AUC','FPR'].forEach(v=>hr.append(node('th',v)));head.append(hr);
  [['rules','Правила'],['ml','ML baseline'],['hybrid','Hybrid (приложение)']].forEach(([key,title])=>{const row=node('tr'),r=d[key];[title,p(r.precision),p(r.recall),r.f1.toFixed(3),r.roc_auc.toFixed(3),p(r.false_positive_rate)].forEach(v=>row.append(node('td',v)));body.append(row);});
  t.append(head,body);wrap.append(t);$('#method-comparison').replaceChildren(wrap,node('p','На простых синтетических сценариях правила могут превосходить ML. Для выводов об эффективности требуется новый независимый набор данных.','card-description'));
}
async function route() {
  const value=location.hash.slice(1),view=names[value]?value:'analyzer',version=++routeVersion;
  $$('.view').forEach(s=>{s.hidden=s.id!=='view-'+view;});$$('[data-view]').forEach(a=>{a.classList.toggle('active',a.dataset.view===view);a.setAttribute('aria-current',a.dataset.view===view?'page':'false');});$('#page-name').textContent=names[view];
  try {if(view==='dashboard')await dashboard(version);if(view==='history'){const d=await api('history');if(version===routeVersion){historyItems=d.items;renderHistory();}}if(view==='research')await research(version);}catch(e){toast(e.message||'API недоступен.');}
}
$$('[data-channel]').forEach(b=>b.addEventListener('click',()=>setChannel(b.dataset.channel)));
$('#content').addEventListener('input',()=>{$('#char-count').textContent=$('#content').value.length.toLocaleString('ru-RU')+' / 10 000';});
const samples={phishing:{channel:'sms',text:'Срочно! Ваш счёт будет заблокирован. Введите код из SMS и CVV карты для проверки на http://kaspi-verify.example/login'},safe:{channel:'sms',text:'Покупка на 3 500 ₸. Чек доступен в приложении банка.'},url:{channel:'url',text:'https://kaspi.kz.verify.example/confirm'}};
$$('[data-sample]').forEach(b=>b.addEventListener('click',()=>{const s=samples[b.dataset.sample];setChannel(s.channel);$('#content').value=s.text;$('#content').dispatchEvent(new Event('input'));$('#content').focus();}));
$('#analysis-form').addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;const content=$('#content').value.trim();if(content.length<3){toast('Введите минимум 3 символа.');return;}
  busy=true;$('#analyze-button').disabled=true;$('#analyze-button').setAttribute('aria-busy','true');$('#result-status').textContent='Анализируем…';$('#form-error').hidden=true;
  try{renderResult(await api('analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content,channel})}));}
  catch(e){$('#form-error').textContent=e.message||'API недоступен.';$('#form-error').hidden=false;$('#result-status').textContent='Ошибка проверки';}
  finally{busy=false;$('#analyze-button').disabled=false;$('#analyze-button').setAttribute('aria-busy','false');}
});
$('#history-filter').addEventListener('change',renderHistory);
$('#clear-history').addEventListener('click',async()=>{
  if(!historyItems.length){toast('История уже пустая.');return;}if(!window.confirm('Удалить результаты и PDF-отчёты текущей сессии?'))return;
  try{await api('history',{method:'DELETE'});historyItems=[];renderHistory();$('#result-content').hidden=true;$('#result-empty').hidden=false;$('#result-status').textContent='Ожидает проверки';toast('История удалена.');}catch(e){toast(e.message);}
});
window.addEventListener('hashchange',route);
(async()=>{
  try{
    const health=await api('health');$('#connection-status').textContent='API подключён';
    if(health.history_persistence==='ephemeral'){
      $('#history-retention').textContent='До 200 результатов в личной сессии. История в демо временная и может исчезнуть при перезапуске сервиса. Сохраните нужные PDF-отчёты.';
    }
  }catch(_){$('#connection-status').textContent='API недоступен';toast('Сервер недоступен. Обновите страницу после его запуска.');}
  await route();
})();
