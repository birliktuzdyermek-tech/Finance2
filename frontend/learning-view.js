/* Read-only learning context, shared by trainer, history and printed results. */
window.QalqanLearning = (() => {
  'use strict';
  const I = window.QalqanI18n, E = window.QalqanEngine;
  const t = (ru, kk) => I.language() === 'kk' ? kk : ru;
  const localized = value => value[I.language()] || value.ru;
  function node(tag, text, cls) { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; }
  function label(result) {
    const c = result.learning;
    if (!c) return t('Своя проверка', 'Өз тексеруім');
    if (c.kind === 'trainer') return t(`Тренажёр · пример ${c.exercise_number}`, `Жаттығу · мысал ${c.exercise_number}`);
    return t(`Сценарий · шаг ${c.step}`, `Сценарий · қадам ${c.step}`);
  }
  function marked(text, spans) {
    const original = node('div', null, 'marked-message');
    E.segments(text, [{code:'annotation',matches:spans}]).forEach(part => original.append(part.codes.length ? node('mark',part.text) : document.createTextNode(part.text)));
    return original;
  }
  function userPanel(text, user) {
    const panel = node('article', null, 'card learning-panel'); panel.append(node('h3',t('1. Ваш ответ','1. Сіздің жауабыңыз')));
    panel.append(marked(text,user.spans),node('p',user.noSignals ? t('Вы выбрали: «Не вижу подозрительных фрагментов».','Сіз «Күдікті үзінді көріп тұрған жоқпын» деп таңдадыңыз.') : t(`Вы отметили слов: ${user.spans.length}.`,`Сіз белгілеген сөздер: ${user.spans.length}.`),'card-description'));
    return panel;
  }
  function authorPanel(text, author) {
    const panel = node('article', null, 'card learning-panel'); panel.append(node('h3',t('3. Учебная разметка автора','3. Автордың оқу белгілеуі')),marked(text,author.spans));
    const list = node('ul',null,'evidence-list');
    author.spans.forEach(span => {const li=node('li'),q=node('q',span.text);li.append(q,document.createTextNode(' — '+localized(span.reason)));list.append(li);});
    if (author.spans.length) panel.append(list); else panel.append(node('p',t('Автор не отметил подозрительных фрагментов.','Автор күдікті үзінділерді белгілемеді.'),'card-description'));
    panel.append(node('p',localized(author.note))); return panel;
  }
  function differences(data) {
    const panel=node('article',null,'card learning-differences');panel.append(node('h3',t('Где разошлись наблюдения','Бақылаулар қай жерде ерекшеленді')));
    panel.append(node('p',t('Сопоставление по словам: совпадение даже с частью слова или URL относит к нему весь фрагмент выбора. Точная подсветка Qalqan показана отдельно. Это разбор примера, а не оценка точности системы или вашей защищённости.',
      'Салыстыру сөздер бойынша: сөздің не URL-дің бір бөлігімен сәйкестік бүкіл таңдалатын үзіндіге есептеледі. Qalqan нақты белгілеуі бөлек көрсетілген. Бұл мысалды талдау, жүйе дәлдігін не сіздің қорғалғандығыңызды бағалау емес.'),'card-description'));
    const grid=node('div',null,'learning-diff-grid');
    for (const [key,ru,kk] of [
      ['userOnly','Вы отметили, автор не отметил','Сіз белгіледіңіз, автор белгілемеді'],
      ['authorMissed','Автор отметил, вы не отметили','Автор белгіледі, сіз белгілемедіңіз'],
      ['systemOnly','Qalqan заметил вне разметки автора','Qalqan автор белгілеуінен тыс байқады'],
      ['authorOnly','Автор отметил, Qalqan пропустил','Автор белгіледі, Qalqan өткізіп алды']
    ]) {
      const box=node('section');box.dataset.difference=key;box.append(node('h4',t(ru,kk)));
      const list=node('ul',null,'evidence-list');
      data[key].forEach(span=>{const li=node('li');li.append(node('q',span.text));list.append(li);});
      if (!data[key].length) list.append(node('li',t('Расхождений нет.','Айырмашылық жоқ.'),'card-description'));
      box.append(list);grid.append(box);
    }
    panel.append(grid);return panel;
  }
  function saved(result) {
    const fragment=document.createDocumentFragment(),c=result.learning;if(!c)return fragment;
    const heading=node('article',null,'card learning-origin');heading.append(node('h2',label(result)),node('p',t('Учебный пример · только память вкладки.','Оқу мысалы · тек бет жадында.'),'card-description'));
    if(c.kind==='trainer') {
      heading.append(node('p',t('Результат анализатора приведён выше. Ниже сохранены ваш ответ и авторский разбор этой попытки.','Талдағыш нәтижесі жоғарыда. Төменде осы әрекеттегі жауабыңыз және автор талдауы сақталған.'),'card-description'));
      fragment.append(heading);const grid=node('div',null,'learning-two');grid.append(userPanel(result.text,c.user),authorPanel(result.text,c.author));fragment.append(grid,differences(c.differences));
    } else {
      heading.append(node('h3',localized(c.title)),node('p',t(`Сохранён шаг ${c.step} из ${c.total}. Будущие реплики в этот результат не входят.`,`Сақталған қадам: ${c.step} / ${c.total}. Келесі репликалар бұл нәтижеге кірмейді.`)));
      const warning=c.steps.find(step=>step.score>=35);
      heading.append(node('p',warning ? t(`Первое предупреждение в сохранённых шагах: шаг ${warning.step}.`,`Сақталған қадамдардағы алғашқы ескерту: ${warning.step}-қадам.`) : t('В сохранённых шагах порог предупреждения не достигнут. Это не подтверждает безопасность.','Сақталған қадамдарда ескерту шегіне жеткен жоқ. Бұл қауіпсіздікті растамайды.')));
      const list=node('ol',null,'learning-timeline');
      c.steps.forEach(step=>{const li=node('li');li.append(node('strong',t(`Шаг ${step.step} · ${step.score} / 100`,`Қадам ${step.step} · ${step.score} / 100`)),node('p',step.new_codes.length ? t('Новые признаки: ','Жаңа белгілер: ')+step.new_codes.map(I.rule).join('; ') : t('Новых признаков нет.','Жаңа белгілер жоқ.'),'card-description'));list.append(li);});
      heading.append(list);fragment.append(heading);
    }
    fragment.append(node('p',t('Версия учебных данных: ','Оқу деректерінің нұсқасы: ')+c.catalog_version,'card-description'));
    return fragment;
  }
  return {label,userPanel,authorPanel,differences,saved};
})();
