/* Authored practice stories and an in-memory state machine. No network or storage. */
(function(root) {
  'use strict';
  const E = typeof module === 'object' && module.exports ? require('./analyzer.js') : root.QalqanEngine;
  const stories = [
    {id:'blocked-card',number:'01',channel:'sms',intent:'code',
      title:{ru:'Карта заблокирована',kk:'Карта бұғатталды'},
      intro:{ru:'На телефон приходит сообщение от имени банка. Решите, как проверить его.',kk:'Телефонға банк атынан хабарлама келді. Оны қалай тексеретініңізді таңдаңыз.'},
      sender:{ru:'«Поддержка банка»',kk:'«Банк қолдауы»'},
      message:'Срочно! Ваша карта заблокирована. Подтвердите платёж: https://kaspi.kz.verify.example/confirm',
      url:'https://kaspi.kz.verify.example/confirm',
      author:{ru:'В этом учебном сюжете злоумышленник использует срочность, угрозу блокировки и адрес, похожий на банковский. Владелец реального сайта по тексту не установлен.',kk:'Бұл оқу оқиғасында алаяқ асықтыруды, бұғаттау қаупін және банкке ұқсас мекенжайды қолданады. Мәтін арқылы нақты сайт иесі анықталмайды.'}},
    {id:'safe-transfer',number:'02',channel:'whatsapp',intent:'money',
      title:{ru:'«Безопасный» счёт',kk:'«Қауіпсіз» шот'},
      intro:{ru:'Собеседник предлагает защитить деньги переводом. В сообщении смешаны два языка.',kk:'Әңгімелесуші ақшаны аударып қорғауды ұсынады. Хабарламада екі тіл араласқан.'},
      sender:{ru:'«Служба безопасности»',kk:'«Қауіпсіздік қызметі»'},
      message:'Шұғыл! Переведите деньги на безопасный счёт. Аударымды осы жерден жасаңыз: https://bank-protection.example/transfer',
      url:'https://bank-protection.example/transfer',
      author:{ru:'Авторский сюжет моделирует просьбу перевести деньги на чужой счёт под видом защиты. Название сценария и ваши действия не входят в признаки анализатора.',kk:'Авторлық оқиға ақшаны қорғау сылтауымен бөтен шотқа аударуды сұрауды көрсетеді. Сценарий атауы мен әрекеттеріңіз талдау белгілеріне кірмейді.'}},
    {id:'ordinary-receipt',number:'03',channel:'sms',intent:'none',
      title:{ru:'Обычное уведомление',kk:'Кәдімгі хабарлама'},
      intro:{ru:'Финансовые слова сами по себе не доказывают обман. Изучите обычное учебное уведомление.',kk:'Қаржыға қатысты сөздер өздігінен алаяқтықты дәлелдемейді. Кәдімгі оқу хабарламасын қараңыз.'},
      sender:{ru:'«Уведомления»',kk:'«Хабарландырулар»'},
      message:'Покупка на 3 500 ₸. Чек доступен в приложении банка. Жаңа әрекет қажет емес.',url:null,
      author:{ru:'Автор обозначил этот пример как обычное уведомление: здесь нет просьбы передать код или открыть ссылку. Низкий балл не подтверждает личность отправителя.',kk:'Автор бұл мысалды кәдімгі хабарлама деп белгіледі: код беру не сілтемені ашу өтініші жоқ. Төмен балл жіберушінің кім екенін растамайды.'}}
  ];
  function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
  stories.forEach(freeze);Object.freeze(stories);
  function createSession(id) {
    const story=stories.find(s=>s.id===id);if(!story)throw new RangeError('simulation_story');
    let state=freeze({phase:'notification',incident:'received',analyzed:false,ending:null,journal:[]});
    function options(){
      if(state.phase==='notification')return ['open_phone'];
      const list=state.analyzed?[]:['analyze'];
      if(state.phase==='message')list.push(...(story.url?['open_link']:[]),'contact','ignore');
      if(state.phase==='page')list.push(story.intent==='code'?'send_demo':'transfer_demo','contact','ignore');
      return list;
    }
    return {
      story,get state(){return state;},options,
      act(action){
        if(!options().includes(action))throw new RangeError('simulation_action');
        const next={...state,journal:[...state.journal,action]};
        if(action==='open_phone')next.phase='message';
        if(action==='analyze')next.analyzed=true;
        if(action==='open_link'){next.phase='page';next.incident='opened';}
        if(['send_demo','transfer_demo','contact','ignore'].includes(action)){
          next.phase='outcome';next.ending=action;
          if(action==='send_demo')next.incident='entered';
          if(action==='transfer_demo')next.incident='transferred';
        }
        state=freeze(next);return state;
      },
      // Only the original message and source channel are evaluated, never the story labels or choices.
      result(){return state.analyzed?E.analyze(story.message,story.channel):null;}
    };
  }
  const api={version:'simulation-1.0',stories,createSession};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.QalqanSimulationEngine=api;
})(typeof globalThis==='object'?globalThis:this);
