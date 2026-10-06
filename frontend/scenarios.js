(function (root) {
  'use strict';
  const I = root.QalqanI18n, E = root.QalqanEngine;
  const library = root.QalqanScenarios, Engine = root.QalqanScenarioEngine;
  const copy = {
    title: ['Как развивается диалог', 'Диалог қалай дамиды'],
    intro: ['Открывайте реплики по одной и наблюдайте, когда появляются признаки.', 'Репликаларды біртіндеп ашып, белгілердің қашан пайда болатынын бақылаңыз.'],
    notice: ['Учебные синтетические диалоги. Анализ выполняется в этой вкладке. Тексты, результаты и действия не отправляются на сервер.', 'Оқу үшін жасалған жасанды диалогтар. Талдау осы бетте орындалады. Мәтіндер, нәтижелер мен әрекеттер серверге жіберілмейді.'],
    choose: ['Сценарий', 'Сценарий'], play: ['▶ Запустить', '▶ Бастау'], pause: ['Ⅱ Пауза', 'Ⅱ Кідірту'],
    next: ['Следующая реплика →', 'Келесі реплика →'], previous: ['← Назад', '← Артқа'], reset: ['↺ Сначала', '↺ Басынан'],
    transcript: ['Уже показанные реплики', 'Көрсетілген репликалар'], result: ['Результат на этом шаге', 'Осы қадамдағы нәтиже'],
    scoreHint: ['Балл признаков, не вероятность мошенничества.', 'Белгілер балы, алаяқтық ықтималдығы емес.'],
    rulesHint: ['Учитываются только показанные реплики. Вес каждого правила добавляется один раз; общий балл ограничен 100.', 'Тек көрсетілген репликалар есепке алынады. Әр ереженің салмағы бір рет қосылады; жалпы балл 100-ден аспайды.'],
    startHint: ['Нажмите «Следующая реплика» или запустите показ. Будущие реплики ещё не участвуют в проверке.', '«Келесі реплика» түймесін басыңыз немесе көрсетуді бастаңыз. Келесі репликалар әлі тексерілмейді.'],
    empty: ['Проверка ещё не запускалась.', 'Тексеру әлі басталмады.'],
    fresh: ['Новые признаки', 'Жаңа белгілер'], none: ['Новых признаков нет.', 'Жаңа белгілер жоқ.'],
    all: ['Все учтённые правила', 'Есептелген барлық ережелер'], noRules: ['Правила пока не нашли признаков. Это не подтверждает безопасность.', 'Ережелер әзірге белгілерді таппады. Бұл қауіпсіздікті растамайды.'],
    delta: ['Изменение балла', 'Балдың өзгеруі'], reply: ['Реплика', 'Реплика'], step: ['Шаг', 'Қадам'],
    sender: ['Отправитель · роль сценария', 'Жіберуші · сценарий рөлі'], recipient: ['Получатель · роль сценария', 'Алушы · сценарий рөлі'],
    low: ['○ Мало явных признаков', '○ Айқын белгілер аз'], suspicious: ['△ Стоит проверить внимательнее', '△ Мұқият тексеру керек'], high: ['! Много признаков риска', '! Қауіп белгілері көп'],
    nextAction: ['Следующий шаг', 'Келесі қадам'],
    action: ['При сомнении проверьте отправителя через знакомый официальный канал. Не используйте контакты из подозрительного сообщения.', 'Күмән туындаса, жіберушіні өзіңіз білетін ресми арна арқылы тексеріңіз. Күдікті хабарламадағы байланыс деректерін қолданбаңыз.'],
    limits: ['Qalqan не подтверждает личность отправителя или подлинность сайта. Цитаты, отрицания и просьбы без явных ключевых слов могут быть поняты неверно.', 'Qalqan жіберушінің тұлғасын немесе сайттың шынайылығын растамайды. Дәйексөздер, терістеулер және айқын кілт сөздерсіз өтініштер қате түсіндірілуі мүмкін.'],
    open: ['Открыть полное объяснение', 'Толық түсіндірмені ашу'],
    saveHint: ['Эта кнопка сохранит выбранный шаг в истории вкладки. Просмотр и перемотка сами по себе не добавляют проверки в общую историю.', 'Бұл түйме таңдалған қадамды бет тарихына сақтайды. Көру мен артқа өту жалпы тарихқа тексеру қоспайды.'],
    journal: ['Как менялся результат', 'Нәтиже қалай өзгерді'], journalHint: ['Нажмите на пройденный шаг, чтобы восстановить его результат.', 'Нәтижені қалпына келтіру үшін өткен қадамды басыңыз.'],
    note: ['Пояснение автора сценария — отдельно от анализа', 'Сценарий авторының түсіндірмесі — талдаудан бөлек'],
    finished: ['Все реплики показаны.', 'Барлық реплика көрсетілді.'], running: ['Показ идёт · одна реплика каждые 2,4 секунды.', 'Көрсету жүріп жатыр · әр 2,4 секунд сайын бір реплика.'],
    paused: ['Показ на паузе.', 'Көрсету кідіртілді.'], ready: ['Готово к показу.', 'Көрсетуге дайын.'],
    projector: ['Режим проектора', 'Проектор режимі'], failure: ['Не удалось выполнить шаг. Начните сценарий сначала.', 'Қадамды орындау мүмкін болмады. Сценарийді басынан бастаңыз.']
  };
  const $ = id => document.getElementById(id);
  const t = key => copy[key][I.language() === 'kk' ? 1 : 0];
  const translated = value => value[I.language()] || value.ru;
  const node = (tag, text, cls) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (cls) element.className = cls;
    return element;
  };
  let scenario = library.scenarios[0], session = Engine.createSession(scenario);
  let playing = false, timer, callbacks;

  function stop() { playing = false; clearTimeout(timer); }
  function controls() {
    const step = session.current.step, end = step === scenario.turns.length;
    $('scenario-play').textContent = t(playing ? 'pause' : 'play');
    $('scenario-play').disabled = end;
    $('scenario-play').setAttribute('aria-pressed', String(playing));
    $('scenario-previous').disabled = step === 0;
    $('scenario-next').disabled = end;
    $('scenario-open').disabled = step === 0;
    $('scenario-status').textContent = t(end ? 'finished' : playing ? 'running' : step ? 'paused' : 'ready');
  }
  function renderTranscript() {
    const target = $('scenario-transcript'), current = session.current;
    target.replaceChildren();
    if (!current.result) { target.append(node('p', t('startHint'), 'empty-state')); return; }
    const replies = current.result.replies || [current.result];
    replies.forEach((reply, index) => {
      const article = node('article', undefined, 'scenario-turn');
      article.append(node('h3', `${t('reply')} ${index + 1} · ${t(scenario.turns[index].speaker)}`));
      const message = node('div', undefined, 'marked-message');
      E.segments(reply.text, reply.signals).forEach(segment => {
        if (!segment.codes.length) { message.append(document.createTextNode(segment.text)); return; }
        const mark = node('mark', segment.text);
        mark.title = segment.codes.map(I.rule).join('; ');
        message.append(mark);
      });
      article.append(message);
      if (reply.signals.length) {
        const reasons = node('ul', undefined, 'scenario-turn-rules');
        reply.signals.forEach(signal => reasons.append(node('li', I.rule(signal.code))));
        article.append(reasons);
      }
      target.append(article);
    });
  }
  function renderResult() {
    const current = session.current, result = current.result;
    $('scenario-score').textContent = result ? `${result.score} / 100` : '—';
    $('scenario-verdict').textContent = result ? t(result.verdict) : t('empty');
    $('scenario-verdict').className = result ? 'pill ' + result.verdict : 'card-description';
    $('scenario-delta').textContent = result ? `${t('delta')}: ${current.previousScore} → ${result.score} (${current.scoreDelta >= 0 ? '+' : ''}${current.scoreDelta})` : '';
    for (const [id, signals] of [['scenario-new-signals', current.newSignals], ['scenario-all-signals', result?.signals || []]]) {
      const target = $(id); target.replaceChildren();
      signals.forEach(signal => {
        const li = node('li');
        li.append(node('span', I.rule(signal.code)), node('strong', `+${signal.weight}`));
        target.append(li);
      });
      if (!signals.length) target.append(node('li', t(id === 'scenario-new-signals' ? 'none' : 'noRules'), 'card-description'));
    }
    $('scenario-explanation').hidden = !result;
    $('scenario-author').hidden = current.step !== current.total;
    $('scenario-author-note').textContent = translated(scenario.note);
  }
  function renderJournal() {
    const target = $('scenario-journal'); target.replaceChildren();
    session.steps.forEach(snapshot => {
      const button = node('button', `${t('step')} ${snapshot.step} · ${snapshot.result.score} / 100`, 'secondary-button');
      button.type = 'button'; button.dataset.step = snapshot.step;
      button.setAttribute('aria-pressed', String(snapshot.step === session.current.step));
      button.addEventListener('click', () => { stop(); seek(snapshot.step); });
      target.append(button);
    });
    if (!session.steps.length) target.append(node('p', t('empty'), 'card-description'));
  }
  function refresh() {
    document.querySelectorAll('[data-scenario-i18n]').forEach(element => { element.textContent = t(element.dataset.scenarioI18n); });
    for (const option of $('scenario-select').options) option.textContent = translated(library.scenarios.find(s => s.id === option.value).title);
    $('scenario-description').textContent = translated(scenario.description);
    $('scenario-position').textContent = `${t('step')} ${session.current.step} / ${scenario.turns.length}`;
    $('scenario-progress').max = scenario.turns.length;
    $('scenario-progress').value = session.current.step;
    $('scenario-progress').setAttribute('aria-label', $('scenario-position').textContent);
    renderTranscript(); renderResult(); renderJournal(); controls();
  }
  function seek(step) {
    try { session.seek(step); if (step === scenario.turns.length) stop(); refresh(); }
    catch (_) { stop(); controls(); $('scenario-status').textContent = t('failure'); }
  }
  function schedule() {
    clearTimeout(timer);
    if (!playing) return;
    timer = setTimeout(() => { seek(session.current.step + 1); if (playing) schedule(); }, 2400);
  }
  function init(options) {
    callbacks = options;
    library.scenarios.forEach(s => {
      const option = node('option', translated(s.title)); option.value = s.id;
      $('scenario-select').append(option);
    });
    $('scenario-select').addEventListener('change', () => {
      stop(); scenario = library.scenarios.find(s => s.id === $('scenario-select').value);
      session = Engine.createSession(scenario); refresh();
    });
    $('scenario-play').addEventListener('click', () => {
      if (playing) stop(); else { playing = true; schedule(); }
      controls();
    });
    $('scenario-next').addEventListener('click', () => { stop(); seek(session.current.step + 1); });
    $('scenario-previous').addEventListener('click', () => { stop(); seek(session.current.step - 1); });
    $('scenario-reset').addEventListener('click', () => { stop(); session.reset(); refresh(); });
    $('scenario-open').addEventListener('click', () => {
      stop(); controls();
      if (session.current.result) callbacks.openResult(session.current.result);
    });
    $('scenario-projector').addEventListener('click', callbacks.projector);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); controls(); } });
    refresh();
  }
  function onRoute(view) { if (view !== 'scenarios') stop(); refresh(); }
  root.QalqanScenarioView = {init, refresh, onRoute};
})(window);
