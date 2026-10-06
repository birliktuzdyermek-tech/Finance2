/* Shared exact evidence for saved results and editable comparisons. Text nodes only. */
window.QalqanEvidence = (() => {
  'use strict';
  const E = window.QalqanEngine, I = window.QalqanI18n;
  const t = (ru, kk) => I.language() === 'kk' ? kk : ru;
  function el(tag, text, cls) { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; }
  function summary(result) {
    const total = result.signals.reduce((sum, s) => sum + s.weight, 0);
    return t(`Сумма весов разных правил: ${total}. Балл = min(100, ${total}) = ${result.score}. Каждое правило учитывается один раз.`,
      `Әртүрлі ережелер салмағының қосындысы: ${total}. Балл = min(100, ${total}) = ${result.score}. Әр ереже бір рет есептеледі.`);
  }
  function limits() {
    return t('Правила ищут слова, сочетания и признаки URL. Они не всегда различают отрицания, цитаты и пересланные предупреждения. Qalqan не подтверждает подлинность отправителя или сайта. Низкий балл не гарантирует безопасность.',
      'Ережелер сөздерді, тіркестерді және URL белгілерін іздейді. Олар терістеуді, дәйексөзді және қайта жіберілген ескертуді әрдайым ажырата алмайды. Qalqan жіберушінің не сайттың түпнұсқалығын растамайды. Төмен балл қауіпсіздікке кепіл емес.');
  }
  function render(result) {
    const fragment = document.createDocumentFragment(), firstSeen = new Map();
    (result.replies || [result]).forEach((reply, index) => {
      const card = el('section', null, 'evidence-card');
      if (result.replies) card.append(el('h3', t(`Реплика ${index + 1} · отдельно ${reply.score} / 100`, `Реплика ${index + 1} · жеке ${reply.score} / 100`)));
      const original = el('div', null, 'marked-message');
      for (const segment of E.segments(reply.text, reply.signals)) {
        if (!segment.codes.length) { original.append(document.createTextNode(segment.text)); continue; }
        const mark = el('mark', segment.text); mark.title = segment.codes.map(I.rule).join('; '); original.append(mark);
      }
      card.append(original);
      if (reply.signals.length) {
        card.append(el('h4', t('Точные фрагменты и вклад правил', 'Нақты үзінділер және ережелердің үлесі')));
        const list = el('ul', null, 'evidence-list');
        for (const signal of reply.signals) {
          const item = el('li'), prior = firstSeen.get(signal.code);
          item.dataset.rule = signal.code;
          item.append(el('strong', I.rule(signal.code) + (prior ? ' · +0' : ' · +' + signal.weight)));
          item.append(el('p', prior
            ? t(`Уже учтено в реплике ${prior}; повтор не добавляет баллов.`, `Реплика ${prior} ішінде есептелді; қайталау балл қоспайды.`)
            : t(`Вес ${signal.weight} включён в сумму один раз, независимо от числа фрагментов.`, `${signal.weight} салмағы үзінділер санына қарамастан қосындыға бір рет қосылады.`), 'card-description'));
          signal.matches.forEach((match, i) => { if (i) item.append(document.createTextNode(' · ')); item.append(el('q', match.text)); });
          if (!prior) firstSeen.set(signal.code, index + 1);
          list.append(item);
        }
        card.append(list);
      } else card.append(el('p', t('Явных признаков не найдено. Это не гарантия безопасности.', 'Айқын белгілер табылмады. Бұл қауіпсіздік кепілдігі емес.'), 'card-description'));
      fragment.append(card);
    });
    return fragment;
  }
  return {render, summary, limits};
})();
