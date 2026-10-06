window.QalqanTrainer = (() => {
  'use strict';
  const I=window.QalqanI18n,D=window.QalqanTrainerData,T=window.QalqanTrainerEngine,L=window.QalqanLearning;
  const $=id=>document.getElementById(id), copy={
    title:['Найди признаки','Белгілерді тап'],intro:['Отметьте подозрительные фрагменты, затем сравните три взгляда на сообщение.','Күдікті үзінділерді белгілеп, хабарламаға үш көзқарасты салыстырыңыз.'],
    notice:['Синтетические учебные примеры. Ваш выбор и разбор остаются в памяти вкладки; ничего не отправляется на сервер.','Жасанды оқу мысалдары. Таңдауыңыз бен талдау бет жадында қалады; серверге ештеңе жіберілмейді.'],
    choose:['Пример','Мысал'],hint:['Нажимайте слова или ссылку, которые вызывают сомнение. Повторное нажатие снимает отметку. С клавиатуры: Tab, затем Enter или пробел.','Күмән туғызған сөзді немесе сілтемені басыңыз. Қайта басу белгіні алып тастайды. Пернетақтада: Tab, одан кейін Enter не бос орын.'],
    none:['Не вижу подозрительных фрагментов','Күдікті үзінді көріп тұрған жоқпын'],reveal:['Открыть разбор','Талдауды ашу'],reviewTitle:['Разбор учебного примера','Оқу мысалын талдау'],reset:['Попробовать заново','Қайта байқап көру'],
    next:['Следующий пример →','Келесі мысал →'],save:['Сохранить разбор в историю','Талдауды тарихқа сақтау'],saved:['Разбор сохранён в истории вкладки.','Талдау бет тарихына сақталды.'],
    saveHint:['В историю попадёт только эта попытка и результат Qalqan. Просмотр сам по себе ничего не сохраняет.','Тарихқа тек осы әрекет пен Qalqan нәтижесі түседі. Көрудің өзі ештеңе сақтамайды.'],
    open:['Открыть сохранённую проверку','Сақталған тексеруді ашу'],system:['2. Результат анализатора Qalqan','2. Qalqan талдағышының нәтижесі'],
    ruleHint:['Вызваны текущие браузерные правила. Ваш ответ и разметка автора на балл не влияют. Балл — индекс признаков, а не вероятность.','Қазіргі браузер ережелері қолданылды. Сіздің жауабыңыз бен автор белгілеуі баллға әсер етпейді. Балл — белгілер индексі, ықтималдық емес.'],
    required:['Отметьте хотя бы один фрагмент или выберите «Не вижу подозрительных фрагментов».','Кемінде бір үзіндіні белгілеңіз немесе «Күдікті үзінді көріп тұрған жоқпын» деп таңдаңыз.'],
    locked:['Ответ зафиксирован. Для новой попытки нажмите «Попробовать заново».','Жауап бекітілді. Жаңа әрекет үшін «Қайта байқап көру» түймесін басыңыз.'],
    history:['Перейти к истории','Тарихқа өту'],projector:['Режим проектора','Проектор режимі'],
    low:['Низкий риск','Төмен қауіп'],suspicious:['Подозрительно','Күдікті'],high:['Высокий риск','Жоғары қауіп']
  };
  const t=key=>copy[key][I.language()==='kk'?1:0], pair=(ru,kk)=>I.language()==='kk'?kk:ru;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  let index=0, attempts=new Map(), callbacks, error=false;
  const exercise=()=>D.exercises[index];
  function state(){if(!attempts.has(index))attempts.set(index,{selected:new Set(),none:false,review:null,saved:null});return attempts.get(index);}
  function status(){const s=state();$('trainer-none').setAttribute('aria-pressed',String(s.none));$('trainer-none').disabled=!!s.review;$('trainer-reveal').disabled=!!s.review;$('trainer-status').textContent=s.review?t('locked'):s.none?t('none'):pair(`Отмечено слов: ${s.selected.size}.`,`Белгіленген сөздер: ${s.selected.size}.`);$('trainer-error').hidden=!error;$('trainer-error').textContent=error?t('required'):'';}
  function renderText(){
    const s=state(),text=exercise().text,box=$('trainer-message');box.replaceChildren();let offset=0;
    T.tokens(text).forEach(word=>{
      box.append(document.createTextNode(text.slice(offset,word.start)));const button=el('button',word.text,'trainer-word');button.type='button';button.dataset.token=word.id;button.setAttribute('aria-pressed',String(s.selected.has(word.id)));button.disabled=!!s.review;
      button.addEventListener('click',()=>{if(s.review)return;if(s.selected.has(word.id))s.selected.delete(word.id);else s.selected.add(word.id);s.none=false;error=false;button.setAttribute('aria-pressed',String(s.selected.has(word.id)));status();});box.append(button);offset=word.end;
    });box.append(document.createTextNode(text.slice(offset)));
  }
  function renderReview(){
    const s=state(),r=s.review;$('trainer-review').hidden=!r;$('trainer-review-panels').replaceChildren();$('trainer-differences').replaceChildren();
    if(!r)return;
    const system=el('article',null,'card learning-panel');system.append(el('h3',t('system')),el('strong',r.result.score+' / 100','trainer-score'),el('span',t(r.result.verdict),'pill '+r.result.verdict),el('p',t('ruleHint'),'card-description'),window.QalqanEvidence.render(r.result),el('p',window.QalqanEvidence.summary(r.result),'card-description'),el('p',window.QalqanEvidence.limits(),'card-description'));
    $('trainer-review-panels').append(L.userPanel(exercise().text,r.user),system,L.authorPanel(exercise().text,r.author));
    $('trainer-differences').append(L.differences(r.differences));
    $('trainer-version').textContent=pair('Версии: ','Нұсқалар: ')+r.result.analyzer_version+' · '+D.version;
    $('trainer-save').disabled=!!s.saved;$('trainer-save-status').textContent=s.saved?t('saved'):'';$('trainer-open').hidden=!s.saved;
  }
  function refresh(){
    document.querySelectorAll('[data-trainer-i18n]').forEach(n=>{n.textContent=t(n.dataset.trainerI18n);});
    [...$('trainer-select').options].forEach((option,i)=>{option.textContent=t('choose')+' '+(i+1)+' / '+D.exercises.length;});
    $('trainer-select').value=String(index);$('trainer-channel').textContent=exercise().channel==='whatsapp'?'WhatsApp':'SMS';$('trainer-next').disabled=index===D.exercises.length-1;
    renderText();status();renderReview();
  }
  function clear(){attempts.clear();index=0;error=false;refresh();}
  function init(options){callbacks=options;D.exercises.forEach((_,i)=>{const o=el('option');o.value=String(i);$('trainer-select').append(o);});
    $('trainer-select').addEventListener('change',()=>{index=Number($('trainer-select').value);error=false;refresh();});
    $('trainer-none').addEventListener('click',()=>{const s=state();s.selected.clear();s.none=!s.none;error=false;renderText();status();});
    $('trainer-reveal').addEventListener('click',()=>{const s=state();try{s.review=T.review(exercise(),[...s.selected],s.none);error=false;refresh();$('trainer-review-title').focus();}catch(_){error=true;status();}});
    $('trainer-reset').addEventListener('click',()=>{attempts.delete(index);error=false;refresh();$('trainer-message').querySelector('button')?.focus();});
    $('trainer-next').addEventListener('click',()=>{if(index<D.exercises.length-1){index++;error=false;refresh();$('trainer-select').focus();}});
    $('trainer-save').addEventListener('click',()=>{const s=state();if(!s.review||s.saved)return;const r=s.review;s.saved=callbacks.save(r.result,{kind:'trainer',catalog_version:D.version,exercise_id:exercise().id,exercise_number:index+1,user:r.user,author:r.author,differences:r.differences});renderReview();});
    $('trainer-open').addEventListener('click',()=>{const s=state();if(s.saved)callbacks.open(s.saved);});
    $('trainer-projector').addEventListener('click',callbacks.projector);refresh();
  }
  return {init,clear,onRoute(view){if(view==='trainer')refresh();}};
})();
