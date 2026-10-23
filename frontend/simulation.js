/* Accessible phone controls are independent of the optional WebGL view. */
window.QalqanSimulation = (() => {
  'use strict';
  const E=window.QalqanSimulationEngine,I=window.QalqanI18n;
  const $=id=>document.getElementById(id),pair=(ru,kk)=>I.language()==='kk'?kk:ru;
  let session=E.createSession(E.stories[0].id),scene=null,callbacks={},saved=null,active=false;
  const labels={
    title:['Сначала подумайте. Потом действуйте.','Алдымен ойланыңыз. Содан кейін әрекет етіңіз.'],
    intro:['Три ситуации, один телефон. Исследуйте сообщение, выберите действие и разберите последствия.','Үш жағдай, бір телефон. Хабарламаны зерттеңіз, әрекет таңдаңыз және салдарын талдаңыз.'],
    notice:['Учебная симуляция · вымышленные данные. Сайты не открываются, коды и деньги не отправляются.','Оқу симуляциясы · ойдан шығарылған деректер. Сайттар ашылмайды, кодтар мен ақша жіберілмейді.'],
    choose:['Выберите ситуацию','Жағдайды таңдаңыз'],room:['Ваше рабочее место','Сіздің жұмыс орныңыз'],
    roomHint:['Поверните комнату мышью или кнопками. Нажмите на телефон.','Бөлмені тінтуірмен не батырмалармен бұрыңыз. Телефонды басыңыз.'],
    phone:['Учебный телефон','Оқу телефоны'],unverified:['Имя отправителя не проверено','Жіберушінің аты тексерілмеген'],
    notification:['Пришло сообщение','Хабарлама келді'],notificationHint:['Откройте телефон, чтобы прочитать его и выбрать следующий шаг.','Хабарламаны оқып, келесі қадамды таңдау үшін телефонды ашыңыз.'],
    open_phone:['Открыть телефон','Телефонды ашу'],analyze:['Проверить через Qalqan','Qalqan арқылы тексеру'],
    open_link:['Открыть учебную ссылку','Оқу сілтемесін ашу'],contact:['Связаться с банком самостоятельно','Банкке өзім хабарласу'],ignore:['Остановиться, не отвечать','Тоқтау, жауап бермеу'],
    send_demo:['Отправить учебный код','Оқу кодын жіберу'],transfer_demo:['Выполнить учебный перевод','Оқу аударымын жасау'],
    page:['Учебная страница','Оқу беті'],pageHint:['Это экран внутри симулятора. Адрес показан как текст; перехода на сайт не было.','Бұл — симулятор ішіндегі экран. Мекенжай мәтін ретінде көрсетілген; сайт ашылған жоқ.'],
    outcome:['Разбор вашего решения','Шешіміңізді талдау'],
    received:['Только получил сообщение','Тек хабарлама алдым'],opened:['Открыл ссылку','Сілтемені аштым'],entered:['Ввёл данные','Деректерді енгіздім'],transferred:['Перевёл деньги','Ақша аудардым'],
    incident:['Ситуация в симуляции: ','Симуляциядағы жағдай: '],
    next:['Следующая ситуация →','Келесі жағдай →'],reset:['Пройти заново','Қайта өту'],
    analysis:['Результат анализатора Qalqan','Qalqan талдаушысының нәтижесі'],
    scoreHint:['Индекс признаков 0–100, не вероятность мошенничества. Анализируется только исходное сообщение.','Белгілер индексі 0–100, алаяқтық ықтималдығы емес. Тек бастапқы хабарлама талданады.'],
    report:['Сохранить и открыть полный разбор','Сақтау және толық талдауды ашу'],reportAgain:['Открыть сохранённый разбор','Сақталған талдауды ашу'],
    saveHint:['В историю вкладки попадёт текст и выбранная ситуация. Список учебных действий туда не переносится.','Бет тарихына мәтін мен таңдалған жағдай сақталады. Оқу әрекеттерінің тізімі оған көшірілмейді.'],
    author:['Пояснение автора сюжета','Оқиға авторының түсіндірмесі'],
    guidance:['Если такое произошло в жизни','Мұндай жағдай өмірде болса'],sources:['Официальные рекомендации','Ресми кеңестер'],
    journal:['Ваш путь в этой ситуации','Бұл жағдайдағы әрекеттеріңіз'],privacy:['Только в памяти вкладки. Перезагрузка, смена ситуации или очистка истории удаляют этот путь.','Тек бет жадында. Бетті қайта жүктеу, жағдайды ауыстыру не тарихты тазалау осы әрекеттерді жояды.'],
    fallback:['3D недоступно. Все решения и разборы работают в обычном режиме.','3D қолжетімсіз. Барлық таңдаулар мен талдаулар кәдімгі режимде жұмыс істейді.'],
    left:['Повернуть влево','Солға бұру'],right:['Повернуть вправо','Оңға бұру'],zoomIn:['Приблизить','Жақындату'],zoomOut:['Отдалить','Алыстату'],camera:['Сбросить камеру','Камераны қалпына келтіру'],
    keyboard:['3D комната. Стрелки влево и вправо — поворот, плюс и минус — масштаб, Home — сброс. Телефон доступен следующей кнопкой.','3D бөлме. Сол және оң жақ көрсеткілер — бұру, плюс пен минус — масштаб, Home — қалпына келтіру. Телефон келесі батырма арқылы қолжетімді.']
  };
  const t=key=>labels[key][I.language()==='kk'?1:0];
  function el(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
  function button(text,fn,cls='secondary-button'){const b=el('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;}
  function heading(text,id){const n=el('h2',text);if(id)n.id=id;n.tabIndex=-1;return n;}
  function source(text,cls){const n=el('p',text,cls);n.dataset.userText='';return n;}
  function select(id,focus=false){session=E.createSession(id);saved=null;scene?.reset();render();if(focus)$('sim-phone-title').focus();}
  function act(action){
    const incident=session.state.incident;
    session.act(action);if(incident!==session.state.incident)saved=null;render();
    (action==='analyze'?$('sim-analysis-title'):$('sim-phone-title')).focus();
  }
  function actions(target){
    const list=el('div',null,'sim-actions');
    session.options().forEach(action=>{const b=button(t(action),()=>act(action),action==='analyze'||action==='open_phone'?'primary-button':'secondary-button');b.dataset.simAction=action;list.append(b);});
    target.append(list);
  }
  function renderPhone(){
    const s=session.state,p=$('sim-phone-body');p.replaceChildren();
    p.append(el('span',t('phone'),'sim-kicker'));
    if(s.phase==='notification'){
      p.append(el('div','✉','sim-notification-icon'),heading(t('notification'),'sim-phone-title'),el('p',t('notificationHint'),'card-description'));actions(p);return;
    }
    if(s.phase==='message'){
      p.append(heading(session.story.sender[I.language()],'sim-phone-title'),el('p',t('unverified'),'card-description'),source(session.story.message,'sim-message'));actions(p);return;
    }
    if(s.phase==='page'){
      p.append(heading(t('page'),'sim-phone-title'),source(session.story.url,'sim-address'),el('p',t('pageHint'),'card-description'));
      const code=session.story.intent==='code';
      p.append(el('span',code?pair('Вымышленный код','Ойдан шығарылған код'):pair('Вымышленная сумма','Ойдан шығарылған сома'),'sim-kicker'),el('strong',code?'000 000':'20 000 ₸','sim-demo-value'));
      actions(p);return;
    }
    p.append(heading(t('outcome'),'sim-phone-title'));
    const outcomes={
      send_demo:pair('В учебном сюжете код передан злоумышленнику. В жизни такой код может дать доступ к операции или аккаунту. Здесь использован только вымышленный код.','Оқу оқиғасында код алаяққа берілді. Өмірде мұндай код операцияға не аккаунтқа қолжетімділік беруі мүмкін. Мұнда тек ойдан шығарылған код қолданылды.'),
      transfer_demo:pair('В учебном сюжете выбран перевод на чужой счёт. Реальные деньги не списывались. В жизни возврат такого перевода может быть невозможен.','Оқу оқиғасында бөтен шотқа аудару таңдалды. Нақты ақша алынған жоқ. Өмірде мұндай аударымды қайтару мүмкін болмауы ықтимал.'),
      contact:pair('Вы выбрали самостоятельную связь с банком через его приложение или номер на карте. В симуляции звонка не было; ответ банка не моделируется.','Банкке оның қолданбасы не картадағы нөмір арқылы өзіңіз хабарласуды таңдадыңыз. Симуляцияда қоңырау шалынған жоқ; банк жауабы модельденбейді.'),
      ignore:pair('Вы остановили взаимодействие с сообщением. Если остаются сомнения об операции, проверьте её в приложении банка самостоятельно.','Хабарламамен әрекеттесуді тоқтаттыңыз. Операцияға күмән қалса, оны банк қолданбасында өзіңіз тексеріңіз.')
    };
    p.append(el('p',outcomes[s.ending],'sim-outcome-text'),el('p',t('incident')+t(s.incident),'sim-incident'));
    if(s.incident==='opened')p.append(el('p',pair('Само открытие ссылки не доказывает взлом. Дальнейшие шаги зависят от того, что было сделано на странице.','Сілтемені ашудың өзі бұзылғанын дәлелдемейді. Келесі қадамдар бетте не істелгеніне байланысты.'),'card-description'));
    actions(p);
    const restart=el('div',null,'sim-actions'),next=(E.stories.indexOf(session.story)+1)%E.stories.length;
    restart.append(button(t('reset'),()=>select(session.story.id,true),'text-button'),button(t('next'),()=>select(E.stories[next].id,true)));p.append(restart);
  }
  function renderReview(){
    const s=session.state,result=session.result(),review=$('sim-review');review.hidden=s.phase!=='outcome';review.replaceChildren();
    if(s.phase!=='outcome')return;
    const author=el('article',null,'card'),guidance=el('article',null,'card');
    author.append(el('span','QALQAN / '+session.story.number,'sim-kicker'),el('h2',t('author')),el('p',session.story.author[I.language()]));
    const plan=window.QalqanGuidance.plan(s.incident,result,I.language()),steps=el('ol');
    plan.steps.forEach(step=>steps.append(el('li',step)));
    guidance.append(el('h2',t('guidance')),el('p',plan.context,'card-description'),steps);
    const links=el('details'),list=el('ul');links.append(el('summary',t('sources')));
    plan.sources.forEach(item=>{const li=el('li'),a=el('a',item.title);a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);list.append(li);});links.append(list);guidance.append(links);review.append(author,guidance);
  }
  function renderAnalysis(){
    const result=session.result(),panel=$('sim-analysis');panel.hidden=!result;panel.replaceChildren();if(!result)return;
    const verdict={low:pair('Низкий индекс','Төмен индекс'),suspicious:pair('Есть подозрительные признаки','Күмәнді белгілер бар'),high:pair('Много признаков риска','Қауіп белгілері көп')};
    const head=el('div',null,'sim-analysis-head');head.append(heading(t('analysis'),'sim-analysis-title'),el('strong',result.score+' / 100','sim-score '+result.verdict+'-text'),el('span',verdict[result.verdict]));
    panel.append(head,el('p',t('scoreHint'),'card-description'),window.QalqanEvidence.render(result),el('p',window.QalqanEvidence.summary(result),'card-description'),el('p',window.QalqanEvidence.limits(),'card-description'));
    const open=button(t(saved?'reportAgain':'report'),()=>{
      if(!saved)saved=callbacks.save({content:session.story.message,channel:session.story.channel,mode:'single'},session.state.incident);
      // A saved report is a snapshot of the situation at the moment it was first saved.
      callbacks.open(saved);
    });open.id='sim-report';panel.append(open,el('p',t('saveHint'),'card-description'));
  }
  function render(){
    document.querySelectorAll('[data-sim-i18n]').forEach(n=>{n.textContent=t(n.dataset.simI18n);});
    const picker=$('sim-stories');picker.replaceChildren();picker.setAttribute('aria-label',t('choose'));
    E.stories.forEach(story=>{const b=button('',()=>{select(story.id);picker.querySelector('[aria-pressed="true"]').focus();}, 'sim-story');b.dataset.story=story.id;b.setAttribute('aria-pressed',String(story===session.story));b.append(el('span',story.number),el('strong',story.title[I.language()]));picker.append(b);});
    $('sim-intro').textContent=session.story.intro[I.language()];
    $('sim-canvas').setAttribute('aria-label',t('keyboard'));
    const s=session.state;$('view-simulator').dataset.phase=s.phase;
    $('sim-hotspot').hidden=s.phase!=='notification';$('sim-hotspot').textContent=t('open_phone')+' ↗';
    document.querySelectorAll('[data-sim-camera]').forEach(n=>{n.title=t(n.dataset.simLabel);n.setAttribute('aria-label',t(n.dataset.simLabel));});
    $('sim-step').textContent=pair('Шаг ','Қадам ')+(s.phase==='notification'?'1 / 3':s.phase==='outcome'?'3 / 3':'2 / 3');
    renderPhone();renderAnalysis();renderReview();
    $('sim-journal-card').hidden=!s.journal.length;$('sim-journal').replaceChildren(...s.journal.map(a=>el('li',t(a))));
    scene?.setPhase(s.phase);
  }
  function init(options){
    callbacks=options;
    $('sim-hotspot').addEventListener('click',()=>act('open_phone'));
    document.querySelectorAll('[data-sim-camera]').forEach(n=>n.addEventListener('click',()=>n.dataset.simCamera==='reset'?scene?.reset():scene?.move(n.dataset.simCamera)));
    render();
  }
  function onRoute(view){
    active=view==='simulator';
    if(active){
      render();
      if(!scene)scene=window.QalqanSimulationScene.create($('sim-canvas'),{
        project({x,y}){$('sim-hotspot').style.left=x+'%';$('sim-hotspot').style.top=y+'%';},
        onAvailability(available){$('sim-stage').classList.toggle('sim-flat',!available);$('sim-fallback').hidden=available;document.querySelectorAll('[data-sim-camera]').forEach(n=>{n.disabled=!available;});if(!available){$('sim-hotspot').style.left='50%';$('sim-hotspot').style.top='53%';}}
      });
      scene.setPhase(session.state.phase);
    }
    scene?.setActive(active);
  }
  return {init,onRoute,clear(){select(E.stories[0].id);}};
})();
