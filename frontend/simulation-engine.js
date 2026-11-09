/* Authored practice stories and an in-memory state machine. No network or storage. */
(function(root) {
  'use strict';
  const E = typeof module === 'object' && module.exports ? require('./analyzer.js') : root.QalqanEngine;
  const L = typeof module === 'object' && module.exports ? require('./simulation-lessons.js') : root.QalqanSimulationLessons;
  const stories = [
    {id:'blocked-card',pressure:10,number:'01',channel:'sms',intent:'code',level:1,
      title:{ru:'Карта заблокирована',kk:'Карта бұғатталды'},
      intro:{ru:'На телефон приходит сообщение от имени банка. Решите, как проверить его.',kk:'Телефонға банк атынан хабарлама келді. Оны қалай тексеретініңізді таңдаңыз.'},
      sender:{ru:'«Поддержка банка»',kk:'«Банк қолдауы»'},
      message:'Срочно! Ваша карта заблокирована. Подтвердите платёж: https://kaspi.kz.verify.example/confirm',
      url:'https://kaspi.kz.verify.example/confirm',
      author:{ru:'В этом учебном сюжете злоумышленник использует срочность, угрозу блокировки и адрес, похожий на банковский. Владелец реального сайта по тексту не установлен.',kk:'Бұл оқу оқиғасында алаяқ асықтыруды, бұғаттау қаупін және банкке ұқсас мекенжайды қолданады. Мәтін арқылы нақты сайт иесі анықталмайды.'}},
    {id:'safe-transfer',pressure:15,number:'02',channel:'whatsapp',intent:'money',level:2,
      title:{ru:'«Безопасный» счёт',kk:'«Қауіпсіз» шот'},
      intro:{ru:'Собеседник предлагает защитить деньги переводом. В сообщении смешаны два языка.',kk:'Әңгімелесуші ақшаны аударып қорғауды ұсынады. Хабарламада екі тіл араласқан.'},
      sender:{ru:'«Служба безопасности»',kk:'«Қауіпсіздік қызметі»'},
      message:'Шұғыл! Переведите деньги на безопасный счёт. Аударымды осы жерден жасаңыз: https://bank-protection.example/transfer',
      url:'https://bank-protection.example/transfer',
      author:{ru:'Авторский сюжет моделирует просьбу перевести деньги на чужой счёт под видом защиты. Название сценария и ваши действия не входят в признаки анализатора.',kk:'Авторлық оқиға ақшаны қорғау сылтауымен бөтен шотқа аударуды сұрауды көрсетеді. Сценарий атауы мен әрекеттеріңіз талдау белгілеріне кірмейді.'}},
    {id:'ordinary-receipt',number:'03',channel:'sms',intent:'none',level:0,
      title:{ru:'Обычное уведомление',kk:'Кәдімгі хабарлама'},
      intro:{ru:'Финансовые слова сами по себе не доказывают обман. Изучите обычное учебное уведомление.',kk:'Қаржыға қатысты сөздер өздігінен алаяқтықты дәлелдемейді. Кәдімгі оқу хабарламасын қараңыз.'},
      sender:{ru:'«Уведомления»',kk:'«Хабарландырулар»'},
      message:'Покупка на 3 500 ₸. Чек доступен в приложении банка. Жаңа әрекет қажет емес.',url:null,
      author:{ru:'Автор обозначил этот пример как обычное уведомление: здесь нет просьбы передать код или открыть ссылку. Низкий балл не подтверждает личность отправителя.',kk:'Автор бұл мысалды кәдімгі хабарлама деп белгіледі: код беру не сілтемені ашу өтініші жоқ. Төмен балл жіберушінің кім екенін растамайды.'}},
    {id:'qr-parking',pressure:10,number:'04',channel:'sms',intent:'money',level:2,isNew:true,demo:'15 000 ₸',
      title:{ru:'QR-код на парковке',kk:'Тұрақтағы QR-код'},
      intro:{ru:'На стойке парковки наклеен QR-код «Оплата без очереди». После сканирования открывается страница. Решите, как поступить.',kk:'Тұрақ бағанында «Кезексіз төлем» QR-коды жабыстырылған. Сканерлегеннен кейін бет ашылады. Қалай әрекет ететініңізді таңдаңыз.'},
      sender:{ru:'«Парковка · QR»',kk:'«Тұрақ · QR»'},
      message:'Оплатите парковку в течение 10 минут, иначе штраф 15 000 ₸: http://parking-pay.example/p/4821',
      url:'http://parking-pay.example/p/4821',
      author:{ru:'Мошенники наклеивают свой QR поверх настоящего. QR скрывает адрес, поэтому сначала прочитайте ссылку целиком. Здесь нет HTTPS и есть давление временем; сам QR не доказывает, что страница принадлежит парковке.',kk:'Алаяқтар өз QR-кодын шынайысының үстіне жабыстырады. QR мекенжайды жасырады, сондықтан алдымен сілтемені толық оқыңыз. Мұнда HTTPS жоқ және уақытпен қысым бар; QR-дің өзі беттің тұраққа тиесілі екенін дәлелдемейді.'}},
    {id:'relative-transfer',pressure:15,number:'05',channel:'whatsapp',intent:'money',level:3,isNew:true,direct:true,
      title:{ru:'«Родственник» просит перевод',kk:'«Туысқан» аударым сұрайды'},
      intro:{ru:'Сообщение приходит с незнакомого номера, но тон знакомый. Здесь нет ссылки: решайте, как проверить человека.',kk:'Хабарлама беймәлім нөмірден келеді, бірақ үні таныс. Мұнда сілтеме жоқ: адамды қалай тексеретініңізді таңдаңыз.'},
      sender:{ru:'«Мама (новый номер)»',kk:'«Анам (жаңа нөмір)»'},
      message:'Мам, это я, телефон разбился, пишу с нового номера. Срочно переведи 45 000 ₸ на карту, вечером всё объясню. Не звони, я на встрече.',
      url:null,
      author:{ru:'Правила видят только слово «срочно», индекс низкий. Это сознательный пример предела анализатора: просьба о переводе без ссылки и без секретных слов не распознаётся. Проверить человека можно только звонком на известный номер.',kk:'Ережелер тек «срочно» сөзін көреді, индекс төмен. Бұл талдағыштың шегін көрсететін әдейі мысал: сілтемесіз және құпия сөздерсіз аударым сұрауы танылмайды. Адамды тек белгілі нөмірге қоңырау шалып тексеруге болады.'}},
    {id:'bank-call',pressure:5,number:'06',channel:'sms',intent:'code',level:3,isNew:true,direct:true,
      title:{ru:'Звонок «сотрудника банка»',kk:'«Банк қызметкерінің» қоңырауы'},
      intro:{ru:'Приложение показывает разговор текстом. «Сотрудник» просит помочь остановить операцию. Сам звонок в симуляции не звучит.',kk:'Қолданба әңгімені мәтін түрінде көрсетеді. «Қызметкер» операцияны тоқтатуға көмектесуді сұрайды. Симуляцияда қоңырау дыбысы жоқ.'},
      sender:{ru:'«Звонок · служба безопасности»',kk:'«Қоңырау · қауіпсіздік қызметі»'},
      message:'Здравствуйте, служба безопасности банка. По вашей карте идёт подозрительная операция. Чтобы её отменить, сообщите код из SMS, который сейчас придёт.',
      url:null,
      author:{ru:'Код из SMS подтверждает операцию, а не отменяет её. Настоящий сотрудник не просит назвать код. Номер звонящего легко подделать, поэтому положите трубку и наберите банк сами.',kk:'SMS-тегі код операцияны растайды, бірақ тоқтатпайды. Нақты қызметкер кодты айтуды сұрамайды. Қоңырау шалушының нөмірін оңай жасандыруға болады, сондықтан тұтқаны қойып, банкке өзіңіз қоңырау шалыңыз.'}},
    {id:'marketplace-prepay',number:'07',channel:'whatsapp',intent:'money',level:2,isNew:true,demo:'35 000 ₸',
      title:{ru:'Предоплата на площадке',kk:'Хабарландыру алаңындағы алдын ала төлем'},
      intro:{ru:'«Покупатель» с площадки объявлений хочет «безопасную сделку» по ссылке. Решите, как проверить.',kk:'Хабарландыру алаңындағы «сатып алушы» сілтеме арқылы «қауіпсіз мәміле» жасағысы келеді. Қалай тексеретініңізді таңдаңыз.'},
      sender:{ru:'«Покупатель по объявлению»',kk:'«Хабарландыру бойынша сатып алушы»'},
      message:'Здравствуйте! Беру ваш товар. Чтобы получить оплату, подтвердите платёж и введите данные карты по ссылке: https://deliver.krisha-kz.example/receive',
      url:'https://deliver.krisha-kz.example/receive',
      author:{ru:'Чтобы получить деньги, данные карты вводить не нужно. Адрес стилизован под известную площадку, но его владелец по тексту не установлен. Деньги продавцу приходят без ссылок от покупателя.',kk:'Ақша алу үшін карта деректерін енгізу қажет емес. Мекенжай танымал алаңға ұқсатылған, бірақ мәтін бойынша иесі анықталмайды. Сатушыға ақша сатып алушының сілтемесінсіз келеді.'}},
    {id:'fake-job',pressure:20,number:'08',channel:'email',intent:'money',level:1,isNew:true,demo:'5 000 ₸',
      title:{ru:'Фальшивая вакансия',kk:'Жалған вакансия'},
      intro:{ru:'Письмо обещает лёгкий доход и просит «страховой взнос» до оформления. Решите, как проверить работодателя.',kk:'Хат оңай табыс уәде етеді және рәсімдеуге дейін «сақтандыру жарнасын» сұрайды. Жұмыс берушіні қалай тексеретініңізді таңдаңыз.'},
      sender:{ru:'«HR · удалённая работа»',kk:'«HR · қашықтан жұмыс»'},
      message:'Поздравляем! Вы выиграли место в команде: доход от 400 000 ₸ в месяц. Для оформления договора переведите страховой взнос 5 000 ₸ на резервный счёт: https://remote-work-hr.example/start',
      url:'https://remote-work-hr.example/start',
      author:{ru:'Работодатель не берёт деньги за трудоустройство. Просьба заплатить до договора и «резервный счёт» — типичные признаки обмана. Правила видят награду и просьбу о переводе, но не проверяют компанию.',kk:'Жұмыс беруші жұмысқа орналасқаны үшін ақша алмайды. Шартқа дейін төлеуді сұрау мен «резервтік шот» — алаяқтықтың тән белгілері. Ережелер сыйлық пен аударым сұрауын көреді, бірақ компанияны тексермейді.'}}
  ];
  function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
  stories.forEach(freeze);Object.freeze(stories);
  function createSession(id) {
    const story=stories.find(s=>s.id===id);if(!story)throw new RangeError('simulation_story');
    let state=freeze({phase:'notification',incident:'received',analyzed:false,ending:null,journal:[],trace:[],node:'start',transcript:[],inspection:{open:false,selection:null,checked:false,correct:null}});
    function input(){
      const incoming=state.transcript.filter(item=>item.role==='sender');
      return {content:incoming.map(item=>item.text).join('\n\n'),channel:story.channel,mode:incoming.length>1?'dialogue':'single'};
    }
    function result(){
      if(!state.analyzed)return null;
      const source=input();return source.mode==='dialogue'?E.analyzeDialogue(source.content,source.channel):E.analyze(source.content,source.channel);
    }
    function commit(next,action,details={}){
      const entry={action,before:state.incident,after:next.incident,replyCount:next.transcript.filter(item=>item.role==='sender').length,...details};
      state=freeze({...next,journal:[...state.journal,action],trace:[...state.trace,entry]});return state;
    }
    function options(){
      if(state.phase==='notification')return ['open_phone'];
      const list=state.analyzed?[]:['analyze'];
      if(state.phase==='message')list.push(...(story.url&&!state.inspection.open?['inspect_link']:[]),...Object.keys(L.dialogues[id][state.node].options),...(story.url?['open_link']:[]),...(story.direct?[story.intent==='code'?'send_demo':'transfer_demo']:[]),'contact','ignore');
      if(state.phase==='page')list.push(story.intent==='code'?'send_demo':'transfer_demo','contact','ignore');
      return list;
    }
    return {
      story,get state(){return state;},options,input,result,
      parts(){return L.parts[id];},
      choosePart(part){
        if(!state.inspection.open||state.inspection.checked||state.phase==='outcome'||!L.parts[id].some(p=>p.id===part))throw new RangeError('simulation_part');
        state=freeze({...state,inspection:{...state.inspection,selection:part}});return state;
      },
      checkPart(){
        if(!state.inspection.open||state.inspection.checked||!state.inspection.selection||state.phase==='outcome')throw new RangeError('simulation_inspection');
        const inspection={...state.inspection,checked:true,correct:state.inspection.selection==='domain'};
        return commit({...state,inspection},'check_link',{selection:inspection.selection,correct:inspection.correct});
      },
      act(action,language='ru'){
        if(!options().includes(action))throw new RangeError('simulation_action');
        const next={...state},details={};
        if(action==='open_phone'){next.phase='message';next.transcript=[{role:'sender',text:story.message,node:'start'}];}
        if(action==='analyze')next.analyzed=true;
        if(action==='inspect_link')next.inspection={...state.inspection,open:true};
        const destination=L.dialogues[id][state.node].options[action];
        if(destination){
          const utterance=L.choices[action][language==='kk'?'kk':'ru'],reply=L.dialogues[id][destination].text;
          next.node=destination;next.analyzed=false;
          next.transcript=[...state.transcript,{role:'user',text:utterance},{role:'sender',text:reply,node:destination}];
          Object.assign(details,{from:state.node,to:destination,utterance,reply});
        }
        if(action==='open_link'){next.phase='page';next.incident='opened';}
        if(['send_demo','transfer_demo','contact','ignore'].includes(action)){
          next.phase='outcome';next.ending=action;
          if(action==='send_demo')next.incident='entered';
          if(action==='transfer_demo')next.incident='transferred';
        }
        if(action==='analyze'){
          const source=input(),analysis=source.mode==='dialogue'?E.analyzeDialogue(source.content,source.channel):E.analyze(source.content,source.channel);
          details.analysis={score:analysis.score,codes:analysis.signals.map(s=>s.code)};
        }
        return commit(next,action,details);
      }
    };
  }
  const api={version:'simulation-3.0',stories,createSession};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.QalqanSimulationEngine=api;
})(typeof globalThis==='object'?globalThis:this);
