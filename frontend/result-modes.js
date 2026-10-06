/* Presentation preferences are tab-local. All findings remain in the detailed view and print. */
window.QalqanResultModes=(()=>{
  'use strict';
  const I=window.QalqanI18n,$=id=>document.getElementById(id);
  let current='simple',result=null;
  const t=(ru,kk)=>I.language()==='kk'?kk:ru;
  function refresh(){
    $('result-content').dataset.detail=current;
    document.querySelectorAll('[data-result-mode]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.resultMode===current));button.textContent=button.dataset.resultMode==='simple'?t('Кратко','Қысқаша'):t('Подробно','Толығырақ');});
    $('result-mode-label').textContent=t('Как показать результат','Нәтижені көрсету тәсілі');
    $('result-detail-hint').textContent=t('Подробный вид: все правила, веса, домены и ограничения. Печать всегда включает подробности.','Толық көрініс: барлық ережелер, салмақтар, домендер және шектеулер. Басып шығару әрдайым толық мәліметті қамтиды.');
    $('result-simple-limit').textContent=t('Правила могут ошибаться на цитатах и отрицаниях. Подлинность отправителя и сайта не подтверждена.','Ережелер дәйексөздер мен терістеуде қателесуі мүмкін. Жіберуші мен сайттың түпнұсқалығы расталмаған.');
    const extra=Math.max(0,(result?.signals.length||0)-3);
    $('result-more-signals').hidden=!extra||current==='detailed';
    $('result-more-signals').textContent=t(`Ещё признаков: ${extra}. Показать все →`,`Тағы белгілер: ${extra}. Барлығын көрсету →`);
  }
  function set(mode){current=mode==='detailed'?'detailed':'simple';refresh();}
  function init(){document.querySelectorAll('[data-result-mode]').forEach(button=>button.addEventListener('click',()=>set(button.dataset.resultMode)));$('result-more-signals').addEventListener('click',()=>{set('detailed');document.querySelector('[data-result-mode="detailed"]').focus();});refresh();}
  return {init,render(value){result=value;refresh();},clear(){result=null;set('simple');}};
})();
