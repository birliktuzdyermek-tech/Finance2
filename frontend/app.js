'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const names = {demo:'Демо для жюри',analyzer:'Анализатор',batch:'Пакетная проверка',dashboard:'Обзор угроз',history:'История проверок',compare:'Сравнение',research:'Модель и метрики',account:'Аккаунт',privacy:'Данные и приватность',settings:'О проекте'};
const verdicts = {low:'Низкий риск',suspicious:'Подозрительно',high:'Высокий риск'};
const channels = {sms:'SMS',whatsapp:'WhatsApp',email:'Email',url:'Ссылка'};
let channel='sms', historyItems=[], busy=false, toastTimer, routeVersion=0;
let historyPage=1;
const selectedChecks=new Set(), pageSize=20;
let authChallenge=null,authBusy=false,authDeliveryAvailable=false;
let activeResultId=null;
let currentView='';
function node(tag,text,cls) { const n=document.createElement(tag); if(text!=null)n.textContent=text; if(cls)n.className=cls; return n; }
function toast(message) { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>{$('#toast').hidden=true;},5000); }
async function api(path,options={}) {
  let r;try{r=await fetch('/api/'+path,{credentials:'same-origin',...options});}catch(_){throw new Error('Сервер недоступен. Проверьте соединение и попробуйте ещё раз.');}
  if(!r.ok) { let message='Ошибка сервера. Попробуйте ещё раз.'; try{const e=await r.json();if(typeof e.detail==='string')message=e.detail;else if(Array.isArray(e.detail)){const fields={phone:'Укажите телефон с кодом страны, например +7 701 234 56 78.',email:'Проверьте адрес электронной почты.',consent:'Подтвердите согласие на обработку данных.',sms_code:'Код из SMS должен содержать 6 цифр.',email_code:'Код из письма должен содержать 6 цифр.',content:'Каждая запись — от 3 до 10 000 символов.',items:'Добавьте от 1 до 10 записей.',channel:'Выберите источник сообщения.'};message=[...new Set(e.detail.map(v=>fields[v.loc?.at(-1)]||'Проверьте данные формы.'))].join(' ');}}catch(_){}const retry=Number(r.headers.get('Retry-After'));if(r.status===429&&retry>0)message='Лимит запросов. Повторите через '+(retry>60?Math.ceil(retry/60)+' мин.':retry+' сек.');throw new Error(message); }
  return r.status===204?null:r.json();
}
function setChannel(value) {
  channel=value;
  $$('[data-channel]').forEach(b=>{b.classList.toggle('selected',b.dataset.channel===value);b.setAttribute('aria-pressed',String(b.dataset.channel===value));});
  $('#content-label').textContent=value==='url'?'Ссылка для проверки':'Текст сообщения';
  $('#content').placeholder=value==='url'?'https://example.com':'Например: «Ваш счёт будет заблокирован. Срочно подтвердите данные по ссылке…»';
}
function renderResult(r) {
  activeResultId=r.id;$('#feedback-consent').checked=false;$('#feedback-status').textContent='';
  $('#result-empty').hidden=true;$('#result-content').hidden=false;$('#result-status').textContent='Проверка завершена';
  $('#risk-score').textContent=r.score;$('#risk-circle').className='risk-circle '+r.verdict;
  $('#risk-verdict').className='pill '+r.verdict;$('#risk-verdict').textContent=verdicts[r.verdict];
  $('#risk-title').textContent={high:'Обнаружены признаки угрозы',suspicious:'Стоит проверить внимательнее',low:'Мало явных признаков риска'}[r.verdict];
  $('#rules-score').textContent=r.rules_score+' / 100';$('#ml-score').textContent=r.ml_score===null?'Не применяется':r.ml_score+' / 100';$('#duration').textContent=r.duration_ms+' мс';
  $('#signals').replaceChildren(...r.signals.map(s=>{const row=node('div',null,'signal-row');row.append(node('span','!'),node('span',s.title),node('span','+'+s.weight,'signal-weight'));return row;}));
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
  (selectable?['Выбрать','Дата и время','Источник','Риск-балл','Вердикт','Отчёт']:['Дата и время','Источник','Риск-балл','Вердикт','Отчёт']).forEach(v=>hr.append(node('th',v)));head.append(hr);
  items.slice(0,limit).forEach(item=>{
    const row=node('tr');
    if(selectable){const cell=node('td'),check=node('input');check.type='checkbox';check.checked=selectedChecks.has(item.id);check.setAttribute('aria-label','Выбрать проверку '+item.id);check.addEventListener('change',()=>{if(check.checked){if(selectedChecks.size===2){check.checked=false;toast('Для сравнения выберите две проверки. Снимите один из флажков.');return;}selectedChecks.add(item.id);}else selectedChecks.delete(item.id);updateSelection();});cell.append(check);row.append(cell);}
    row.append(node('td',new Date(item.created_at).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})),node('td',channels[item.channel]));
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
  $('#dashboard-stats').replaceChildren(stat('Всего проверок',d.total,'Ваша история'),stat('Высокий риск',d.counts.high,'Требуют внимания','high'),stat('Подозрительно',d.counts.suspicious,'Нужна дополнительная проверка','suspicious'),stat('Среднее время',d.average_ms+' мс','Анализ, без HTTP и сохранения'));
  dailyChart(d.daily);typesChart(d.types);$('#recent-checks').replaceChildren(table(h.items,5));
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
  const value=location.hash.slice(1),view=names[value]?value:'analyzer',version=++routeVersion;
  if(currentView!==view){window.scrollTo(0,0);currentView=view;}
  $$('.view').forEach(s=>{s.hidden=s.id!=='view-'+view;});$$('[data-view]').forEach(a=>{a.classList.toggle('active',a.dataset.view===view);a.setAttribute('aria-current',a.dataset.view===view?'page':'false');});$('#page-name').textContent=names[view];
  closeNavigation();
  if(view==='history')empty($('#history-list'),'Загружаем историю…');if(view==='compare'){empty($('#compare-results'),'Загружаем проверки…');$('#compare-hint').textContent='';}
  try {if(view==='dashboard')await dashboard(version);if(view==='history'||view==='compare'){const d=await api('history');if(version===routeVersion){historyItems=d.items;for(const id of selectedChecks)if(!historyItems.some(i=>i.id===id))selectedChecks.delete(id);if(view==='history')renderHistory();else prepareComparison();}}if(view==='research')await research(version);if(view==='account')await refreshAccount(version);}catch(e){if(version!==routeVersion)return;if(view==='history')empty($('#history-list'),'Не удалось загрузить историю. Попробуйте открыть раздел ещё раз.');if(view==='compare')empty($('#compare-results'),'Не удалось загрузить проверки.');toast(e.message||'API недоступен.');}
}
function closeNavigation(){$('.sidebar').classList.remove('nav-open');$('#nav-toggle').setAttribute('aria-expanded','false');}
$('#nav-toggle').addEventListener('click',()=>{const open=$('.sidebar').classList.toggle('nav-open');$('#nav-toggle').setAttribute('aria-expanded',String(open));});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeNavigation();});
function setBusy(value){busy=value;$$('#analyze-button,#batch-submit,#batch-example,#paste-message,#content,#batch-content,#batch-channel,[data-demo],[data-sample],[data-channel]').forEach(n=>{n.disabled=value;});$('#analysis-form').setAttribute('aria-busy',String(value));$('#batch-form').setAttribute('aria-busy',String(value));}
const actionPlans={received:['Не переходите по ссылке и не отвечайте сообщением с личными данными.','Проверьте информацию через официальное приложение банка или номер на вашей карте.','При необходимости сохраните сообщение и пожалуйтесь на отправителя в мессенджере.'],clicked:['Закройте страницу. Не вводите данные и не загружайте предложенные файлы.','Если файл уже скачан, не открывайте его. Если он запущен, проверьте устройство средствами защиты.','Проверьте операции через приложение банка. Если вводили данные, перейдите к шагам «Ввёл данные».'],entered:['Сразу свяжитесь со своим банком через официальное приложение или номер на карте. Сообщите, какие данные передали.','Обсудите с банком блокировку карты или защиту аккаунта и проверьте последние операции.','Смените раскрытые пароли через официальные сервисы с доверенного устройства. Не сообщайте новые коды.'],paid:['Сразу сообщите банку о возможном мошенничестве и уточните возможность остановки или оспаривания перевода. Возврат не гарантирован.','Сохраните сведения об операции, переписку и адрес сайта. Не публикуйте секреты или полные данные карты.','Подайте обращение в правоохранительные органы через официальные каналы. Не платите людям, обещающим гарантированный возврат.']};
function actionPlan(key){$$('[data-action]').forEach(b=>{b.classList.toggle('selected',b.dataset.action===key);b.setAttribute('aria-pressed',String(b.dataset.action===key));});$('#action-steps').replaceChildren(...actionPlans[key].map(s=>node('li',s)));}
$$('[data-action]').forEach(b=>b.addEventListener('click',()=>actionPlan(b.dataset.action)));actionPlan('received');
$$('[data-feedback]').forEach(b=>b.addEventListener('click',async()=>{if(!activeResultId)return;if(!$('#feedback-consent').checked){$('#feedback-status').textContent='Для сохранения отзыва нужно отметить согласие.';return;}const id=activeResultId;$$('[data-feedback]').forEach(n=>{n.disabled=true;});try{const r=await api('checks/'+encodeURIComponent(id)+'/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vote:b.dataset.feedback,consent:true})});if(id===activeResultId)$('#feedback-status').textContent=r.message;}catch(e){if(id===activeResultId)$('#feedback-status').textContent=e.message;}finally{$$('[data-feedback]').forEach(n=>{n.disabled=false;});}}));
$('#paste-message').addEventListener('click',async()=>{if(busy)return;try{if(!navigator.clipboard?.readText)throw new Error();const text=await navigator.clipboard.readText();if(text.length>10000){toast('Сообщение больше 10 000 символов. Вставьте только нужную часть.');return;}$('#content').value=text;$('#content').dispatchEvent(new Event('input'));$('#content').focus();}catch(_){toast('Разрешите доступ к буферу или нажмите и удерживайте поле сообщения, затем выберите «Вставить».');$('#content').focus();}});

function showAccount(p){authDeliveryAvailable=p.delivery_available;$('#account-member').hidden=!p.authenticated;$('#account-guest').hidden=p.authenticated;$('#account-link').textContent=p.authenticated?'Мой аккаунт':'Войти';$('#session-kind').textContent=p.authenticated?'История аккаунта':'Личная сессия';$('#account-send').disabled=!authDeliveryAvailable||authBusy;$('#auth-availability').textContent=p.delivery_available?'Отправим два кода: на ваш телефон и почту. Для входа нужны оба контакта.':(p.unavailable_reason||'Доставка кодов пока не подключена. Регистрация станет доступна после настройки SMS и почты. Проверка сообщений работает без входа.');if(p.authenticated){$('#account-details').replaceChildren(detail('Почта',p.email),detail('Телефон',p.phone));authChallenge=null;$('#account-start').hidden=false;$('#account-verify').hidden=true;}}
async function refreshAccount(version){const p=await api('auth/me');if(version===undefined||version===routeVersion)showAccount(p);}
function authError(message){$('#account-error').textContent=message;$('#account-error').hidden=false;}
function setAuthBusy(value){authBusy=value;$$('#account-send,#account-confirm,#account-restart,#account-logout,#account-delete').forEach(n=>{n.disabled=value;});$('#account-send').disabled=value||!authDeliveryAvailable;$('#account-start').setAttribute('aria-busy',String(value));$('#account-verify').setAttribute('aria-busy',String(value));}
$('#account-start').addEventListener('submit',async e=>{e.preventDefault();if(authBusy||busy)return;setAuthBusy(true);$('#account-error').hidden=true;$('#account-status').textContent='Отправляем коды…';try{const r=await api('auth/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:$('#account-phone').value,email:$('#account-email').value,consent:$('#account-consent').checked})});authChallenge=r.challenge_id;$('#account-start').hidden=true;$('#account-verify').hidden=false;$('#account-status').textContent=r.message;$('#sms-code').focus();}catch(e){authError(e.message);$('#account-status').textContent='Коды не отправлены.';}finally{setAuthBusy(false);}});
$('#account-restart').addEventListener('click',()=>{authChallenge=null;$('#account-start').hidden=false;$('#account-verify').hidden=true;$('#sms-code').value='';$('#email-code').value='';$('#account-status').textContent='';$('#account-error').hidden=true;refreshAccount().catch(e=>authError(e.message));});
$('#account-verify').addEventListener('submit',async e=>{e.preventDefault();if(authBusy||busy||!authChallenge)return;setAuthBusy(true);$('#account-error').hidden=true;try{const p=await api('auth/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challenge_id:authChallenge,sms_code:$('#sms-code').value,email_code:$('#email-code').value})});showAccount(p);$('#sms-code').value='';$('#email-code').value='';$('#account-status').textContent='Оба контакта подтверждены. Вы вошли в аккаунт.';toast('Вход выполнен. История доступна на ваших устройствах.');}catch(e){authError(e.message);}finally{setAuthBusy(false);}});
function clearPrivateViews(){historyItems=[];selectedChecks.clear();historyPage=1;$('#result-content').hidden=true;$('#result-empty').hidden=false;$('#result-status').textContent='Ожидает проверки';$('#batch-output').hidden=true;$('#batch-status').textContent='';$('#compare-results').replaceChildren();$('#dashboard-stats').replaceChildren();$('#recent-checks').replaceChildren();renderHistory();}
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
  e.preventDefault();if(busy||authBusy)return;const content=$('#content').value.trim();if(content.length<3){toast('Введите минимум 3 символа.');return;}
  setBusy(true);$('#analyze-button').setAttribute('aria-busy','true');$('#result-status').textContent='Анализируем…';$('#form-error').hidden=true;$('#result-content').hidden=true;$('#result-empty').hidden=false;
  try{renderResult(await api('analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content,channel})}));}
  catch(e){$('#form-error').textContent=e.message||'API недоступен.';$('#form-error').hidden=false;$('#result-status').textContent='Ошибка проверки';}
  finally{setBusy(false);$('#analyze-button').setAttribute('aria-busy','false');}
});
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
  try{await api('history',{method:'DELETE'});historyItems=[];selectedChecks.clear();historyPage=1;renderHistory();$('#batch-output').hidden=true;$('#compare-results').replaceChildren();$('#result-content').hidden=true;$('#result-empty').hidden=false;$('#result-status').textContent='Ожидает проверки';toast('История удалена.');}catch(e){toast(e.message);}
});
window.addEventListener('hashchange',route);
(async()=>{
  try{
    const health=await api('health');$('#connection-status').textContent='API подключён';$('#api-dot').classList.add('online');
    if(health.history_persistence==='ephemeral'){
      $('#history-retention').textContent='До 200 результатов в личной сессии. История в демо временная и может исчезнуть при перезапуске сервиса. Сохраните нужные PDF-отчёты.';
    }
  }catch(_){$('#connection-status').textContent='API недоступен';$('#api-dot').classList.add('offline');toast('Сервер недоступен. Обновите страницу после его запуска.');}
  await route();
  if(location.hash!=='#account')refreshAccount().catch(()=>{});
})();
