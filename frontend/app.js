'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const names = {home:'Главная',result:'Результат проверки',brand:'Проверка бренда',schemes:'Типы схем',telegram:'Telegram · скоро',guide:'Первый визит',glossary:'Словарь',presentation:'Презентация',states:'Помощь при ошибке',demo:'Демо для жюри',analyzer:'Анализатор',batch:'Пакетная проверка',dashboard:'Обзор угроз',history:'История проверок',compare:'Сравнение',research:'Модель и метрики',account:'Аккаунт',privacy:'Данные и приватность',settings:'О проекте'};
const verdicts = {low:'Низкий риск',suspicious:'Подозрительно',high:'Высокий риск'};
const channels = {sms:'SMS',whatsapp:'WhatsApp',email:'Email',url:'Ссылка'};
let channel='sms', historyItems=[], busy=false, toastTimer, routeVersion=0;
let historyPage=1;
const selectedChecks=new Set(), pageSize=20;
let authChallenge=null,authBusy=false,authDeliveryAvailable=false;
let activeResultId=null,activeResult=null,activeSourceText="";
let presentationSlide=0,selectedScheme="bank_support";
let currentView='';
function node(tag,text,cls) { const n=document.createElement(tag); if(text!=null)n.textContent=text; if(cls)n.className=cls; return n; }
function toast(message) { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>{$('#toast').hidden=true;},5000); }
async function api(path,options={}) {
  let r;try{r=await fetch('/api/'+path,{credentials:'same-origin',...options});}catch(_){throw new Error('Сервер недоступен. Проверьте соединение и попробуйте ещё раз.');}
  if(!r.ok) { let message='Ошибка сервера. Попробуйте ещё раз.'; try{const e=await r.json();if(typeof e.detail==='string')message=e.detail;else if(Array.isArray(e.detail)){const fields={email:'Проверьте адрес электронной почты.',consent:'Подтвердите согласие на обработку данных.',email_code:'Код из письма должен содержать 6 цифр.',content:'Каждая запись — от 3 до 10 000 символов.',items:'Добавьте от 1 до 10 записей.',channel:'Выберите источник сообщения.'};message=[...new Set(e.detail.map(v=>fields[v.loc?.at(-1)]||'Проверьте данные формы.'))].join(' ');}}catch(_){}const retry=Number(r.headers.get('Retry-After'));if(r.status===429&&retry>0)message='Лимит запросов. Повторите через '+(retry>60?Math.ceil(retry/60)+' мин.':retry+' сек.');throw new Error(message); }
  return r.status===204?null:r.json();
}
function setChannel(value) {
  channel=value;
  $$('[data-channel]').forEach(b=>{b.classList.toggle('selected',b.dataset.channel===value);b.setAttribute('aria-pressed',String(b.dataset.channel===value));});
  $('#content-label').textContent=value==='url'?'Ссылка для проверки':'Текст сообщения';
  $('#content').placeholder=value==='url'?'https://example.com':'Например: «Ваш счёт будет заблокирован. Срочно подтвердите данные по ссылке…»';
}
function renderResult(r,sourceText="") {
  activeResult=r;activeSourceText=sourceText;renderAnnotatedText(sourceText,r);
  activeResultId=r.id;$('#feedback-consent').checked=false;$('#feedback-status').textContent='';
  $('#result-empty').hidden=true;$('#result-content').hidden=false;$('#result-status').textContent='Проверка завершена';
  $('#risk-score').textContent=r.score;$('#risk-circle').className='risk-circle '+r.verdict;
  $('#risk-verdict').className='pill '+r.verdict;$('#risk-verdict').textContent=verdicts[r.verdict];
  $('#risk-title').textContent={high:'Обнаружены признаки угрозы',suspicious:'Стоит проверить внимательнее',low:'Мало явных признаков риска'}[r.verdict];
  $('#rules-score').textContent=r.rules_score+' / 100';$('#ml-score').textContent=r.ml_score===null?'Не применяется':r.ml_score+' / 100';$('#duration').textContent=r.duration_ms+' мс';
  $('#signals').replaceChildren(...r.signals.map(s=>{const row=node('div',null,'signal-row');row.append(node('span',s.source==='url'?'⌁':'◷'),node('span',s.title),node('span','+'+s.weight,'signal-weight'));return row;}));
  if(!r.signals.length)$('#signals').append(node('p','Эвристические признаки не обнаружены. ML оценивает сходство с обучающими примерами; это не гарантия безопасности.','card-description'));
  $('#url-results').replaceChildren(...r.urls.map(u=>node('div',u.host+(u.official?' · домен в демонстрационном справочнике':' · вне справочника банков'),'url-row')));
  $('#advice').textContent=r.advice;$('#download-report').href='/api/reports/'+encodeURIComponent(r.id)+'.pdf';
  $('#scheme-label').textContent='Предполагаемая схема: '+(r.scheme?.title||'Тип схемы не определён');
}
function stat(label,value,detail,cls='') { const n=node('article',null,'stat '+cls);n.append(node('span',label),node('strong',value),node('small',detail));return n; }
function empty(target,message) { target.replaceChildren(node('div',message,'empty-state')); }
function table(items,limit=200,selectable=false) {
  const wrap=node('div',null,'table-wrap');if(!items.length){empty(wrap,'Проверок пока нет. Начните с анализатора.');return wrap;}
  const t=node('table'),head=node('thead'),hr=node('tr'),body=node('tbody');
  (selectable?['Выбрать','Дата и время','Источник','Домен','Риск-балл','Вердикт','Отчёт']:['Дата и время','Источник','Домен','Риск-балл','Вердикт','Отчёт']).forEach(v=>hr.append(node('th',v)));head.append(hr);
  items.slice(0,limit).forEach(item=>{
    const row=node('tr');
    if(selectable){const cell=node('td'),check=node('input');check.type='checkbox';check.checked=selectedChecks.has(item.id);check.setAttribute('aria-label','Выбрать проверку '+item.id);check.addEventListener('change',()=>{if(check.checked){if(selectedChecks.size===2){check.checked=false;toast('Для сравнения выберите две проверки. Снимите один из флажков.');return;}selectedChecks.add(item.id);}else selectedChecks.delete(item.id);updateSelection();});cell.append(check);row.append(cell);}
    row.append(node('td',new Date(item.created_at).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})),node('td',channels[item.channel]),node('td',item.urls.map(u=>u.host).join(', ')||'—','domain-cell'));
    const sc=node('td'),open=node('button',item.score+' / 100','history-open');open.type='button';open.addEventListener('click',()=>{renderResult(item);location.hash='result';});sc.append(open);
    const vc=node('td');vc.append(node('span',verdicts[item.verdict],'pill '+item.verdict));
    const rc=node('td'),link=node('a','PDF ↓');link.href='/api/reports/'+encodeURIComponent(item.id)+'.pdf';rc.append(link);row.append(sc,vc,rc);body.append(row);
  });t.append(head,body);wrap.append(t);return wrap;
}
function dailyChart(items,checks=[]) {
  const target=$('#daily-chart');target.replaceChildren();if(!items.length){empty(target,'График появится после первой проверки.');return;}
  function svg(tag,attrs,text){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));if(text!==undefined)n.textContent=text;return n;}
  const chart=svg('svg',{viewBox:'0 0 480 230',role:'img','aria-label':'Проверки по дням с распределением риска'}),selected=items.slice(-7),max=Math.max(...selected.map(i=>i[1]),1);
  [0,.5,1].forEach(f=>{const y=180-f*150;chart.append(svg('line',{x1:32,y1:y,x2:470,y2:y,class:'chart-grid'}),svg('text',{x:24,y:y+4,'text-anchor':'end'},Math.round(max*f)));});
  selected.forEach(([date,count],i)=>{const step=430/selected.length,x=36+i*step;let bottom=180;['low','suspicious','high'].forEach(level=>{const n=checks.filter(c=>c.created_at.slice(0,10)===date&&c.verdict===level).length,h=n/max*150;if(h){chart.append(svg('rect',{x:x+step*.22,y:bottom-h,width:Math.min(74,step*.56),height:h,class:'chart-'+level}));bottom-=h;}});chart.append(svg('text',{x:x+step*.22+Math.min(74,step*.56)/2,y:208,'text-anchor':'middle'},date.slice(5).replace('-','.')));});
  target.append(chart);const legend=node('div',null,'chart-legend');Object.entries(verdicts).forEach(([k,label])=>legend.append(node('span',(k==='high'?'× ':k==='suspicious'?'△ ':'✓ ')+label,k+'-text')));target.append(legend,node('p','Только выполненные проверки. Даты сгруппированы по UTC.','card-description'));
}
function renderBrandDistribution(items){const counts=new Map();for(const item of items){const brands=new Set(item.urls.filter(u=>!u.official).flatMap(u=>u.brand_matches||[]));for(const brand of brands)counts.set(brand,(counts.get(brand)||0)+1);}const target=$('#brand-distribution');if(!counts.size){empty(target,'Совпадений с названиями брендов пока нет.');return;}target.replaceChildren(...[...counts].sort((a,b)=>b[1]-a[1]).map(([brand,count])=>detail(brand,count)));}
function typesChart(items) {
  const target=$('#types-chart');target.replaceChildren();if(!items.length){empty(target,'Найденных признаков пока нет.');return;}
  const max=Math.max(...items.map(i=>i[1]));items.slice(0,6).forEach(([title,count])=>{const row=node('div',null,'bar-row'),label=node('div',null,'bar-label'),bar=node('progress');label.append(node('span',title),node('strong',count));bar.max=max;bar.value=count;bar.setAttribute('aria-label',title+': '+count);row.append(label,bar);target.append(row);});
}
async function dashboard(version) {
  const [d,h]=await Promise.all([api('dashboard'),api('history')]);if(version!==routeVersion)return;
  $('#dashboard-stats').replaceChildren(stat('Всего проверок',d.total,'Ваша история'),stat('Высокий риск',d.counts.high,'Требуют внимания','high'),stat('Подозрительно',d.counts.suspicious,'Нужна дополнительная проверка','suspicious'),stat('Низкий риск',d.counts.low,'Не гарантия безопасности','low'));
  renderBrandDistribution(h.items);
  dailyChart(d.daily,h.items);typesChart(d.types);$('#recent-checks').replaceChildren(table(h.items,5));
  distribution($('#risk-distribution'),Object.entries(d.counts).map(([key,count])=>[verdicts[key],count]),d.total);
  distribution($('#channel-distribution'),Object.entries(d.channels).map(([key,count])=>[channels[key],count]),d.total);
  if(d.schemes.length)distribution($('#scheme-distribution'),d.schemes,d.total);else empty($('#scheme-distribution'),'Предполагаемые схемы пока не определены.');
}
function distribution(target,values,total){target.replaceChildren();if(!total){empty(target,'Данные появятся после первой проверки.');return;}values.forEach(([label,count])=>{const row=node('div',null,'bar-row'),text=node('div',null,'bar-label'),bar=node('progress');text.append(node('span',label),node('strong',count+' · '+Math.round(count/total*100)+'%'));bar.max=total;bar.value=count;bar.setAttribute('aria-label',label+': '+count);row.append(text,bar);target.append(row);});}
function filteredHistory(){
  const risk=$('#history-filter').value,source=$('#history-channel').value,q=$('#history-search').value.trim().toLocaleLowerCase('ru-RU');
  const items=historyItems.filter(i=>(risk==='all'||i.verdict===risk)&&(source==='all'||i.channel===source)&&(!q||[i.id,verdicts[i.verdict],channels[i.channel],i.scheme?.title||'',...i.urls.map(u=>u.host),...i.signals.map(s=>s.title)].join(' ').toLocaleLowerCase('ru-RU').includes(q)));
  const order=$('#history-sort').value;
  return items.sort((a,b)=>order==='risk'?b.score-a.score||b.created_at.localeCompare(a.created_at):order==='oldest'?a.created_at.localeCompare(b.created_at):b.created_at.localeCompare(a.created_at));
}
function updateSelection(){$('#compare-open').textContent='Сравнить ('+selectedChecks.size+' / 2)';$('#compare-open').disabled=selectedChecks.size!==2;}
function renderHistory(){
  const items=filteredHistory(),pages=Math.max(1,Math.ceil(items.length/pageSize));historyPage=Math.min(historyPage,pages);
  if(items.length)$('#history-list').replaceChildren(table(items.slice((historyPage-1)*pageSize,historyPage*pageSize),pageSize,true));else empty($('#history-list'),historyItems.length?'Нет результатов по выбранным фильтрам.':'Проверок пока нет. Начните с анализатора или пакетной проверки.');
  $('#history-summary').textContent='Найдено '+items.length+' из '+historyItems.length;$('#history-page').textContent='Страница '+historyPage+' из '+pages;
  $('#history-prev').disabled=historyPage<=1;$('#history-next').disabled=historyPage>=pages;$('#history-export').disabled=!items.length;updateSelection();
}
function downloadCSV(){
  const items=filteredHistory();if(!items.length)return;
  function cell(value){let s=String(value??'');if(/^[=+\-@\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
  const rows=[['ID','Время UTC','Источник','Риск-балл','Вердикт','Правила','ML','Домены','Признаки']];
  items.forEach(i=>rows.push([i.id,i.created_at,channels[i.channel],i.score,verdicts[i.verdict],i.rules_score,i.ml_score,i.urls.map(u=>u.host).join(' | '),i.signals.map(s=>s.title).join(' | ')]));
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const link=node('a');link.href=url;link.download='qalqan-history-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function prepareComparison(){
  const ids=[...selectedChecks];['left','right'].forEach((side,index)=>{const select=$('#compare-'+side);select.replaceChildren();const blank=node('option','Выберите проверку');blank.value='';select.append(blank);historyItems.forEach(i=>{const o=node('option',new Date(i.created_at).toLocaleString('ru-RU')+' · '+i.score+'/100 · '+(i.urls[0]?.host||channels[i.channel]));o.value=i.id;select.append(o);});select.value=ids[index]||'';});renderComparison();
}
function renderComparison(){
  const left=historyItems.find(i=>i.id===$('#compare-left').value),right=historyItems.find(i=>i.id===$('#compare-right').value);$('#compare-results').replaceChildren();
  if(!left||!right||left.id===right.id){$('#compare-hint').textContent=left&&right?'Выберите две разные проверки.':historyItems.length<2?'Сначала выполните хотя бы две проверки.':'Выберите две проверки в списках выше или отметьте их в истории.';return;}
  $('#compare-hint').textContent='Разница риск-баллов: '+Math.abs(left.score-right.score)+'. Баллы — индексы признаков, а не вероятности мошенничества.';
  [left,right].forEach((item,index)=>{const other=index===0?right:left,card=node('article',null,'card compare-card'),pill=node('span',verdicts[item.verdict],'pill '+item.verdict);card.append(node('span','ПРОВЕРКА '+(index+1),'eyebrow'),node('h2',item.score+' / 100'),pill,node('p',new Date(item.created_at).toLocaleString('ru-RU')+' · '+channels[item.channel],'card-description'));
    card.append(detail('Правила',item.rules_score+' / 100'),detail('ML-оценка',item.ml_score===null?'Не применяется':item.ml_score+' / 100'),node('h4','Найденные признаки'));
    if(!item.signals.length)card.append(node('p','Эвристические признаки не обнаружены.','card-description'));
    item.signals.forEach(s=>{const row=node('div',null,'compare-signal');row.append(node('span',s.title),node('small',other.signals.some(o=>o.code===s.code)?'Общий признак':'Только в этой проверке'));card.append(row);});
    item.urls.forEach(u=>card.append(node('div',u.host,'url-row')));const advice=node('div',null,'recommendation');advice.append(node('strong','Рекомендуемое действие'),node('p',item.advice));const report=node('a','↓ PDF-отчёт','secondary-button');report.href='/api/reports/'+encodeURIComponent(item.id)+'.pdf';card.append(advice,report);$('#compare-results').append(card);
  });
}
function detail(label,value) {const n=node('div',null,'detail-row');n.append(node('span',label),node('strong',value));return n;}
async function research(version) {
  const d=await api('metrics');if(version!==routeVersion)return;if(d.status!=='evaluated'){empty($('#research-metrics'),'Эксперимент ещё не выполнен.');return;}
  const m=d.hybrid,p=v=>(v*100).toFixed(1)+'%';
  $('#research-metrics').replaceChildren(stat('Precision',p(m.precision),'Hybrid · synthetic test'),stat('Recall',p(m.recall),'Hybrid · synthetic test'),stat('F1-score',m.f1.toFixed(3),'Hybrid · synthetic test'),stat('ROC-AUC',m.roc_auc.toFixed(3),'На малом синтетическом наборе'));
  $('#dataset-details').replaceChildren(detail('Обучение / тест',d.train_rows+' / '+d.test_rows+' строк'),detail('Независимые шаблоны',d.train_groups+' / '+d.test_groups),detail('Языки','RU · KZ · EN'),detail('Разделение','По группам шаблонов'),detail('FPR · hybrid',p(m.false_positive_rate)),detail('p95 · inference',d.latency_ms.p95+' мс'));
  const wrap=node('div',null,'table-wrap'),t=node('table'),head=node('thead'),hr=node('tr'),body=node('tbody');
  ['Метод','Precision','Recall','F1','ROC-AUC','FPR'].forEach(v=>hr.append(node('th',v)));head.append(hr);
  [['text_rules','Только текст · правила'],['url_rules','Только URL · правила'],['rules','Все правила'],['ml','ML baseline'],['hybrid','Hybrid (приложение)']].forEach(([key,title])=>{const row=node('tr'),r=d[key];[title,p(r.precision),p(r.recall),r.f1.toFixed(3),r.roc_auc.toFixed(3),p(r.false_positive_rate)].forEach(v=>row.append(node('td',v)));body.append(row);});
  t.append(head,body);wrap.append(t);$('#method-comparison').replaceChildren(wrap,node('p','На простых синтетических сценариях правила могут превосходить ML. Для выводов об эффективности требуется новый независимый набор данных.','card-description'));
  const ci=d.bootstrap.hybrid,range=(key,percent)=>{const v=ci[key];return v?(percent?p(v.low)+' — '+p(v.high):v.low.toFixed(3)+' — '+v.high.toFixed(3)):'Недостаточно данных';};
  $('#confidence-details').replaceChildren(detail('Precision · 95% CI',range('precision',true)),detail('Recall · 95% CI',range('recall',true)),detail('F1 · 95% CI',range('f1',false)),detail('FPR · 95% CI',range('false_positive_rate',true)),detail('Bootstrap',d.bootstrap.samples_requested+' выборок · '+d.bootstrap.groups+' групп'));
  const a=await api('metrics/adversarial');if(version!==routeVersion)return;
  if(!a.cases){empty($('#adversarial-results'),'Проверки устойчивости ещё не выполнены.');return;}
  $('#adversarial-summary').textContent='Совпало с разметкой '+a.passed+' из '+a.total+' авторских проверок. Это отдельные примеры ошибок, а не слепой тест.';
  const probes=node('table'),pr=node('tr'),ph=node('thead'),pb=node('tbody');['Проверка','Ожидалось','Риск-балл','Совпадение'].forEach(s=>pr.append(node('th',s)));ph.append(pr);a.cases.forEach(c=>{const r=node('tr');[c.id,c.expected?'Фишинг':'Обычное',c.score+' / 100',c.correct?'Да':'Нет — ограничение'].forEach(s=>r.append(node('td',s)));pb.append(r);});probes.append(ph,pb);const pw=node('div',null,'table-wrap');pw.append(probes);$('#adversarial-results').replaceChildren(pw);
}
async function route() {
  const value=location.hash.slice(1),view=names[value]?value:'home',version=++routeVersion;
  if(document.body.classList.contains('projector-mode')&&!['result','presentation'].includes(view))setProjector(false);
  if(currentView!==view){window.scrollTo(0,0);currentView=view;}
  $$('.view').forEach(s=>{s.hidden=s.id!=='view-'+view;});$$('[data-view]').forEach(a=>{a.classList.toggle('active',a.dataset.view===(view==='result'?'analyzer':view));a.setAttribute('aria-current',a.dataset.view===(view==='result'?'analyzer':view)?'page':'false');});$('#page-name').textContent=names[view];
  closeNavigation();
  if(view==='history')empty($('#history-list'),'Загружаем историю…');if(view==='compare'){empty($('#compare-results'),'Загружаем проверки…');$('#compare-hint').textContent='';}
  try {if(view==='dashboard')await dashboard(version);if(view==='history'||view==='compare'){const d=await api('history');if(version===routeVersion){historyItems=d.items;for(const id of selectedChecks)if(!historyItems.some(i=>i.id===id))selectedChecks.delete(id);if(view==='history')renderHistory();else prepareComparison();}}if(view==='research')await research(version);if(view==='presentation')await presentationMetrics(version);if(view==='schemes')renderSchemes();if(view==='account')await refreshAccount(version);}catch(e){if(version!==routeVersion)return;if(view==='history')empty($('#history-list'),'Не удалось загрузить историю. Попробуйте открыть раздел ещё раз.');if(view==='compare')empty($('#compare-results'),'Не удалось загрузить проверки.');toast(e.message||'API недоступен.');}
}
function closeNavigation(){$('#more-navigation').open=false;$('.sidebar').classList.remove('nav-open');$('#nav-toggle').setAttribute('aria-expanded','false');}
$('#nav-toggle').addEventListener('click',()=>{const open=$('.sidebar').classList.toggle('nav-open');$('#nav-toggle').setAttribute('aria-expanded',String(open));if(open)$('#more-navigation').open=true;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeNavigation();if(!$('#report-preview').open)setProjector(false);}});
function setBusy(value){busy=value;$$('#analyze-button,#batch-submit,#batch-example,#paste-message,#content,#batch-content,#batch-channel,#brand-submit,#brand-input,#telegram-run,[data-demo],[data-sample],[data-channel]').forEach(n=>{n.disabled=value;});$('#analysis-form').setAttribute('aria-busy',String(value));$('#batch-form').setAttribute('aria-busy',String(value));}
const actionPlans={received:['Не переходите по ссылке и не отвечайте сообщением с личными данными.','Проверьте информацию через официальное приложение банка или номер на вашей карте.','При необходимости сохраните сообщение и пожалуйтесь на отправителя в мессенджере.'],clicked:['Закройте страницу. Не вводите данные и не загружайте предложенные файлы.','Если файл уже скачан, не открывайте его. Если он запущен, проверьте устройство средствами защиты.','Проверьте операции через приложение банка. Если вводили данные, перейдите к шагам «Ввёл данные».'],entered:['Сразу свяжитесь со своим банком через официальное приложение или номер на карте. Сообщите, какие данные передали.','Обсудите с банком блокировку карты или защиту аккаунта и проверьте последние операции.','Смените раскрытые пароли через официальные сервисы с доверенного устройства. Не сообщайте новые коды.'],paid:['Сразу сообщите банку о возможном мошенничестве и уточните возможность остановки или оспаривания перевода. Возврат не гарантирован.','Сохраните сведения об операции, переписку и адрес сайта. Не публикуйте секреты или полные данные карты.','Подайте обращение в правоохранительные органы через официальные каналы. Не платите людям, обещающим гарантированный возврат.']};
function actionPlan(key){$$('[data-action]').forEach(b=>{b.classList.toggle('selected',b.dataset.action===key);b.setAttribute('aria-pressed',String(b.dataset.action===key));});$('#action-steps').replaceChildren(...actionPlans[key].map(s=>node('li',s)));}
$$('[data-action]').forEach(b=>b.addEventListener('click',()=>actionPlan(b.dataset.action)));actionPlan('received');
$$('[data-feedback]').forEach(b=>b.addEventListener('click',async()=>{if(!activeResultId)return;if(!$('#feedback-consent').checked){$('#feedback-status').textContent='Для сохранения отзыва нужно отметить согласие.';return;}const id=activeResultId;$$('[data-feedback]').forEach(n=>{n.disabled=true;});try{const r=await api('checks/'+encodeURIComponent(id)+'/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vote:b.dataset.feedback,consent:true})});if(id===activeResultId)$('#feedback-status').textContent=r.message;}catch(e){if(id===activeResultId)$('#feedback-status').textContent=e.message;}finally{$$('[data-feedback]').forEach(n=>{n.disabled=false;});}}));
$('#paste-message').addEventListener('click',async()=>{if(busy)return;try{if(!navigator.clipboard?.readText)throw new Error();const text=await navigator.clipboard.readText();if(text.length>10000){toast('Сообщение больше 10 000 символов. Вставьте только нужную часть.');return;}$('#content').value=text;$('#content').dispatchEvent(new Event('input'));$('#content').focus();}catch(_){toast('Разрешите доступ к буферу или нажмите и удерживайте поле сообщения, затем выберите «Вставить».');$('#content').focus();}});

function showAccount(p){authDeliveryAvailable=p.delivery_available;$('#account-member').hidden=!p.authenticated;$('#account-guest').hidden=p.authenticated;$('#account-link').textContent=p.authenticated?'Мой аккаунт':'Войти';$('#session-kind').textContent=p.authenticated?'История аккаунта':'Личная сессия';$('#account-send').disabled=!authDeliveryAvailable||authBusy;$('#auth-availability').textContent=p.delivery_available?'Отправим код на вашу почту. Телефон и пароль не нужны.':(p.unavailable_reason||'Доставка кодов пока не подключена. Регистрация станет доступна после настройки почты. Проверка сообщений работает без входа.');if(p.authenticated){$('#account-details').replaceChildren(detail('Почта',p.email));authChallenge=null;$('#account-start').hidden=false;$('#account-verify').hidden=true;}}
async function refreshAccount(version){const p=await api('auth/me');if(version===undefined||version===routeVersion)showAccount(p);}
function authError(message){$('#account-error').textContent=message;$('#account-error').hidden=false;}
function setAuthBusy(value){authBusy=value;$$('#account-send,#account-confirm,#account-restart,#account-logout,#account-delete').forEach(n=>{n.disabled=value;});$('#account-send').disabled=value||!authDeliveryAvailable;$('#account-start').setAttribute('aria-busy',String(value));$('#account-verify').setAttribute('aria-busy',String(value));}
$('#account-start').addEventListener('submit',async e=>{e.preventDefault();if(authBusy||busy)return;setAuthBusy(true);$('#account-error').hidden=true;$('#account-status').textContent='Отправляем письмо…';try{const r=await api('auth/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('#account-email').value,consent:$('#account-consent').checked})});authChallenge=r.challenge_id;$('#account-start').hidden=true;$('#account-verify').hidden=false;$('#account-status').textContent=r.message;$('#email-code').focus();}catch(e){authError(e.message);$('#account-status').textContent='Письмо не отправлено.';}finally{setAuthBusy(false);}});
$('#account-restart').addEventListener('click',()=>{authChallenge=null;$('#account-start').hidden=false;$('#account-verify').hidden=true;$('#email-code').value='';$('#account-status').textContent='';$('#account-error').hidden=true;refreshAccount().catch(e=>authError(e.message));});
$('#account-verify').addEventListener('submit',async e=>{e.preventDefault();if(authBusy||busy||!authChallenge)return;setAuthBusy(true);$('#account-error').hidden=true;try{const p=await api('auth/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challenge_id:authChallenge,email_code:$('#email-code').value})});showAccount(p);$('#email-code').value='';$('#account-status').textContent='Почта подтверждена. Вы вошли в аккаунт.';toast('Вход выполнен. История доступна на ваших устройствах.');}catch(e){authError(e.message);}finally{setAuthBusy(false);}});
function clearPrivateViews(){activeResultId=null;activeResult=null;activeSourceText='';$('#result-message').replaceChildren();$('#report-paper').replaceChildren();if($('#report-preview').open)$('#report-preview').close();$('#brand-results').hidden=true;historyItems=[];selectedChecks.clear();historyPage=1;$('#result-content').hidden=true;$('#result-empty').hidden=false;$('#result-status').textContent='Ожидает проверки';$('#batch-output').hidden=true;$('#batch-status').textContent='';$('#compare-results').replaceChildren();$('#dashboard-stats').replaceChildren();$('#recent-checks').replaceChildren();renderHistory();}
async function leaveAccount(remove){if(authBusy||busy)return;if(remove&&!window.confirm('Удалить аккаунт, контакты и все его проверки? Это действие нельзя отменить.'))return;setAuthBusy(true);$('#account-error').hidden=true;try{await api(remove?'auth/account':'auth/logout',{method:remove?'DELETE':'POST'});clearPrivateViews();$('#account-status').textContent=remove?'Аккаунт и история удалены.':'Вы вышли из аккаунта.';await refreshAccount();}catch(e){authError(e.message);}finally{setAuthBusy(false);}}
$('#account-logout').addEventListener('click',()=>leaveAccount(false));$('#account-delete').addEventListener('click',()=>leaveAccount(true));
$$('[data-channel]').forEach(b=>b.addEventListener('click',()=>setChannel(b.dataset.channel)));
$('#content').addEventListener('input',()=>{$('#char-count').textContent=$('#content').value.length.toLocaleString('ru-RU')+' / 10 000';});
const samples={phishing:{channel:'sms',text:'Срочно! Ваш счёт будет заблокирован. Введите код из SMS и CVV карты для проверки на http://kaspi-verify.example/login'},safe:{channel:'sms',text:'Покупка на 3 500 ₸. Чек доступен в приложении банка.'},url:{channel:'url',text:'https://kaspi.kz.verify.example/confirm'}};
function loadSample(key) {const s=samples[key];setChannel(s.channel);$('#content').value=s.text;$('#content').dispatchEvent(new Event('input'));}
$$('[data-demo-text]').forEach(n=>{n.textContent=samples[n.dataset.demoText].text;});
$$('[data-sample]').forEach(b=>b.addEventListener('click',()=>{if(busy)return;loadSample(b.dataset.sample);$('#content').focus();}));
$$('[data-demo]').forEach(b=>b.addEventListener('click',()=>{
  if(busy||authBusy)return;
  loadSample(b.dataset.demo);location.hash='analyzer';route();
  $('#analyze-button').focus();$('#analysis-form').requestSubmit();
}));
$('#analysis-form').addEventListener('submit',async e=>{
  e.preventDefault();if(busy||authBusy)return;const content=$('#content').value.trim();
  $('#analysis-retry').hidden=true;$('#form-error').hidden=true;
  if(content.length<3||content.length>10000){$('#form-error').textContent=content.length<3?'Вставьте сообщение или ссылку: минимум 3 символа.':'Сообщение слишком длинное. Сократите его до 10 000 символов.';$('#form-error').hidden=false;$('#content').focus();return;}
  setBusy(true);$('#analyze-button').setAttribute('aria-busy','true');$('#result-status').textContent='Анализируем…';$('#result-content').hidden=true;$('#result-empty').hidden=false;
  $('#analysis-progress').hidden=false;$('#analysis-progress').textContent='Проверяем сообщение и структуру ссылок…';
  const waiting=setTimeout(()=>{$('#analysis-progress').textContent='Сервер отвечает дольше обычного. Демо-сервер может просыпаться около минуты — дождитесь ответа.';},8000);
  try{const r=await api('analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content,channel})});renderResult(r,content);location.hash='result';}
  catch(e){$('#form-error').textContent=e.message||'API недоступен.';$('#form-error').hidden=false;$('#analysis-retry').hidden=false;$('#result-status').textContent='Ошибка проверки';}
  finally{clearTimeout(waiting);$('#analysis-progress').hidden=true;setBusy(false);$('#analyze-button').setAttribute('aria-busy','false');}
});
$('#analysis-retry').addEventListener('click',()=>$('#analysis-form').requestSubmit());
function batchEntries(){return $('#batch-content').value.replace(/\r\n/g,'\n').split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);}
$('#batch-content').addEventListener('input',()=>{$('#batch-count').textContent=batchEntries().length+' / 10 записей';});
$('#batch-example').addEventListener('click',()=>{$('#batch-content').value=[samples.phishing.text,samples.safe.text,samples.url.text].join('\n\n');$('#batch-channel').value='auto';$('#batch-content').dispatchEvent(new Event('input'));});
$('#batch-form').addEventListener('submit',async e=>{
  e.preventDefault();if(busy||authBusy)return;$('#batch-error').hidden=true;const entries=batchEntries(),source=$('#batch-channel').value;
  if(!entries.length||entries.length>10||entries.some(s=>s.length<3||s.length>10000)){$('#batch-error').textContent='Добавьте от 1 до 10 записей, каждая — от 3 до 10 000 символов. Разделяйте записи пустой строкой.';$('#batch-error').hidden=false;return;}
  const body=JSON.stringify({items:entries.map(content=>({content,channel:source==='auto'?/^(https?:\/\/|www\.)\S+$/i.test(content)?'url':'sms':source}))});
  if(new TextEncoder().encode(body).length>65536){$('#batch-error').textContent='Пакет слишком большой. Сократите сообщения или разделите их на несколько запусков.';$('#batch-error').hidden=false;return;}
  setBusy(true);$('#batch-status').textContent='Проверяем '+entries.length+' записей…';$('#batch-output').hidden=true;
  try{const r=await api('analyze/batch',{method:'POST',headers:{'Content-Type':'application/json'},body});$('#batch-stats').replaceChildren(stat('Обработано',r.items.length,'Сохранено в вашей истории'),stat('Высокий риск',r.counts.high,'Есть признаки угрозы','high'),stat('Подозрительно',r.counts.suspicious,'Нужна проверка','suspicious'),stat('Низкий риск',r.counts.low,'Без гарантии безопасности'));$('#batch-results').replaceChildren(table(r.items));$('#batch-output').hidden=false;$('#batch-status').textContent='Готово: '+r.items.length+' результатов.';}
  catch(e){$('#batch-error').textContent=e.message;$('#batch-error').hidden=false;$('#batch-status').textContent='Пакет не обработан.';}
  finally{setBusy(false);}
});
$$('#history-filter,#history-channel,#history-sort').forEach(n=>n.addEventListener('change',()=>{historyPage=1;renderHistory();}));
$('#history-search').addEventListener('input',()=>{historyPage=1;renderHistory();});
$('#history-prev').addEventListener('click',()=>{historyPage--;renderHistory();});$('#history-next').addEventListener('click',()=>{historyPage++;renderHistory();});
$('#history-export').addEventListener('click',downloadCSV);
$('#compare-open').addEventListener('click',()=>{if(selectedChecks.size===2)location.hash='compare';});
$$('#compare-left,#compare-right').forEach(s=>s.addEventListener('change',()=>{selectedChecks.clear();for(const side of ['left','right'])if($('#compare-'+side).value)selectedChecks.add($('#compare-'+side).value);renderComparison();}));
$('#clear-history').addEventListener('click',async()=>{
  if(!historyItems.length){toast('История уже пустая.');return;}if(!window.confirm('Удалить результаты и PDF-отчёты текущей сессии?'))return;
  try{await api('history',{method:'DELETE'});activeResult=null;activeResultId=null;activeSourceText='';$('#result-message').replaceChildren();$('#report-paper').replaceChildren();$('#brand-results').hidden=true;historyItems=[];selectedChecks.clear();historyPage=1;renderHistory();$('#batch-output').hidden=true;$('#compare-results').replaceChildren();$('#result-content').hidden=true;$('#result-empty').hidden=false;$('#result-status').textContent='Ожидает проверки';toast('История удалена.');}catch(e){toast(e.message);}
});
function renderAnnotatedText(text,result){
  const target=$('#result-message');target.replaceChildren();
  $('#result-source-note').textContent=channels[result.channel]+' · '+new Date(result.created_at).toLocaleString('ru-RU');
  if(!text){target.append(node('p','Исходное сообщение не сохраняется. Для этой проверки доступны найденные признаки и домены.','card-description'));return;}
  const codes=new Set(result.signals.map(s=>s.code));
  const expression=/(https?:\/\/[^\s<>]+|www\.[^\s<>]+|в течение\s+\d+\s+минут|сроч[\p{L}]*|немедлен[\p{L}]*|urgent|immediately|cvv|cvc|pin|пин|парол[\p{L}]*|код[\p{L}]*|номер\s+карт[\p{L}]*)/giu;
  let last=0;for(const match of text.matchAll(expression)){target.append(document.createTextNode(text.slice(last,match.index)));const token=match[0];let cls='';if(/^(?:https?:|www\.)/i.test(token))cls='evidence-link';else if(/^(?:сроч|немедлен|в течение|urgent|immediately)/i.test(token)&&codes.has('urgency'))cls='evidence-urgent';else if(codes.has('secret_request'))cls='evidence-secret';target.append(node(cls?'mark':'span',token,cls));last=match.index+token.length;}target.append(document.createTextNode(text.slice(last)));
}
function setProjector(on){document.body.classList.toggle('projector-mode',on);$('#projector-exit').hidden=!on;$$('#result-projector,#presentation-projector').forEach(b=>b.setAttribute('aria-pressed',String(on)));if(on){closeNavigation();window.scrollTo(0,0);$('#projector-exit').focus();}}
$('#result-projector').addEventListener('click',()=>setProjector(!document.body.classList.contains('projector-mode')));
$('#presentation-projector').addEventListener('click',()=>setProjector(!document.body.classList.contains('projector-mode')));
$('#projector-exit').addEventListener('click',()=>setProjector(false));
function renderPreview(){
  if(!activeResult)return;const r=activeResult,paper=$('#report-paper');paper.replaceChildren();
  paper.append(node('h2','Qalqan Finance Security'),node('p','Проверка: '+new Date(r.created_at).toISOString().replace('T',' ').slice(0,19)+' UTC','report-date'),node('hr'),node('strong',r.score+' из 100','report-score'),node('p',verdicts[r.verdict],r.verdict+'-text'),node('p','Оценка признаков от 0 до 100, а не вероятность.','report-caption'),node('h3','Почему так решено?'));
  const signals=node('ul');if(r.signals.length)r.signals.forEach(s=>signals.append(node('li',s.title+' · +'+s.weight)));else signals.append(node('li','Явных эвристических признаков не обнаружено. Это не гарантия безопасности.'));paper.append(signals);
  if(r.urls.length){paper.append(node('h3','Домены'));r.urls.forEach(u=>paper.append(node('p',u.host,'report-domain')));}
  paper.append(node('hr'),node('h3','Что делать?'),node('p',r.advice),node('p','Предполагаемая схема: '+(r.scheme?.title||'Не определена')));
  paper.append(node('hr'),node('h3','Ограничения'));r.limitations.forEach(t=>paper.append(node('p',t,'report-caption')));
  paper.append(node('p','Исходное сообщение не сохраняется. ID: '+r.id,'report-caption'));
  $('#preview-download').href='/api/reports/'+encodeURIComponent(r.id)+'.pdf';$('#report-preview').showModal();
}
$('#preview-report').addEventListener('click',renderPreview);
$('#close-report').addEventListener('click',()=>$('#report-preview').close());
$('#report-preview').addEventListener('click',e=>{if(e.target===$('#report-preview')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
const brandExamples=[['Kaspi','kaspi.kz','https://kaspi-secure-login.example'],['Halyk','halykbank.kz','https://halykbank-login.example'],['Freedom','bankffin.kz','https://freedom-invest.example'],['Jusan','jusan.kz','https://jusan-account.example'],['Forte','forte.kz','https://forte-verify.example'],['eGov','egov.kz','https://egov-payment.example'],['Казпочта','post.kz','https://kazpost-delivery.example'],['Air Astana','airastana.com','https://airastana-prize.example']];
brandExamples.forEach(([brand,domain,sample],index)=>{const b=node('button',brand,index===0?'selected':'');b.type='button';b.addEventListener('click',()=>{$('#brand-input').value=sample;$$('#brand-pills button').forEach(x=>x.classList.toggle('selected',x===b));$('#brand-input').focus();});$('#brand-pills').append(b);});
$('#brand-form').addEventListener('submit',async e=>{
  e.preventDefault();if(busy||authBusy)return;const input=$('#brand-input').value.trim();$('#brand-error').hidden=true;$('#brand-results').hidden=true;
  if(input.length<3||input.length>10000||/\s/.test(input)){$('#brand-error').textContent='Введите одну ссылку или домен без пробелов.';$('#brand-error').hidden=false;return;}
  setBusy(true);try{const r=await api('analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:input,channel:'url'})});renderResult(r,input);const u=r.urls[0];$('#brand-host').textContent=u.host;$('#brand-host').className='brand-address '+(u.official?'low-text':r.verdict+'-text');$('#brand-signals').replaceChildren(...u.signals.map(signal=>detail(signal.title,'+'+signal.weight)));if(!u.signals.length)$('#brand-signals').append(node('p','Явных структурных признаков подмены не найдено.','card-description'));$('#brand-advice').textContent=r.advice;const names=u.brand_matches||[];$('#brand-matches').replaceChildren(...names.map(name=>{const match=brandExamples.find(b=>b[0]===name);return detail(name,match?match[1]:'Демонстрационный справочник');}));if(!names.length)$('#brand-matches').append(node('p','Сходство с брендами из справочника не обнаружено.'));$('#brand-results').hidden=false;}catch(error){$('#brand-error').textContent=error.message;$('#brand-error').hidden=false;}finally{setBusy(false);}
});
const schemeDetails={
 bank_support:{title:'Служба безопасности банка',icon:'⌂',short:'Просят назвать код или перевести деньги.',advice:'Код из SMS нельзя сообщать собеседнику. Завершите разговор и свяжитесь со своим банком через приложение или номер на карте.',example:'Срочно! Служба безопасности банка: ваш счёт заблокирован. Сообщите код из SMS и CVV карты для проверки.'},
 family:{title:'Родственник в беде',icon:'♧',short:'Просят срочно помочь деньгами.',advice:'Свяжитесь с родственником по знакомому номеру. Не переводите деньги, пока самостоятельно не проверите историю.',example:'Мама, срочно помоги! Сын попал в беду. Переведи деньги на безопасный счёт, говорить сейчас не могу.'},
 delivery:{title:'Фальшивый курьер',icon:'□',short:'Просят оплатить доставку по ссылке.',advice:'Проверьте заказ в официальном приложении службы доставки. Не вводите данные карты на странице из сообщения.',example:'Курьер: ваша посылка задержана. Срочно подтвердите карту и CVV для оплаты доставки http://kazpost-delivery.example'},
 prize:{title:'Приз или выигрыш',icon:'♙',short:'Просят оплатить комиссию за приз.',advice:'Не платите за получение неизвестного выигрыша и не сообщайте коды. Уточните правила акции на официальном сайте организатора.',example:'Вы выиграли приз! Введите номер карты и CVV, чтобы получить выплату: http://bonus-prize.example'},
 investment:{title:'Фейковые инвестиции',icon:'↗',short:'Обещают быстрый гарантированный доход.',advice:'Проверьте компанию и её право оказывать услуги через официальные источники. Не переводите деньги под обещание гарантированной прибыли.',example:'Инвестиции: гарантированный доход за день! Срочно переведите деньги на безопасный счёт http://freedom-invest.example'},
 government:{title:'Выплата от государства',icon:'▤',short:'Просят войти или получить пособие по ссылке.',advice:'Проверяйте выплаты через официальный государственный портал или приложение. Не сообщайте коды и реквизиты из сообщения.',example:'Вам назначено государственное пособие. Срочно введите код и реквизиты карты: http://egov-payment.example'},
 job:{title:'Фальшивая работа',icon:'▣',short:'Просят предоплату или секретные данные.',advice:'Проверьте работодателя независимо. Не оплачивайте трудоустройство и не передавайте секретные банковские данные.',example:'Вакансия с высокой зарплатой! Срочно подтвердите карту и CVV для оформления трудоустройства http://job-offer.example'}
};
function renderSchemes(){
 if(activeResult&&schemeDetails[activeResult.scheme?.code])selectedScheme=activeResult.scheme.code;
 $('#schemes-context').textContent=activeResult?'Последняя проверка: '+(activeResult.scheme?.title||'Тип не определён')+'. Изучите описание или выберите другую схему.':'Выберите схему. После анализа здесь выделяется предположение по найденным признакам.';
 $('#scheme-cards').replaceChildren(...Object.entries(schemeDetails).map(([code,item])=>{const button=node('button',null,'card scheme-card');button.type='button';button.dataset.scheme=code;button.append(node('span',item.icon,'scheme-icon'),node('h2',item.title),node('p',item.short));if(activeResult?.scheme?.code===code)button.append(node('small','Похоже на вашу проверку'));button.addEventListener('click',()=>{selectedScheme=code;selectScheme();});return button;}));selectScheme();
}
function selectScheme(){const d=schemeDetails[selectedScheme];$$('[data-scheme]').forEach(n=>{n.classList.toggle('selected',n.dataset.scheme===selectedScheme);n.setAttribute('aria-pressed',String(n.dataset.scheme===selectedScheme));});$('#scheme-guidance-title').textContent=d.title;$('#scheme-guidance').textContent=d.advice;}
$('#scheme-example').addEventListener('click',()=>{if(busy)return;setChannel('sms');$('#content').value=schemeDetails[selectedScheme].example;$('#content').dispatchEvent(new Event('input'));location.hash='analyzer';});
const glossaryTerms=[['Риск-балл','Индекс от 0 до 100, основанный на найденных признаках. Это не вероятность мошенничества.'],['Фишинг','Обман, с помощью которого пытаются получить ваши данные, доступ к аккаунтам или деньги.'],['Подмена домена','Адрес похож на знакомый сайт, но может принадлежать другому владельцу. Проверяйте полный домен.'],['Короткая ссылка','Сокращённый адрес, скрывающий конечный сайт. Qalqan не открывает ссылку и не узнаёт адрес назначения.'],['Срочность','Давление в сообщении: «сейчас», «немедленно», «осталось 10 минут». Мошенники торопят, чтобы вы не успели проверить.'],['Поддомен','Часть адреса перед основным доменом. В kaspi.kz.verify.example основной домен — verify.example.'],['Гомоглифы и punycode','Похожие буквы из разных алфавитов могут маскировать адрес. Punycode записывает международный домен с префиксом xn--.'],['Precision','Доля действительно опасных сообщений среди тех, на которые сработала модель.'],['Recall','Доля найденных опасных сообщений среди всех опасных сообщений тестового набора.'],['F1','Общая мера Precision и Recall: их гармоническое среднее.'],['ROC-AUC','Насколько модель различает два класса при изменении порога. Это характеристика тестового набора.'],['Ложные тревоги / FPR','Доля безопасных сообщений, ошибочно отмеченных как опасные.'],['Синтетические данные','Учебные примеры, созданные авторами. Результаты на них нельзя считать точностью на реальных сообщениях.'],['Доверительный интервал','Диапазон неопределённости оценки. Здесь он получен повторными выборками групп синтетических шаблонов.']];
$('#glossary-list').replaceChildren(...glossaryTerms.map(([term,definition])=>{const card=node('article',null,'card glossary-entry');card.append(node('h2',term),node('p',definition));return card;}));
$('#glossary-search').addEventListener('input',()=>{const query=$('#glossary-search').value.trim().toLocaleLowerCase('ru-RU');let count=0;$$('.glossary-entry').forEach(n=>{n.hidden=!n.textContent.toLocaleLowerCase('ru-RU').includes(query);if(!n.hidden)count++;});$('#glossary-empty').hidden=!!count;});
function showPresentation(){ $('#presentation-slide-how').hidden=presentationSlide!==0;$('#presentation-slide-metrics').hidden=presentationSlide!==1;$('#presentation-counter').textContent=(presentationSlide+1)+' / 2';$('#presentation-prev').disabled=presentationSlide===0;$('#presentation-next').disabled=presentationSlide===1;}
$('#presentation-next').addEventListener('click',()=>{presentationSlide=1;showPresentation();});$('#presentation-prev').addEventListener('click',()=>{presentationSlide=0;showPresentation();});
async function presentationMetrics(version){showPresentation();try{const d=await api('metrics');if(version!==routeVersion)return;if(d.status!=='evaluated')throw new Error('Метрики ещё не рассчитаны.');$('#slide-rows').textContent=d.train_rows+d.test_rows;$('#slide-f1').textContent=d.hybrid.f1.toFixed(3).replace('.',',');$('#slide-fpr').textContent=d.hybrid.false_positive_rate.toFixed(3).replace('.',',');$('#presentation-error').hidden=true;}catch(e){if(version!==routeVersion)return;$('#presentation-error').textContent=e.message;$('#presentation-error').hidden=false;}}
$('#telegram-run').addEventListener('click',async()=>{if(busy||authBusy)return;setBusy(true);const target=$('#telegram-response');target.replaceChildren(node('p','Проверяем учебный пример…'));try{const r=await api('analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:samples.phishing.text,channel:'sms'})});renderResult(r,samples.phishing.text);target.replaceChildren(node('h2','Риск: '+r.score+' из 100'),node('p',verdicts[r.verdict],r.verdict+'-text'));const list=node('ul');r.signals.slice(0,3).forEach(signal=>list.append(node('li',signal.title)));target.append(list);const a=node('a','Показать причины','primary-button');a.href='#result';target.append(a,node('p','Анализ выполнен API сайта. Telegram-бот пока не подключён.','card-description'));}catch(e){target.replaceChildren(node('p',e.message,'form-error'));}finally{setBusy(false);}});
async function checkConnection(){const health=await api('health');$('#connection-status').textContent='Сервис доступен';$('#api-dot').classList.remove('offline');$('#api-dot').classList.add('online');if(health.history_persistence==='ephemeral')$('#history-retention').textContent='До 200 результатов. История в демо временная и может исчезнуть при перезапуске сервиса. Сохраните нужные PDF.';return health;}
$('#connection-retry').addEventListener('click',async()=>{$('#connection-retry').disabled=true;$('#connection-retry-status').textContent='Проверяем соединение…';try{await checkConnection();await refreshAccount();$('#connection-retry-status').textContent='Сервис доступен. Можно вернуться к анализатору.';}catch(e){$('#connection-retry-status').textContent=e.message;}finally{$('#connection-retry').disabled=false;}});

window.addEventListener('hashchange',route);
(async()=>{
  try{
    await checkConnection();
  }catch(_){$('#connection-status').textContent='Нет связи';$('#api-dot').classList.add('offline');toast('Сервер недоступен. Обновите страницу после его запуска.');}
  await route();
  if(location.hash!=='#account')refreshAccount().catch(()=>{});
})();
