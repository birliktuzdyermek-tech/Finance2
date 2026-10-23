/* Accessible phone controls are independent of the optional WebGL view. */
window.QalqanSimulation = (() => {
  'use strict';
  const E=window.QalqanSimulationEngine,I=window.QalqanI18n,L=window.QalqanSimulationLessons;
  const $=id=>document.getElementById(id),pair=(ru,kk)=>I.language()==='kk'?kk:ru;
  let session=E.createSession(E.stories[0].id),scene=null,callbacks={},saved=null,active=false;
  const labels={
    title:['Сначала подумайте. Потом действуйте.','Алдымен ойланыңыз. Содан кейін әрекет етіңіз.'],
    intro:['Выберите ответ в диалоге, исследуйте ссылку и пройдите свой путь до карты решений. Три ситуации, один телефон.','Диалогта жауап таңдаңыз, сілтемені зерттеңіз және шешімдер картасына дейін өз жолыңызды өтіңіз. Үш жағдай, бір телефон.'],
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
    scoreHint:['Индекс признаков 0–100, не вероятность мошенничества. Анализируются только уже полученные реплики собеседника. Ваши кнопки, ответы задания и будущие сообщения в балл не входят.','Белгілер индексі 0–100, алаяқтық ықтималдығы емес. Әңгімелесушіден алынған репликалар ғана талданады. Батырмалар, тапсырма жауаптары мен болашақ хабарламалар баллға кірмейді.'],
    report:['Сохранить и открыть полный разбор','Сақтау және толық талдауды ашу'],reportAgain:['Открыть сохранённый разбор','Сақталған талдауды ашу'],
    saveHint:['В историю вкладки попадут уже полученные реплики и выбранная ситуация. Решения и учебная разметка туда не переносятся.','Бет тарихына алынған репликалар мен таңдалған жағдай сақталады. Шешімдер мен оқу белгілері оған көшірілмейді.'],
    author:['Пояснение автора сюжета','Оқиға авторының түсіндірмесі'],
    guidance:['Если такое произошло в жизни','Мұндай жағдай өмірде болса'],sources:['Официальные рекомендации','Ресми кеңестер'],
    journal:['Ваш путь в этой ситуации','Бұл жағдайдағы әрекеттеріңіз'],privacy:['Только в памяти вкладки. Перезагрузка, смена ситуации или очистка истории удаляют этот путь.','Тек бет жадында. Бетті қайта жүктеу, жағдайды ауыстыру не тарихты тазалау осы әрекеттерді жояды.'],
    fallback:['3D недоступно. Все решения и разборы работают в обычном режиме.','3D қолжетімсіз. Барлық таңдаулар мен талдаулар кәдімгі режимде жұмыс істейді.'],
    left:['Повернуть влево','Солға бұру'],right:['Повернуть вправо','Оңға бұру'],zoomIn:['Приблизить','Жақындату'],zoomOut:['Отдалить','Алыстату'],camera:['Сбросить камеру','Камераны қалпына келтіру'],
    keyboard:['3D комната. Стрелки влево и вправо — поворот, плюс и минус — масштаб, Home — сброс. Телефон доступен следующей кнопкой.','3D бөлме. Сол және оң жақ көрсеткілер — бұру, плюс пен минус — масштаб, Home — қалпына келтіру. Телефон келесі батырма арқылы қолжетімді.'],
    respond:['Ответьте в учебном диалоге','Оқу диалогында жауап беріңіз'],you:['Ваш ответ','Сіздің жауабыңыз'],sender:['Собеседник','Әңгімелесуші'],
    transcript:['Полученные сообщения и ваши ответы','Алынған хабарламалар мен жауаптарыңыз'],
    stale:['Пришла новая реплика. Предыдущий результат скрыт: проверьте полученный диалог заново.','Жаңа реплика келді. Бұрынғы нәтиже жасырылды: алынған диалогты қайта тексеріңіз.'],
    inspect_link:['Исследовать ссылку','Сілтемені зерттеу'],check_link:['Проверить ответ о домене','Домен туралы жауапты тексеру'],
    inspectTitle:['Куда ведёт этот адрес?','Бұл мекенжай қайда апарады?'],
    inspectHint:['Выберите часть адреса, которая указывает домен назначения. Это учебное задание: сайт не открывается.','Мекенжайдың қай доменге апаратынын көрсететін бөлігін таңдаңыз. Бұл оқу тапсырмасы: сайт ашылмайды.'],
    inspectNotice:['HTTPS описывает соединение, а не надёжность владельца. Адреса .example вымышлены; подлинность сайта здесь не проверяется.','HTTPS қосылымды сипаттайды, иесінің сенімділігін емес. .example мекенжайлары ойдан шығарылған; сайт түпнұсқалығы мұнда тексерілмейді.'],
    inspectChoose:['Выберите один фрагмент адреса','Мекенжайдың бір бөлігін таңдаңыз'],
    inspectCorrect:['Домен найден верно','Домен дұрыс табылды'],inspectWrong:['Это другая часть адреса','Бұл — мекенжайдың басқа бөлігі'],
    inspectPending:['Ответ ещё не проверен. После завершения ситуации задание остаётся незавершённым.','Жауап әлі тексерілмеді. Жағдай аяқталғаннан кейін тапсырма аяқталмаған болып қалады.'],
    inspectDone:['Учебный ответ записан. Можно продолжить диалог или выбрать действие на телефоне.','Оқу жауабы жазылды. Диалогты жалғастыруға немесе телефонда әрекет таңдауға болады.'],
    continue:['Вернуться к телефону','Телефонға оралу'],
    mapTitle:['Карта ваших решений','Шешімдеріңіз картасы'],
    showMap:['Посмотреть карту решений','Шешімдер картасын көру'],
    inspectSummary:['Учебный ответ сохранён в карте решений этой попытки.','Оқу жауабы осы әрекеттің шешімдер картасында сақталды.'],
    mapHint:['Пройденный путь и пояснения автора. Раскройте шаг, чтобы увидеть последствие и следующий шаг. Это не оценка вашей защищённости.','Өткен жол және автор түсіндірмелері. Салдары мен келесі қадамын көру үшін қадамды ашыңыз. Бұл сіздің қорғаныс деңгейіңіздің бағасы емес.'],
    consequence:['Что произошло в сюжете','Оқиғада не болды'],safer:['Следующий безопасный шаг','Келесі қауіпсіз қадам'],
    mapNoTask:['Задание о ссылке не выполнялось.','Сілтеме тапсырмасы орындалмады.'],mapUnfinished:['Задание о ссылке открыто, но ответ не проверен.','Сілтеме тапсырмасы ашылды, бірақ жауап тексерілмеді.']
  };
  const t=key=>L.choices[key]?.[I.language()]||labels[key][I.language()==='kk'?1:0];
  function el(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
  function button(text,fn,cls='secondary-button'){const b=el('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;}
  function heading(text,id){const n=el('h2',text);if(id)n.id=id;n.tabIndex=-1;return n;}
  function source(text,cls){const n=el('p',text,cls);n.dataset.userText='';return n;}
  function select(id,focus=false){session=E.createSession(id);saved=null;scene?.reset();render();if(focus)$('sim-phone-title').focus();}
  function act(action){
    const before=session.state;
    session.act(action,I.language());if(before.incident!==session.state.incident||before.transcript.length!==session.state.transcript.length)saved=null;render();
    (action==='analyze'?$('sim-analysis-title'):action==='inspect_link'?$('sim-inspector-title'):$('sim-phone-title')).focus();
  }
  function actions(target){
    const list=el('div',null,'sim-actions');
    const replies=session.options().filter(a=>L.choices[a]);
    if(replies.length){const group=el('div',null,'sim-reply-choices');group.append(el('p',t('respond'),'sim-kicker'));replies.forEach(a=>{const b=button(t(a),()=>act(a),'sim-reply-button');b.dataset.simAction=a;group.append(b);});target.append(group);}
    session.options().filter(a=>!L.choices[a]).forEach(action=>{const b=button(t(action),()=>act(action),action==='analyze'||action==='open_phone'?'primary-button':'secondary-button');b.dataset.simAction=action;list.append(b);});
    target.append(list);
  }
  function renderPhone(){
    const s=session.state,p=$('sim-phone-body');p.replaceChildren();
    p.append(el('span',t('phone'),'sim-kicker'));
    if(s.phase==='notification'){
      p.append(el('div','✉','sim-notification-icon'),heading(t('notification'),'sim-phone-title'),el('p',t('notificationHint'),'card-description'));actions(p);return;
    }
    if(s.phase==='message'){
      p.append(heading(session.story.sender[I.language()],'sim-phone-title'),el('p',t('unverified'),'card-description'));
      const transcript=el('div',null,'sim-transcript');transcript.tabIndex=0;transcript.setAttribute('role','region');transcript.setAttribute('aria-label',t('transcript'));
      s.transcript.forEach(item=>{const row=el('div',null,'sim-bubble '+item.role);row.append(el('span',t(item.role==='user'?'you':'sender'),'sim-speaker'),source(item.text,item.role==='sender'?'sim-message':'sim-user-message'));transcript.append(row);});
      p.append(transcript);transcript.scrollTop=transcript.scrollHeight;
      if(!s.analyzed&&s.trace.some(e=>e.action==='analyze')){const stale=el('p',t('stale'),'sim-stale');stale.id='sim-analysis-stale';stale.setAttribute('role','status');p.append(stale);}
      actions(p);return;
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
    const jump=button(t('showMap'),()=>$('sim-map-title').focus(),'primary-button');jump.id='sim-show-map';p.append(jump);
    actions(p);
    const restart=el('div',null,'sim-actions'),next=(E.stories.indexOf(session.story)+1)%E.stories.length;
    restart.append(button(t('reset'),()=>select(session.story.id,true),'text-button'),button(t('next'),()=>select(E.stories[next].id,true)));p.append(restart);
  }
  function inspectionExplanation(selection){
    const domain=session.parts().find(p=>p.id==='domain').text;
    const detail={
      scheme:pair('HTTPS — это протокол. Он не указывает владельца сайта.','HTTPS — хаттама. Ол сайт иесін көрсетпейді.'),
      prefix:pair('Здесь kaspi.kz. — поддомен перед verify.example. Знакомое имя в начале не делает весь адрес банковским.','Мұнда kaspi.kz. — verify.example алдындағы қосалқы домен. Басында таныс атаудың болуы мекенжайды банкке тиесілі етпейді.'),
      path:pair('Путь после / обозначает страницу внутри сайта.','/ белгісінен кейінгі жол сайт ішіндегі бетті көрсетеді.'),
      domain:pair('Вы выбрали домен назначения этого учебного адреса.','Осы оқу мекенжайының баратын доменін таңдадыңыз.')
    };
    return detail[selection]+' '+pair('Домен здесь: ','Мұндағы домен: ')+domain+'.';
  }
  function renderInspector(){
    const panel=$('sim-inspector'),s=session.state,task=s.inspection;panel.hidden=!task.open;panel.replaceChildren();if(!task.open)return;
    panel.append(el('span','URL / LAB','sim-kicker'),heading(t('inspectTitle'),'sim-inspector-title'),el('p',t('inspectHint'),'card-description'));
    const address=source(session.story.url,'sim-full-address');panel.append(address);
    const parts=el('div',null,'sim-url-parts');parts.setAttribute('role','group');parts.setAttribute('aria-label',t('inspectChoose'));
    session.parts().forEach(part=>{
      const b=button('',()=>{session.choosePart(part.id);renderInspector();$('sim-inspector').querySelector('[data-url-part="'+part.id+'"]').focus();},'sim-url-part');
      b.dataset.urlPart=part.id;b.setAttribute('aria-pressed',String(task.selection===part.id));b.disabled=task.checked||s.phase==='outcome';
      const text=el('code',part.text);text.dataset.userText='';b.append(text);
      if(task.checked){b.append(el('small',L.partNames[part.id][I.language()]));if(part.id==='domain')b.classList.add('sim-domain-answer');}
      parts.append(b);
    });panel.append(parts);
    const check=button(t('check_link'),()=>{session.checkPart();render();$('sim-inspection-feedback').focus();},'primary-button');
    check.id='sim-check-link';check.disabled=!task.selection||task.checked||s.phase==='outcome';panel.append(check);
    if(task.checked){
      const feedback=el('div',null,'sim-inspection-feedback');feedback.id='sim-inspection-feedback';feedback.tabIndex=-1;feedback.setAttribute('role','status');feedback.dataset.correct=String(task.correct);
      feedback.append(el('strong',t(task.correct?'inspectCorrect':'inspectWrong')),el('p',inspectionExplanation(task.selection)),el('p',t(s.phase==='outcome'?'inspectSummary':'inspectDone'),'card-description'));panel.append(feedback);
    }else if(s.phase==='outcome')panel.append(el('p',t('inspectPending'),'card-description'));
    panel.append(el('p',t('inspectNotice'),'card-description'),button(t('continue'),()=>$('sim-phone-title').focus(),'text-button'));
  }
  function mapExplanation(entry){
    const p=(ru,kk)=>pair(ru,kk),guidance=window.QalqanGuidance.plan(entry.after,null,I.language()).steps[0];
    if(entry.reply)return {effect:session.story.intent==='none'?p('В ответ появилась справочная реплика без просьбы передать данные или деньги.','Жауап ретінде дерек не ақша сұрамайтын ақпараттық реплика келді.'):p('Ваш ответ привёл к новой попытке убеждения в учебном сюжете. Названная должность или номер сотрудника не подтверждают личность.','Жауабыңыз оқу оқиғасында сендірудің жаңа әрекетіне әкелді. Айтылған лауазым не қызметкер нөмірі жеке басты растамайды.'),next:p('Изучите новую реплику и проверьте полученный диалог. При сомнениях свяжитесь с банком самостоятельно.','Жаңа репликаны зерттеп, алынған диалогты тексеріңіз. Күмән болса, банкке өзіңіз хабарласыңыз.')};
    if(entry.action==='check_link')return {effect:t(entry.correct?'inspectCorrect':'inspectWrong')+'. '+inspectionExplanation(entry.selection),next:p('Проверяйте полный домен. Даже верный ответ в задании не подтверждает сайт.','Толық доменді тексеріңіз. Тапсырмадағы дұрыс жауап та сайтты растамайды.')};
    if(entry.action==='analyze')return {effect:p(`Проверено входящих реплик: ${entry.replyCount}. Индекс на этом шаге: ${entry.analysis.score} / 100.`,`Тексерілген кіріс репликалары: ${entry.replyCount}. Осы қадамдағы индекс: ${entry.analysis.score} / 100.`),next:p('Прочитайте точные фрагменты и причины. Новый ответ собеседника требует новой проверки.','Нақты үзінділер мен себептерді оқыңыз. Әңгімелесушінің жаңа жауабы қайта тексеруді қажет етеді.')};
    const effects={
      open_phone:p('Вы прочитали сообщение. Личность отправителя ещё не установлена.','Хабарламаны оқыдыңыз. Жіберушінің кім екені әлі анықталған жоқ.'),
      inspect_link:p('Вы рассмотрели текст адреса, не открывая сайт.','Сайтты ашпай, мекенжай мәтінін қарадыңыз.'),
      open_link:p('Открыта только учебная страница внутри Qalqan. В карте отмечено открытие ссылки, а не подтверждённый взлом.','Qalqan ішіндегі оқу беті ғана ашылды. Картада сілтеме ашылғаны белгіленді, бұзылғаны расталған жоқ.'),
      send_demo:p('В сюжете передан вымышленный код. Реальные данные не отправлялись.','Оқиғада ойдан шығарылған код берілді. Нақты деректер жіберілген жоқ.'),
      transfer_demo:p('В сюжете выбран перевод на чужой счёт. Реальные деньги не списывались.','Оқиғада бөтен шотқа аудару таңдалды. Нақты ақша алынған жоқ.'),
      contact:p('Выбрана самостоятельная связь с банком. Симулятор не совершает звонок и не моделирует ответ банка.','Банкке өзіңіз хабарласу таңдалды. Симулятор қоңырау шалмайды және банк жауабын модельдемейді.'),
      ignore:p('Вы прекратили взаимодействие. Ранее выбранные действия остаются в карте.','Әрекеттесуді тоқтаттыңыз. Бұрын таңдалған әрекеттер картада қалады.')
    };
    return {effect:effects[entry.action],next:entry.action==='inspect_link'?p('Найдите домен назначения, затем проверьте ответ.','Баратын доменді тауып, жауабыңызды тексеріңіз.'):guidance};
  }
  function renderMap(){
    const panel=$('sim-decision-map'),s=session.state;panel.hidden=s.phase!=='outcome';panel.replaceChildren();if(panel.hidden)return;
    panel.append(el('span','DECISION / MAP','sim-kicker'),heading(t('mapTitle'),'sim-map-title'),el('p',t('mapHint'),'card-description'));
    const list=el('ol',null,'sim-decision-list');list.id='sim-map-list';
    s.trace.forEach((entry,index)=>{
      const li=el('li'),item=el('details'),summary=el('summary'),copy=mapExplanation(entry);li.dataset.decision=entry.action;
      summary.append(el('span',String(index+1).padStart(2,'0'),'sim-map-number'),el('strong',t(entry.action)));
      item.append(summary,el('p',t('incident')+t(entry.before)+(entry.before!==entry.after?' → '+t(entry.after):''),'sim-map-incident'));
      item.append(el('h3',t('consequence')),el('p',copy.effect));
      if(entry.reply)item.append(source(entry.reply,'sim-map-reply'));
      item.append(el('h3',t('safer')),el('p',copy.next));
      item.open=index===s.trace.length-1;li.append(item);list.append(li);
    });panel.append(list);
    if(session.story.url&&!s.inspection.checked)panel.append(el('p',t(s.inspection.open?'mapUnfinished':'mapNoTask'),'card-description'));
    panel.append(button(t('reset'),()=>select(session.story.id,true)),el('p',t('privacy'),'card-description'));
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
      if(!saved)saved=callbacks.save(session.input(),session.state.incident);
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
    renderPhone();renderInspector();renderAnalysis();renderReview();renderMap();
    $('sim-journal-card').hidden=!s.journal.length||s.phase==='outcome';$('sim-journal').replaceChildren(...s.journal.map(a=>el('li',t(a))));
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
