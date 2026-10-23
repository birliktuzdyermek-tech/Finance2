/* Authored practice stories and an in-memory state machine. No network or storage. */
(function(root) {
  'use strict';
  const E = typeof module === 'object' && module.exports ? require('./analyzer.js') : root.QalqanEngine;
  const L = typeof module === 'object' && module.exports ? require('./simulation-lessons.js') : root.QalqanSimulationLessons;
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
      if(state.phase==='message')list.push(...(story.url&&!state.inspection.open?['inspect_link']:[]),...Object.keys(L.dialogues[id][state.node].options),...(story.url?['open_link']:[]),'contact','ignore');
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
  const api={version:'simulation-2.0',stories,createSession};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.QalqanSimulationEngine=api;
})(typeof globalThis==='object'?globalThis:this);
