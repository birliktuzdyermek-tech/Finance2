/* Authored educational content. Never used as analyzer features or sender verification. */
(function(root){
  'use strict';
  const pair=(ru,kk)=>({ru,kk});
  const choices={
    ask_reason:pair('Почему это произошло?','Бұл неге болды?'),
    verify_sender:pair('Как проверить, кто вы?','Сіздің кім екеніңізді қалай тексеремін?'),
    ask_time:pair('Можно разобраться позже?','Кейінірек анықтауға бола ма?'),
    doubt_sender:pair('Имя отправителя ещё ничего не доказывает','Жіберушінің аты ештеңені дәлелдемейді')
  };
  const node=(text,options)=>({text,options});
  const dialogues={
    'blocked-card':{
      start:{options:{ask_reason:'reason',verify_sender:'identity'}},
      reason:node('Обнаружена подозрительная операция. Срочно откройте ссылку для отмены. Тексеруді қазір аяқтаңыз.',{ask_time:'pressure'}),
      identity:node('Я из службы безопасности банка. Для проверки сообщите SMS-код. Кодты осында жіберіңіз.',{doubt_sender:'insistence'}),
      pressure:node('Осталось 5 минут. Введите код из SMS на странице, иначе карта останется заблокирована.',{}),
      insistence:node('Не звоните в банк, это займёт время. Отправьте код сейчас — мы сами снимем блокировку.',{})
    },
    'safe-transfer':{
      start:{options:{ask_reason:'reason',verify_sender:'identity'}},
      reason:node('На вашем счёте якобы идёт списание. Переведите деньги на резервный счёт. Бұл уақытша қорғаныс.',{ask_time:'pressure'}),
      identity:node('Мой номер сотрудника 4821. Для защиты переведите деньги через нашу ссылку. Қазір аударыңыз.',{doubt_sender:'insistence'}),
      pressure:node('Немедленно переведите всю сумму на безопасный счёт. Осталось 5 минут, потом будет поздно.',{}),
      insistence:node('Банк уже согласовал перевод. Не обсуждайте его с другими. Переведите деньги сейчас.',{})
    },
    'ordinary-receipt':{
      start:{options:{ask_reason:'reason',verify_sender:'identity'}},
      reason:node('В уведомлении указана сумма покупки. Түбіртек банк қолданбасында бар.',{ask_time:'details'}),
      identity:node('Это текст учебного уведомления. Операция туралы мәлімет банк қолданбасында көрсетіледі.',{doubt_sender:'details'}),
      details:node('Покупка отображается в разделе истории операций приложения. Бұл хабарлама жауапты қажет етпейді.',{})
    }
  };
  // These are explicit decompositions of the two authored .example addresses,
  // not a general-purpose public suffix/domain ownership detector.
  const parts={
    'blocked-card':[
      {id:'scheme',text:'https://'}, {id:'prefix',text:'kaspi.kz.'},
      {id:'domain',text:'verify.example'}, {id:'path',text:'/confirm'}
    ],
    'safe-transfer':[
      {id:'scheme',text:'https://'}, {id:'domain',text:'bank-protection.example'}, {id:'path',text:'/transfer'}
    ],
    'ordinary-receipt':[]
  };
  const partNames={scheme:pair('Протокол','Хаттама'),prefix:pair('Поддомен','Қосалқы домен'),domain:pair('Домен','Домен'),path:pair('Путь страницы','Бет жолы')};
  function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
  const api=freeze({choices,dialogues,parts,partNames});
  if(typeof module==='object'&&module.exports)module.exports=api;else root.QalqanSimulationLessons=api;
})(typeof globalThis==='object'?globalThis:this);
