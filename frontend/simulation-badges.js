/* Learning badges for the simulator. Pure logic over a finished session: no storage, no network, and nothing
   here feeds the analyzer or rates the person. Progress lives in tab memory only. */
(function(root) {
  'use strict';
  const pair = (ru, kk) => ({ ru, kk });
  const RISKY = ['open_link', 'send_demo', 'transfer_demo'];
  const badges = [
    { id: 'stop', icon: 'shield', name: pair('Первая остановка', 'Алғашқы тоқтау'),
      text: pair('Завершили ситуацию, не передав код или деньги: остановились или связались с банком сами.', 'Ситуацияны код пен ақша бермей аяқтадыңыз: тоқтадыңыз не банкке өзіңіз хабарластыңыз.') },
    { id: 'domain', icon: 'domain', name: pair('Нашёл настоящий домен', 'Нақты доменді тапты'),
      text: pair('Верно выбрали домен назначения в учебной ссылке.', 'Оқу сілтемесінде баратын доменді дұрыс таңдадыңыз.') },
    { id: 'calm', icon: 'clock', name: pair('Не поддался давлению', 'Қысымға берілмеді'),
      text: pair('В сюжете с таймером остановились или позвонили в банк сами.', 'Таймері бар оқиғада тоқтадыңыз не банкке өзіңіз қоңырау шалдыңыз.') },
    { id: 'selfcall', icon: 'phone', name: pair('Связался сам', 'Өзі хабарласты'),
      text: pair('Выбрали самостоятельную связь с банком через приложение или номер на карте.', 'Банкке қолданба не картадағы нөмір арқылы өзіңіз хабарласуды таңдадыңыз.') },
    { id: 'verify', icon: 'scan', name: pair('Проверил до действия', 'Әрекетке дейін тексерді'),
      text: pair('Запустили проверку Qalqan до перехода по ссылке, кода или перевода.', 'Сілтемеге өтуге, код беруге не аударуға дейін Qalqan тексеруін іске қостыңыз.') },
    { id: 'all', icon: 'cube', name: pair('Все сюжеты', 'Барлық оқиғалар'),
      text: pair('Прошли все ситуации симулятора, с любым исходом.', 'Симулятордың барлық жағдайынан кез келген нәтижемен өттіңіз.') }
  ];
  const icons = {
    shield: '<path d="M12 2.5 4.5 5.5v5.7c0 4.6 3.1 8.3 7.5 10.3 4.4-2 7.5-5.7 7.5-10.3V5.5z"/><path d="m8.8 12 2.3 2.3 4.2-4.6"/>',
    domain: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5M8.5 11h5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    phone: '<path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 5.2 5.2l1.3-2 4 1.5v3a2 2 0 0 1-2 2A14.5 14.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="m9 12 2 2 4-4"/>',
    cube: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>'
  };
  // Which badges a finished session earns. The result depends only on what happened in the story.
  function earnedBy(session) {
    const state = session.state;
    if (state.phase !== 'outcome') return [];
    const out = [], ending = state.ending, safe = ending === 'ignore' || ending === 'contact';
    if (safe) out.push('stop');
    if (state.inspection.correct === true) out.push('domain');
    if (safe && session.story.pressure > 0) out.push('calm');
    if (ending === 'contact') out.push('selfcall');
    const analyze = state.trace.findIndex(e => e.action === 'analyze'), risky = state.trace.findIndex(e => RISKY.includes(e.action));
    if (analyze >= 0 && (risky < 0 || analyze < risky)) out.push('verify');
    return out;
  }
  function createProgress(totalStories) {
    const earned = new Set(), done = new Set();
    return {
      earned, done, total: badges.length, totalStories,
      // Returns only the badges earned for the first time by this call.
      record(session) {
        if (session.state.phase !== 'outcome') return [];
        done.add(session.story.id);
        const fresh = [];
        for (const id of earnedBy(session)) if (!earned.has(id)) { earned.add(id); fresh.push(id); }
        if (done.size >= totalStories && !earned.has('all')) { earned.add('all'); fresh.push('all'); }
        return fresh;
      }
    };
  }
  const api = Object.freeze({ badges: Object.freeze(badges), icons: Object.freeze(icons), earnedBy, createProgress });
  if (typeof module === 'object' && module.exports) module.exports = api; else root.QalqanSimulationBadges = api;
})(typeof globalThis === 'object' ? globalThis : this);
