/* Qalqan cyber theme: decorative only. Nothing here reads, stores or sends user text. */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = matchMedia('(max-width: 760px)');
  const NS = 'http://www.w3.org/2000/svg';

  /* Line icons for the main navigation (paths are 24x24 strokes). */
  const icons = {
    analyzer: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M4 12h16"/>',
    scenarios: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4A8 8 0 1 1 20 12z"/><path d="M8.5 11h7M8.5 14h4"/>',
    trainer: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
    dashboard: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    history: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    research: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>',
    simulator: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
    presentation: '<rect x="3.5" y="4.5" width="17" height="11" rx="1.5"/><path d="M12 15.5V20M8 20h8"/>'
  };
  function addIcons() {
    document.querySelectorAll('#main-navigation .main-links a[data-view]').forEach(a => {
      const d = icons[a.dataset.view];
      if (!d || a.querySelector('.nav-ic')) return;
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'nav-ic'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = d;
      a.prepend(svg);
    });
  }

  /* Network background on a fixed canvas. */
  function network() {
    if (small.matches) return;
    const cv = document.createElement('canvas'); cv.id = 'cyber-net'; cv.setAttribute('aria-hidden', 'true');
    const scan = document.createElement('div'); scan.className = 'cyber-scan'; scan.setAttribute('aria-hidden', 'true');
    document.body.prepend(scan, cv);
    const cx = cv.getContext('2d'); let W, H, pts = [], raf = 0;
    function size() {
      W = cv.width = innerWidth; H = cv.height = innerHeight;
      pts = Array.from({ length: Math.min(90, Math.round(W * H / 28000)) }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22 }));
    }
    function frame() {
      cx.clearRect(0, 0, W, H);
      for (const p of pts) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 150) { cx.strokeStyle = `rgba(34,211,255,${.22 * (1 - d / 150)})`; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); }
        }
        cx.fillStyle = 'rgba(120,220,255,.7)'; cx.beginPath(); cx.arc(pts[i].x, pts[i].y, 1.4, 0, 7); cx.fill();
      }
      if (!reduce && !document.hidden) raf = requestAnimationFrame(frame);
    }
    function start() { cancelAnimationFrame(raf); size(); frame(); }
    addEventListener('resize', start);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !reduce) { cancelAnimationFrame(raf); frame(); } });
    start();
  }

  /* Radar behind the home evidence card. */
  function radar() {
    const host = document.querySelector('#view-home .hero-evidence');
    if (!host || host.querySelector('.cyber-radar')) return;
    const box = document.createElement('div'); box.className = 'cyber-radar'; box.setAttribute('aria-hidden', 'true');
    box.innerHTML = `<svg viewBox="0 0 520 520"><defs>
      <radialGradient id="cr-glow"><stop offset="0" stop-color="#22d3ff" stop-opacity=".2"/><stop offset="1" stop-color="#22d3ff" stop-opacity="0"/></radialGradient>
      <linearGradient id="cr-sw" x1="0" x2="1"><stop offset="0" stop-color="#22d3ff" stop-opacity="0"/><stop offset="1" stop-color="#22d3ff" stop-opacity=".5"/></linearGradient></defs>
      <circle cx="260" cy="260" r="255" fill="url(#cr-glow)"/>
      <g class="cr-spin3" fill="none" stroke="#22d3ff" stroke-opacity=".25"><circle cx="260" cy="260" r="248" stroke-dasharray="2 10"/></g>
      <g class="cr-spin1" fill="none" stroke="#22d3ff" stroke-opacity=".5"><circle cx="260" cy="260" r="215" stroke-dasharray="60 20 6 20" stroke-width="1.5"/><circle cx="260" cy="45" r="5" fill="#22d3ff"/><circle cx="475" cy="260" r="4" fill="#25ce79"/></g>
      <g class="cr-spin2" fill="none" stroke="#8b5cf6" stroke-opacity=".6"><circle cx="260" cy="260" r="180" stroke-dasharray="4 8"/><circle cx="80" cy="260" r="5" fill="#8b5cf6"/></g>
      <g fill="none" stroke="#22d3ff" stroke-opacity=".16"><circle cx="260" cy="260" r="140"/><circle cx="260" cy="260" r="95"/><path d="M260 20v480M20 260h480"/></g>
      <g class="cr-sweep"><path d="M260 260 L260 20 A240 240 0 0 1 430 90 Z" fill="url(#cr-sw)" opacity=".55"/></g>
      <g fill="#ff565f"><circle class="cr-blip" cx="360" cy="150"/><circle class="cr-blip" cx="170" cy="130"/><circle class="cr-blip" cx="400" cy="320"/><circle class="cr-blip" cx="130" cy="350"/></g></svg>`;
    host.prepend(box);
  }

  /* Live feed of synthetic detection examples. Shown only while the home view is visible. */
  function feed() {
    const home = document.getElementById('view-home'), anchor = home?.querySelector('.home-hero');
    if (!home || !anchor || home.querySelector('.cyber-feed')) return;
    const card = document.createElement('article'); card.className = 'card cyber-feed';
    card.innerHTML = '<h2>Журнал обнаружения · учебные примеры</h2><div class="cyber-log" id="cyber-log" aria-hidden="true"></div><p class="cyber-feed-foot">Синтетические строки для демонстрации. Ваши сообщения сюда не попадают.</p>';
    anchor.after(card);
    const log = card.querySelector('#cyber-log');
    const rows = [['a', 'ALERT', 'impersonation', 'kaspi-secure.xyz', '+45'], ['a', 'ALERT', 'secret_request', '«сообщите код»', '+45'],
      ['w', 'WARN ', 'urgency', '«срочно», «немедленно»', '+18'], ['o', 'PASS ', 'clean', 'Платёж выполнен. Подробности в приложении', '0'],
      ['a', 'ALERT', 'transfer', '«безопасный счёт»', '+35'], ['w', 'WARN ', 'no_https', 'http://login-check.top', '+10'],
      ['a', 'ALERT', 'account_threat', '«карта заблокирована»', '+22'], ['o', 'PASS ', 'clean', 'Код подтверждения: никому не сообщайте', '0']];
    let k = 0;
    function add() {
      const [c, lvl, rule, msg, w] = rows[k++ % rows.length], t = new Date().toTimeString().slice(0, 8);
      const el = document.createElement('div'); el.className = 'cyber-ln';
      const span = (cls, text) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; return s; };
      el.append(span('t', `[${t}] `), span(c, lvl), document.createTextNode(` ${rule} ${msg} `), span(c, w));
      log.prepend(el); while (log.children.length > 8) log.lastChild.remove();
    }
    for (let i = 0; i < 6; i++) add();
    if (!reduce) setInterval(() => { if (!document.hidden && !home.hidden) add(); }, 2200);
  }

  function init() { addIcons(); network(); radar(); feed(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
