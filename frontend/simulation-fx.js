/* Pressure timer and X-ray labels for the simulator. Presentation only: nothing here feeds the analyzer,
   and nothing is stored or sent. The timer never changes a score or blocks an action. */
window.QalqanSimulationFx = (() => {
  'use strict';
  const I = window.QalqanI18n;
  const pair = (ru, kk) => (I.language() === 'kk' ? kk : ru);
  // Minutes shown on the learning timer, by story id. Stories without pressure show no timer.
  const PRESSURE = { 'blocked-card': 10, 'safe-transfer': 15 };
  const timers = new WeakMap();
  let xrayOn = true, tick = 0, current = null;

  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
  const clock = seconds => String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');

  function record(session) {
    let r = timers.get(session);
    if (!r) { r = { start: null, end: null }; timers.set(session, r); }
    const phase = session.state.phase;
    if (phase !== 'notification' && r.start == null) r.start = performance.now();
    if (phase === 'outcome' && r.end == null) r.end = performance.now();
    return r;
  }
  const elapsed = r => (r.start == null ? 0 : Math.floor(((r.end ?? performance.now()) - r.start) / 1000));

  function paintTimer(node, session) {
    const minutes = PRESSURE[session.story.id], total = minutes * 60, r = record(session);
    const left = Math.max(0, total - elapsed(r)), expired = left === 0;
    node.dataset.expired = String(expired);
    node.style.setProperty('--p', String(Math.round((left / total) * 100)));
    node.querySelector('.sim-timer-clock').textContent = clock(left);
    node.querySelector('.sim-timer-copy strong').textContent = expired
      ? pair('Время вышло', 'Уақыт бітті')
      : pair(`Вас торопят: ${minutes} минут на решение`, `Сізді асықтырады: шешімге ${minutes} минут`);
    node.querySelector('.sim-timer-copy small').textContent = expired
      ? pair('На спешку и рассчитывает давление. Остановиться и проверить можно в любой момент.', 'Қысым дәл асығысқа сүйенеді. Тоқтап, тексеруге кез келген уақытта болады.')
      : pair('Срочность — приём давления. Таймер учебный и не влияет на индекс Qalqan.', 'Асықтыру — қысым жасау тәсілі. Таймер оқу үшін, Qalqan индексіне әсер етпейді.');
  }

  function syncTimer(session, body) {
    body.querySelectorAll('.sim-timer').forEach(n => n.remove());
    clearInterval(tick); tick = 0;
    const phase = session.state.phase;
    if (!PRESSURE[session.story.id] || phase === 'notification') return;
    const total = PRESSURE[session.story.id] * 60;
    if (phase === 'outcome') {
      const spent = Math.min(elapsed(record(session)), total);
      const note = el('p', pair(`Решение принято за ${clock(spent)} из ${clock(total)}. Таймер не влиял на анализ.`, `Шешім ${clock(spent)} ішінде қабылданды (${clock(total)} ішінен). Таймер талдауға әсер еткен жоқ.`), 'sim-timer-note');
      body.querySelector('.sim-kicker')?.after(note);
      return;
    }
    const node = el('div', null, 'sim-timer');
    node.setAttribute('role', 'timer');
    const ring = el('div', null, 'sim-timer-ring'); ring.append(el('span', '', 'sim-timer-clock'));
    const copy = el('div', null, 'sim-timer-copy'); copy.append(el('strong'), el('small'));
    node.append(ring, copy);
    body.querySelector('.sim-kicker')?.after(node);
    paintTimer(node, session);
    // Update the visible clock without rebuilding the phone; keeps focus and reading position stable.
    tick = setInterval(() => { const n = document.querySelector('#sim-phone-body .sim-timer'); if (!n || !current) return; paintTimer(n, current); }, 1000);
  }

  function firstFragments(result) {
    const map = new Map();
    for (const reply of result.replies || [result]) for (const s of reply.signals) if (!map.has(s.code) && s.matches?.length) map.set(s.code, s.matches[0].text);
    return map;
  }

  function syncXray(session, stage, result) {
    let layer = stage.querySelector('.sim-xray'), toggle = stage.querySelector('#sim-xray-toggle');
    if (!result || !result.signals.length) { layer?.remove(); toggle?.remove(); return; }
    if (!toggle) {
      toggle = el('button', null, 'sim-xray-toggle'); toggle.id = 'sim-xray-toggle'; toggle.type = 'button';
      toggle.addEventListener('click', () => { xrayOn = !xrayOn; syncXray(current, stage, current.result()); });
      stage.append(toggle);
    }
    toggle.textContent = pair('◉ Рентген сообщения', '◉ Хабарлама рентгені');
    toggle.setAttribute('aria-pressed', String(xrayOn));
    toggle.title = pair('Метки показывают реальные срабатывания правил Qalqan, а не авторское пояснение.', 'Белгілер Qalqan ережелерінің нақты іске қосылуын көрсетеді, автор түсіндірмесін емес.');
    layer?.remove();
    if (!xrayOn) return;
    layer = el('div', null, 'sim-xray'); layer.setAttribute('role', 'list');
    const fragments = firstFragments(result);
    result.signals.slice().sort((a, b) => b.weight - a.weight).slice(0, 3).forEach((signal, index) => {
      const item = el('div', null, 'sim-xray-label pos-' + (index + 1)); item.setAttribute('role', 'listitem');
      item.dataset.tone = signal.weight >= 35 ? 'high' : signal.weight >= 18 ? 'mid' : 'low';
      item.append(el('span', I.rule(signal.code) + ' · +' + signal.weight));
      const fragment = fragments.get(signal.code);
      if (fragment) { const q = el('b', fragment.length > 30 ? fragment.slice(0, 29) + '…' : fragment); q.dataset.userText = ''; item.append(q); }
      layer.append(item);
    });
    stage.append(layer);
  }

  function sync(session) {
    current = session;
    const body = document.getElementById('sim-phone-body'), stage = document.getElementById('sim-stage');
    if (!body || !stage) return;
    syncTimer(session, body);
    syncXray(session, stage, session.result());
  }
  function stop() { clearInterval(tick); tick = 0; }
  return { sync, stop, minutes: id => PRESSURE[id] || 0 };
})();
