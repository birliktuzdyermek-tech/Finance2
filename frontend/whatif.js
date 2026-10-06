window.QalqanWhatIf = (() => {
  'use strict';
  const I = window.QalqanI18n, C = window.QalqanComparison, Evidence = window.QalqanEvidence;
  const $ = id => document.getElementById(id);
  const copy = {
    title: ['Что изменится?', 'Не өзгереді?'],
    intro: ['Измените копию и сравните с исходной проверкой.', 'Көшірмені өзгертіп, бастапқы тексерумен салыстырыңыз.'],
    empty: ['Откройте результат проверки и нажмите «Что изменится?».', 'Тексеру нәтижесін ашып, «Не өзгереді?» түймесін басыңыз.'],
    analyzer: ['Перейти к анализатору', 'Талдағышқа өту'],
    original: ['Исходная проверка', 'Бастапқы тексеру'],
    originalHint: ['Сохраняется в истории этой вкладки. Копия её не меняет.', 'Осы беттің тарихында сақталады. Көшірме оны өзгертпейді.'],
    edit: ['Редактируемая копия', 'Өңделетін көшірме'],
    hint: ['Уберите давление, измените домен, удалите запрос секрета или добавьте контекст. Не вводите настоящие секретные данные.', 'Қысымды алып тастаңыз, доменді өзгертіңіз, құпия дерек сұрауын жойыңыз немесе контекст қосыңыз. Нақты құпия деректерді енгізбеңіз.'],
    check: ['Сравнить версии', 'Нұсқаларды салыстыру'],
    reset: ['Вернуть исходный текст', 'Бастапқы мәтінді қайтару'],
    back: ['← Исходный результат', '← Бастапқы нәтиже'],
    results: ['Как изменился результат', 'Нәтиже қалай өзгерді'],
    edited: ['Проверенная копия', 'Тексерілген көшірме'],
    dirty: ['Копия изменена. Нажмите «Сравнить версии», чтобы получить актуальный результат.', 'Көшірме өзгерді. Жаңа нәтиже алу үшін «Нұсқаларды салыстыру» түймесін басыңыз.'],
    added: ['+ Появились', '+ Пайда болды'],
    removed: ['− Исчезли', '− Жойылды'],
    retained: ['= Остались', '= Қалды'],
    none: ['Нет', 'Жоқ'],
    privacy: ['Обе версии проверяются одними браузерными правилами. Копия хранится только в памяти вкладки и не добавляется в историю автоматически. Сообщения, ссылки и действия не отправляются на сервер.', 'Екі нұсқа бірдей браузер ережелерімен тексеріледі. Көшірме тек бет жадында сақталады және тарихқа автоматты түрде қосылмайды. Хабарламалар, сілтемелер және әрекеттер серверге жіберілмейді.'],
    dialogue: ['Режим: диалог. Сохраняйте 2–20 реплик, разделённых пустой строкой; всего до 10 000 символов.', 'Режим: диалог. Бос жолмен бөлінген 2–20 репликаны сақтаңыз; барлығы 10 000 таңбаға дейін.'],
    single: ['Режим: одно сообщение. От 3 до 10 000 символов.', 'Режим: бір хабарлама. 3–10 000 таңба.'],
    url: ['Режим: ссылка. Адрес разбирается локально, сайт не открывается.', 'Режим: сілтеме. Мекенжай жергілікті талданады, сайт ашылмайды.'],
    lengthError: ['Введите от 3 до 10 000 символов; в диалоге каждая реплика должна содержать текст.', '3–10 000 таңба енгізіңіз; диалогтың әр репликасында мәтін болуы керек.'],
    dialogueError: ['Для диалога нужны 2–20 реплик, разделённых пустой строкой.', 'Диалогқа бос жолмен бөлінген 2–20 реплика қажет.'],
    low: ['Низкий риск', 'Төмен қауіп'], suspicious: ['Подозрительно', 'Күдікті'], high: ['Высокий риск', 'Жоғары қауіп'],
    scoreHint: ['Балл — индекс признаков, а не вероятность. Уменьшение балла не доказывает безопасность.', 'Балл — белгілер индексі, ықтималдық емес. Баллдың төмендеуі қауіпсіздікті дәлелдемейді.'],
    unchanged: ['Набор правил не изменился. Новый контекст мог остаться нераспознанным.', 'Ережелер жиыны өзгерген жоқ. Жаңа контекст танылмай қалуы мүмкін.'],
    cap: ['Балл ограничен 100: изменение суммы весов может отличаться от изменения балла.', 'Балл 100-мен шектеледі: салмақ қосындысының өзгерісі балл өзгерісінен өзгеше болуы мүмкін.'],
    fragments: ['Фрагменты или их позиции изменились; вес правила остался прежним.', 'Үзінділер не олардың орны өзгерді; ереже салмағы өзгерген жоқ.']
  };
  const t = key => copy[key][I.language() === 'kk' ? 1 : 0];
  const pair = (ru, kk) => I.language() === 'kk' ? kk : ru;
  const signed = value => value > 0 ? '+' + value : String(value);
  function el(tag, text, cls) { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; }
  let session = null, savedResult = null, comparison = null, checkedText = null, errorKey = null, callbacks;
  function showScore(target, result) {
    const pill = el('span', t(result.verdict), 'pill ' + result.verdict);
    $(target).replaceChildren(el('strong', result.score + ' / 100', 'whatif-score'), pill);
  }
  function signalList(target, signals, result, type) {
    const list = $(target); list.replaceChildren();
    if (!signals.length) { list.append(el('li', t('none'), 'card-description')); return; }
    signals.forEach(signal => {
      const li = el('li'); li.dataset.rule = signal.code;
      const prefix = type === 'removed' ? '−' : type === 'added' ? '+' : '';
      li.append(el('strong', I.rule(signal.code) + ' · ' + prefix + signal.weight));
      C.evidence(result, signal.code).forEach(match => {
        const row = el('div', null, 'whatif-match');
        if (match.reply) row.append(el('span', pair('Реплика ', 'Реплика ') + match.reply + ': '));
        const q = el('q', match.text); q.dataset.userText = ''; row.append(q); li.append(row);
      });
      if (type === 'retained' && comparison.evidenceChanged.some(s => s.code === signal.code)) li.append(el('p', t('fragments'), 'card-description'));
      list.append(li);
    });
  }
  function updateDraftStatus() {
    if (!session) return;
    const dirty = checkedText !== $('whatif-input').value;
    $('whatif-count').textContent = $('whatif-input').value.length + ' / 10 000';
    $('whatif-status').textContent = dirty ? t('dirty') : '';
    $('whatif-error').hidden = !errorKey; $('whatif-error').textContent = errorKey ? t(errorKey) : '';
    $('whatif-input').setAttribute('aria-invalid', String(!!errorKey));
    $('whatif-results').hidden = dirty || !comparison;
  }
  function render() {
    document.querySelectorAll('[data-whatif-i18n]').forEach(n => { n.textContent = t(n.dataset.whatifI18n); });
    $('whatif-empty').hidden = !!session; $('whatif-content').hidden = !session;
    if (!session) return;
    updateDraftStatus();
    $('whatif-mode').textContent = t(session.mode === 'dialogue' ? 'dialogue' : session.channel === 'url' ? 'url' : 'single');
    $('whatif-version').textContent = pair('Браузерный анализатор: ', 'Браузер талдағышы: ') + session.original.analyzer_version;
    $('whatif-limits').textContent = Evidence.limits();
    showScore('whatif-original-score', session.original);
    $('whatif-original-evidence').replaceChildren(Evidence.render(session.original));
    $('whatif-original-sum').textContent = Evidence.summary(session.original);
    // Refresh the last checked version on a language change even while hidden.
    // Restoring its exact input can then reveal it without another analysis.
    if (!comparison) return;
    showScore('whatif-edited-score', comparison.edited);
    $('whatif-edited-evidence').replaceChildren(Evidence.render(comparison.edited));
    $('whatif-edited-sum').textContent = Evidence.summary(comparison.edited);
    const c = comparison;
    $('whatif-delta').textContent = pair(`Балл: ${c.original.score} → ${c.edited.score} (${signed(c.scoreDelta)}).`, `Балл: ${c.original.score} → ${c.edited.score} (${signed(c.scoreDelta)}).`);
    const plus = c.added.reduce((n, s) => n + s.weight, 0), minus = c.removed.reduce((n, s) => n + s.weight, 0);
    $('whatif-explanation').textContent = pair(`Сумма весов: ${c.originalWeight} + ${plus} − ${minus} = ${c.editedWeight}. Добавлены веса новых правил, вычтены исчезнувшие. Повторы не меняют сумму.`,
      `Салмақ қосындысы: ${c.originalWeight} + ${plus} − ${minus} = ${c.editedWeight}. Жаңа ережелердің салмағы қосылып, жойылғандары шегерілді. Қайталау қосындыны өзгертпейді.`);
    $('whatif-cap').hidden = !c.capped;
    $('whatif-unchanged').hidden = !!(c.added.length || c.removed.length);
    signalList('whatif-added', c.added, c.edited, 'added');
    signalList('whatif-removed', c.removed, c.original, 'removed');
    signalList('whatif-retained', c.retained, c.edited, 'retained');
  }
  function check() {
    if (!session) return;
    try { comparison = session.compare($('whatif-input').value); checkedText = $('whatif-input').value; errorKey = null; }
    catch (e) { comparison = null; checkedText = null; errorKey = e.message === 'dialogue_count' ? 'dialogueError' : 'lengthError'; }
    render();
    if (errorKey) $('whatif-input').focus();
    else $('whatif-delta').focus();
  }
  function open(result) {
    // Copy input into an immutable anchor; result stays in the existing tab history.
    session = C.createSession({text: result.text, channel: result.channel, mode: result.replies ? 'dialogue' : 'single'});
    savedResult = result; $('whatif-input').value = result.text;
    comparison = session.compare(result.text); checkedText = result.text; errorKey = null;
    render(); location.hash = 'whatif';
  }
  function clear() {
    session = savedResult = comparison = checkedText = errorKey = null;
    $('whatif-input').value = '';
    ['whatif-original-evidence', 'whatif-edited-evidence', 'whatif-added', 'whatif-removed', 'whatif-retained', 'whatif-original-score', 'whatif-edited-score', 'whatif-original-sum', 'whatif-edited-sum', 'whatif-delta', 'whatif-explanation', 'whatif-status', 'whatif-error'].forEach(id => $(id).replaceChildren());
    render();
  }
  function init(options) {
    callbacks = options;
    $('whatif-form').addEventListener('submit', e => { e.preventDefault(); check(); });
    // Typing must not rebuild evidence for an unchanged, potentially long anchor.
    $('whatif-input').addEventListener('input', () => { errorKey = null; updateDraftStatus(); });
    $('whatif-reset').addEventListener('click', () => { if (session) { $('whatif-input').value = session.original.text; check(); } });
    $('whatif-back').addEventListener('click', () => { if (savedResult) callbacks.openOriginal(savedResult); });
    render();
  }
  return {init, open, clear, onRoute(view) { if (view === 'whatif') render(); }};
})();
