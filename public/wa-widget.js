/*!
 * ChatFlow "Chat on WhatsApp" website widget
 *
 * <script src="https://cdn.chatflow.io/v2/wa-widget.js" async
 *   data-phone="919876543210" data-message="Hi, I have a question"></script>
 *
 * A floating button that opens a small card: a greeting, one "Start chat" button, up to three quick-message chips and
 * (on computers) a tucked-away "Scan to chat from your phone" QR code. Every button is a plain link to WhatsApp, so
 * nothing about the visitor is sent to us. On phones the card spans the width above the button and the QR is left out.
 *
 * Options (data-* on the script tag; Settings → Widget & QR Codes builds this tag for you):
 *   data-phone       business number, digits with country code, no "+"        (needed unless data-link is set)
 *   data-message     message typed in for the main button
 *   data-link        a ready-made link instead, e.g. https://wa.me/message/CODE (a Message link from Settings)
 *   data-q1-label / data-q1-message … data-q3-label / data-q3-message
 *                    up to three quick buttons (need data-phone; ignored when data-link is used)
 *   data-qr          "false" to hide the QR code                                 default "true"
 *   data-name        business name in the card header                          default "Chat with us"
 *   data-subtitle    status line under the name                                default "Typically replies in minutes"
 *   data-welcome     greeting message                                                   default "Hi 👋 How can we help you today?"
 *   data-cta         main button text                                           default "Start chat on WhatsApp"
 *   data-label       small pill beside the closed button (optional)
 *   data-color       accent colour, #rgb or #rrggbb                             default #5B5BF0
 *   data-theme       "light" | "dark"                                           default "light"
 *   data-position    "right" | "left"                                           default "right"
 *   data-open-after  seconds before the card opens by itself, once per visit; 0 = never    default 0
 *   data-mobile      "false" to hide the widget on phones                       default "true"
 *   data-branding    "false" to hide "Powered by ChatFlow"                      default "true"
 *
 * Like the chat widget loader it adds exactly one element to the page and nothing to <head>; the UI lives in a
 * shadow root so the host page's CSS cannot reach it. All text is set with textContent (no HTML from options).
 */

(function () {
  'use strict';

/* QR:start — a small QR Code generator (byte mode, error correction M, falling back to L; versions 1–10, enough for
   a ~270-character link). Port of Project Nayuki's QR Code generator (MIT). Returns { size, modules[y][x] } or null. */
function qrEncode(text, forceMask) {
  var u = unescape(encodeURIComponent(text)), bytes = [], i, j;
  for (i = 0; i < u.length; i++) bytes.push(u.charCodeAt(i));
  var ECC = {
    M: { fmt: 0, cw: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26], bl: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5] },
    L: { fmt: 1, cw: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18], bl: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4] }
  };
  function raw(v) { var r = (16 * v + 128) * v + 64; if (v >= 2) { var n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; }
  var lv = null, ver = 0, cap = 0, key, v;
  for (var k = 0; k < 2 && !lv; k++) {
    key = k ? 'L' : 'M';
    for (v = 1; v <= 10; v++) {
      cap = Math.floor(raw(v) / 8) - ECC[key].cw[v] * ECC[key].bl[v];
      if (4 + (v < 10 ? 8 : 16) + 8 * bytes.length <= cap * 8) { lv = key; ver = v; break; }
    }
  }
  if (!lv) return null;
  var ecc = ECC[lv];

  /* data bits */
  var bits = [];
  function put(val, len) { for (var b = len - 1; b >= 0; b--) bits.push((val >>> b) & 1); }
  put(4, 4); put(bytes.length, ver < 10 ? 8 : 16);
  for (i = 0; i < bytes.length; i++) put(bytes[i], 8);
  put(0, Math.min(4, cap * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  for (var pad = 0xEC; bits.length < cap * 8; pad ^= 0xEC ^ 0x11) put(pad, 8);
  var data = [];
  for (i = 0; i < bits.length; i += 8) { var by = 0; for (j = 0; j < 8; j++) by = (by << 1) | bits[i + j]; data.push(by); }

  /* Reed–Solomon over GF(256) */
  function mul(x, y) { var z = 0; for (var b = 7; b >= 0; b--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> b) & 1) * x; } return z; }
  function rs(d, deg) {
    var g = [], root = 1, a, c;
    for (a = 0; a < deg - 1; a++) g.push(0);
    g.push(1);
    for (a = 0; a < deg; a++) { for (c = 0; c < g.length; c++) { g[c] = mul(g[c], root); if (c + 1 < g.length) g[c] ^= g[c + 1]; } root = mul(root, 2); }
    var r = []; for (a = 0; a < deg; a++) r.push(0);
    d.forEach(function (x) { var f = x ^ r.shift(); r.push(0); g.forEach(function (co, n) { r[n] ^= mul(co, f); }); });
    return r;
  }
  var nb = ecc.bl[ver], el = ecc.cw[ver], rawCw = Math.floor(raw(ver) / 8), nShort = nb - rawCw % nb, shortLen = Math.floor(rawCw / nb);
  var blocks = [], at = 0;
  for (i = 0; i < nb; i++) {
    var dl = shortLen - el + (i < nShort ? 0 : 1), dat = data.slice(at, at + dl);
    at += dl;
    var ec = rs(dat, el);
    if (i < nShort) dat.push(0);
    blocks.push(dat.concat(ec));
  }
  var all = [];
  for (i = 0; i < blocks[0].length; i++) blocks.forEach(function (bl, n) { if (i !== shortLen - el || n >= nShort) all.push(bl[i]); });

  /* matrix */
  var size = ver * 4 + 17, m = [], fn = [];
  for (i = 0; i < size; i++) { m.push([]); fn.push([]); for (j = 0; j < size; j++) { m[i].push(false); fn[i].push(false); } }
  function setF(x, y, dark) { m[y][x] = dark; fn[y][x] = true; }
  for (i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
  [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
    for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
      var dist = Math.max(Math.abs(dx), Math.abs(dy)), xx = c[0] + dx, yy = c[1] + dy;
      if (xx >= 0 && xx < size && yy >= 0 && yy < size) setF(xx, yy, dist !== 2 && dist !== 4);
    }
  });
  var pos = [];
  if (ver > 1) {
    var na = Math.floor(ver / 7) + 2, step = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
    for (var p = size - 7; pos.length < na - 1; p -= step) pos.unshift(p);
    pos.unshift(6);
  }
  pos.forEach(function (py, a) { pos.forEach(function (px, b) {
    if ((a === 0 && b === 0) || (a === 0 && b === pos.length - 1) || (a === pos.length - 1 && b === 0)) return;
    for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) setF(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }); });
  function bit(x, n) { return ((x >>> n) & 1) !== 0; }
  function formatBits(mask) {
    var d = (ecc.fmt << 3) | mask, r = d;
    for (var n = 0; n < 10; n++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    var f = ((d << 10) | r) ^ 0x5412, n2;
    for (n2 = 0; n2 <= 5; n2++) setF(8, n2, bit(f, n2));
    setF(8, 7, bit(f, 6)); setF(8, 8, bit(f, 7)); setF(7, 8, bit(f, 8));
    for (n2 = 9; n2 < 15; n2++) setF(14 - n2, 8, bit(f, n2));
    for (n2 = 0; n2 < 8; n2++) setF(size - 1 - n2, 8, bit(f, n2));
    for (n2 = 8; n2 < 15; n2++) setF(8, size - 15 + n2, bit(f, n2));
    setF(8, size - 8, true);
  }
  formatBits(0);
  if (ver >= 7) {
    var vr = ver;
    for (i = 0; i < 12; i++) vr = (vr << 1) ^ ((vr >>> 11) * 0x1F25);
    var vb = (ver << 12) | vr;
    for (i = 0; i < 18; i++) { var col = bit(vb, i), va = size - 11 + (i % 3), vc = Math.floor(i / 3); setF(va, vc, col); setF(vc, va, col); }
  }
  var bi = 0;
  for (var right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
      var x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
      if (!fn[y][x] && bi < all.length * 8) { m[y][x] = bit(all[bi >>> 3], 7 - (bi & 7)); bi++; }
    }
  }

  /* mask */
  function applyMask(mask) {
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      var inv;
      switch (mask) {
        case 0: inv = (x + y) % 2 === 0; break;
        case 1: inv = y % 2 === 0; break;
        case 2: inv = x % 3 === 0; break;
        case 3: inv = (x + y) % 3 === 0; break;
        case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: inv = x * y % 2 + x * y % 3 === 0; break;
        case 6: inv = (x * y % 2 + x * y % 3) % 2 === 0; break;
        default: inv = ((x + y) % 2 + x * y % 3) % 2 === 0;
      }
      if (!fn[y][x] && inv) m[y][x] = !m[y][x];
    }
  }
  function addHist(run, h) { if (h[0] === 0) run += size; h.pop(); h.unshift(run); }
  function countPat(h) {
    var n = h[1], core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n;
    return (core && h[0] >= n * 4 && h[6] >= n ? 1 : 0) + (core && h[6] >= n * 4 && h[0] >= n ? 1 : 0);
  }
  function endCount(color, run, h) { if (color) { addHist(run, h); run = 0; } run += size; addHist(run, h); return countPat(h); }
  function penalty() {
    var res = 0, x, y, run, color, h;
    for (y = 0; y < size; y++) {
      color = false; run = 0; h = [0, 0, 0, 0, 0, 0, 0];
      for (x = 0; x < size; x++) {
        if (m[y][x] === color) { run++; if (run === 5) res += 3; else if (run > 5) res++; }
        else { addHist(run, h); if (!color) res += countPat(h) * 40; color = m[y][x]; run = 1; }
      }
      res += endCount(color, run, h) * 40;
    }
    for (x = 0; x < size; x++) {
      color = false; run = 0; h = [0, 0, 0, 0, 0, 0, 0];
      for (y = 0; y < size; y++) {
        if (m[y][x] === color) { run++; if (run === 5) res += 3; else if (run > 5) res++; }
        else { addHist(run, h); if (!color) res += countPat(h) * 40; color = m[y][x]; run = 1; }
      }
      res += endCount(color, run, h) * 40;
    }
    for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) {
      var c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) res += 3;
    }
    var dark = 0;
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (m[y][x]) dark++;
    res += (Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1) * 10;
    return res;
  }
  var best = 0, bestPen = Infinity;
  if (typeof forceMask === 'number') best = forceMask;
  else for (i = 0; i < 8; i++) {
    applyMask(i); formatBits(i);
    var pen = penalty();
    if (pen < bestPen) { best = i; bestPen = pen; }
    applyMask(i);
  }
  applyMask(best); formatBits(best);
  return { size: size, modules: m, mask: best, version: ver, level: lv };
}
/* QR:end */

  var self = document.currentScript || (function () {
    var all = document.querySelectorAll('script[src*="wa-widget.js"]');
    return all[all.length - 1] || null;
  })();
  if (!self) return;
  if (window.__chatflowWaWidget) return;       // a tag manager firing the snippet twice must not make two buttons

  var d = self.dataset || {};
  var phone = String(d.phone || '').replace(/\D/g, '');
  var phoneOk = phone.length >= 8 && phone.length <= 15;
  var message = d.message || '';

  function chatUrl(text) { return 'https://wa.me/' + phone + (text ? '?text=' + encodeURIComponent(text) : ''); }

  /* Where the main button goes: a Message link if given (https, WhatsApp host only), else click-to-chat. */
  var link = '';
  var usingLink = false;
  if (d.link) {
    try {
      var u = new URL(d.link);
      if (u.protocol === 'https:' && (u.hostname === 'wa.me' || u.hostname === 'api.whatsapp.com')) { link = u.href; usingLink = true; }
    } catch (e) { /* ignore: falls through to phone */ }
  }
  if (!link && phoneOk) link = chatUrl(message);
  if (!link) {
    if (window.console) console.warn('[ChatFlow] wa-widget.js needs data-phone (digits with country code) or a wa.me data-link.');
    return;
  }

  /* Quick buttons: label + their own message, click-to-chat only, at most three. */
  var quick = [];
  if (!usingLink) {
    for (var q = 1; q <= 3; q++) {
      var ql = (d['q' + q + 'Label'] || '').trim();
      if (ql) quick.push({ label: ql, url: chatUrl(d['q' + q + 'Message'] || '') });
    }
  }

  function hex(c) {
    c = String(c || '').trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) return '#5B5BF0';
    if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    return c;
  }
  var accent = hex(d.color);
  // white or near-black text, whichever reads better on the accent
  var rgb = [1, 3, 5].map(function (i) { return parseInt(accent.substr(i, 2), 16) / 255; }).map(function (c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  var on = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) > 0.5 ? '#0b1020' : '#ffffff';

  var dark = d.theme === 'dark';
  var left = d.position === 'left';
  var openAfter = Math.max(0, parseInt(d.openAfter, 10) || 0);
  var name = d.name || 'Chat with us';
  var subtitle = d.subtitle || 'Typically replies in minutes';
  var welcome = d.welcome || 'Hi 👋 How can we help you today?';
  var cta = d.cta || 'Start chat on WhatsApp';
  var label = d.label || '';
  var showQr = d.qr !== 'false';
  var branding = d.branding !== 'false';
  var preview = d.preview === '1';             // the Settings preview: card open, no timers
  var Z = '2147482000';                         // under the chat widget (…3000) so both can sit on one page

  var host = document.createElement('div');
  host.id = 'chatflow-wa-widget';
  host.style.setProperty('all', 'initial', 'important');
  host.style.setProperty('position', 'fixed', 'important');
  host.style.setProperty('bottom', '0', 'important');
  host.style.setProperty(left ? 'left' : 'right', '0', 'important');
  host.style.setProperty('z-index', Z, 'important');
  host.style.setProperty('width', '0', 'important');
  host.style.setProperty('height', '0', 'important');
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

  var side = left ? 'left' : 'right';
  var css =
    ':host{all:initial}*{box-sizing:border-box;margin:0}' +
    '.ui{--a:' + accent + ';--on:' + on + ';' +
      '--bg:' + (dark ? '#14181f' : '#ffffff') + ';--fg:' + (dark ? '#eceef2' : '#111827') + ';--mut:' + (dark ? '#8f98a8' : '#6b7280') + ';' +
      '--line:' + (dark ? 'rgba(255,255,255,.10)' : 'rgba(17,24,39,.09)') + ';--soft:' + (dark ? 'rgba(255,255,255,.06)' : '#f4f5f7') + ';' +
      'font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased;color:var(--fg);font-size:14px;line-height:1.4}' +
    '.wrap{position:fixed;bottom:calc(20px + env(safe-area-inset-bottom,0px));' + side + ':calc(20px + env(safe-area-inset-' + side + ',0px));display:flex;flex-direction:column;align-items:' + (left ? 'flex-start' : 'flex-end') + ';gap:10px}' +

    /* launcher: one round button, an optional pill beside it */
    '.launch{display:flex;align-items:center;gap:10px;flex-direction:' + (left ? 'row' : 'row-reverse') + '}' +
    '.fab{position:relative;width:54px;height:54px;border-radius:50%;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;background:var(--a);color:var(--on);' +
      'box-shadow:0 6px 18px rgba(17,24,39,.22),0 1px 3px rgba(17,24,39,.2);transition:transform .2s cubic-bezier(.2,.9,.3,1.3)}' +
    '.fab:hover{transform:scale(1.06)}.fab:active{transform:scale(.95)}.fab svg{width:26px;height:26px;fill:currentColor}' +
    '.fab::after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid var(--a);opacity:0;animation:ring 2.6s ease-out 1s 2}' +
    '@keyframes ring{0%{opacity:.5;transform:scale(1)}100%{opacity:0;transform:scale(1.5)}}' +
    '.fab:focus-visible,.go:focus-visible,.chip:focus-visible,.x:focus-visible,.qrb:focus-visible{outline:2px solid var(--a);outline-offset:2px}' +
    '.tag{display:flex;align-items:center;gap:7px;background:var(--bg);color:var(--fg);font-size:13px;font-weight:600;padding:8px 12px;border-radius:999px;box-shadow:0 4px 14px rgba(17,24,39,.18),0 0 0 1px var(--line);white-space:nowrap}' +
    '.dot{width:7px;height:7px;border-radius:50%;background:#22c55e;flex-shrink:0}' +

    /* card: a slim header, the greeting as a chat bubble, one button, optional chips */
    '.card{width:min(300px,calc(100vw - 24px));max-height:calc(100vh - 110px);max-height:calc(100dvh - 110px);overflow-y:auto;border-radius:20px;background:var(--bg);' +
      'box-shadow:0 18px 44px -12px rgba(17,24,39,.35),0 0 0 1px var(--line);transform-origin:' + (left ? 'bottom left' : 'bottom right') + ';animation:pop .2s cubic-bezier(.2,.9,.3,1.1)}' +
    '@keyframes pop{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}' +
    '.head{display:flex;align-items:center;gap:10px;padding:14px 10px 0 14px}' +
    '.av{width:34px;height:34px;border-radius:50%;background:var(--a);color:var(--on);font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
    '.who{flex:1;min-width:0}.nm{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.st{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--mut);margin-top:1px}' +
    '.x{border:0;background:transparent;width:28px;height:28px;border-radius:8px;color:var(--mut);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}.x:hover{background:var(--soft);color:var(--fg)}' +
    '.x svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2.2;stroke-linecap:round}' +
    '.msg{margin:12px 14px 0;padding:10px 12px;background:var(--soft);border-radius:4px 14px 14px 14px;font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word}' +
    '.body{padding:12px 14px 12px}' +
    '.go{display:flex;align-items:center;justify-content:center;gap:8px;height:42px;border-radius:12px;background:var(--a);color:var(--on);text-decoration:none;font-weight:600;font-size:14px;transition:filter .15s,transform .15s}' +
    '.go:hover{filter:brightness(1.07)}.go:active{transform:scale(.985)}.go svg{width:18px;height:18px;fill:currentColor;flex-shrink:0}' +
    '.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}' +
    '.chip{display:inline-flex;align-items:center;max-width:100%;height:32px;padding:0 12px;border-radius:999px;font-size:13px;font-weight:500;color:var(--fg);text-decoration:none;box-shadow:inset 0 0 0 1px var(--line);' +
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:background .15s,box-shadow .15s}.chip:hover{background:var(--soft);box-shadow:inset 0 0 0 1px var(--a)}' +
    '.qrb{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin-top:8px;padding:7px;border:0;background:transparent;color:var(--mut);font:inherit;font-size:12px;border-radius:8px;cursor:pointer}' +
    '.qrb:hover{color:var(--fg);background:var(--soft)}.qrb svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '.qrp{display:flex;align-items:center;gap:12px;margin-top:4px;padding:10px;border-radius:12px;background:var(--soft)}' +
    '.qrp .tile{width:88px;height:88px;border-radius:8px;background:#fff;padding:4px;flex-shrink:0}.qrp svg{display:block;width:100%;height:100%}' +
    '.qrp p{font-size:12px;line-height:1.4;color:var(--mut)}' +
    '.pw{text-align:center;font-size:10.5px;color:var(--mut);opacity:.85;padding:0 0 10px}.pw b{font-weight:600}' +
    '.hide{display:none!important}' +

    /* phones: the card spans the width above the button; no QR (the visitor is already on their phone) */
    '@media (max-width:640px){.card{width:calc(100vw - 16px)}.wrap{' + side + ':8px;bottom:calc(8px + env(safe-area-inset-bottom,0px))}.qrb,.qrp{display:none!important}.body{padding-bottom:calc(12px + env(safe-area-inset-bottom,0px))}.wrap.open .launch{display:none}}' +
    '@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}' +
    (d.mobile === 'false' ? '@media (max-width:640px){.wrap{display:none}}' : '');

  var GLYPH = 'M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.31a8.188 8.188 0 0 1-1.26-4.38c.01-4.54 3.7-8.24 8.25-8.24zM8.53 7.33c-.16 0-.43.06-.66.31-.22.25-.87.86-.87 2.07 0 1.22.89 2.39 1 2.56.14.17 1.76 2.67 4.25 3.73.59.27 1.05.42 1.41.53.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.27-.25-.14-1.47-.74-1.69-.82-.23-.09-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.53.07-.26-.13-1.06-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.12-.25-.01-.39.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14 0-.3-.01-.47-.01z';
  var NS = 'http://www.w3.org/2000/svg';
  function svg(vb) { var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', vb || '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); return s; }
  function path(s, dd, fill) { var p = document.createElementNS(NS, 'path'); p.setAttribute('d', dd); if (fill) p.setAttribute('fill', fill); s.appendChild(p); return s; }
  function icon(dd) { return path(svg(), dd); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }
  function a(cls, href) { var n = el('a', cls); n.href = href; n.target = '_blank'; n.rel = 'noopener noreferrer'; return n; }

  var style = document.createElement('style');
  style.textContent = css;
  root.appendChild(style);

  var ui = el('div', 'ui');
  var wrap = el('div', 'wrap');

  var card = el('div', 'card hide');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', name);

  var head = el('div', 'head');
  var who = el('div', 'who');
  who.appendChild(el('div', 'nm', name));
  var st = el('div', 'st'); st.appendChild(el('span', 'dot')); st.appendChild(document.createTextNode(subtitle)); who.appendChild(st);
  var x = el('button', 'x'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.appendChild(icon('M6 6l12 12M18 6L6 18'));
  head.appendChild(el('div', 'av', (name.trim().charAt(0) || 'C').toUpperCase())); head.appendChild(who); head.appendChild(x);
  card.appendChild(head);
  card.appendChild(el('div', 'msg', welcome));

  var body = el('div', 'body');
  var go = a('go', link);
  go.appendChild(icon(GLYPH)); go.appendChild(document.createTextNode(cta));
  body.appendChild(go);

  if (quick.length) {
    var chips = el('div', 'chips');
    quick.forEach(function (it) { var c = a('chip', it.url); c.textContent = it.label; c.title = it.label; chips.appendChild(c); });
    body.appendChild(chips);
  }

  /* QR: tucked behind a small link so the card stays compact; computers only */
  var code = showQr ? qrEncode(link) : null;
  if (code) {
    var qrb = el('button', 'qrb'); qrb.type = 'button'; qrb.setAttribute('aria-expanded', 'false');
    qrb.appendChild(icon('M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v3M14 20h3M20 20v1'));
    qrb.appendChild(document.createTextNode('Scan to chat from your phone'));
    var qrp = el('div', 'qrp hide');
    var tile = el('div', 'tile');
    var N = code.size, M = 2, dd = '';
    for (var yy = 0; yy < N; yy++) {
      for (var xx = 0; xx < N; xx++) {
        if (!code.modules[yy][xx]) continue;
        var run = 1;
        while (xx + run < N && code.modules[yy][xx + run]) run++;
        dd += 'M' + (xx + M) + ',' + (yy + M) + 'h' + run + 'v1h-' + run + 'z';
        xx += run;
      }
    }
    var qsvg = svg('0 0 ' + (N + M * 2) + ' ' + (N + M * 2));
    qsvg.setAttribute('role', 'img'); qsvg.setAttribute('aria-label', 'QR code that opens this chat in WhatsApp');
    qsvg.setAttribute('shape-rendering', 'crispEdges');
    path(qsvg, dd, '#0b1020');
    tile.appendChild(qsvg);
    qrp.appendChild(tile); qrp.appendChild(el('p', '', 'Point your camera at the code to continue in WhatsApp.'));
    qrb.addEventListener('click', function () {
      var shown = qrp.classList.toggle('hide') === false;
      qrb.setAttribute('aria-expanded', shown ? 'true' : 'false');
    });
    body.appendChild(qrb); body.appendChild(qrp);
  }
  card.appendChild(body);
  if (branding) { var pw = el('div', 'pw'); pw.appendChild(document.createTextNode('Powered by ')); pw.appendChild(el('b', '', 'ChatFlow')); card.appendChild(pw); }

  /* the closed button (+ optional pill) */
  var launch = el('div', 'launch');
  var fab = el('button', 'fab'); fab.type = 'button';
  fab.setAttribute('aria-label', 'Chat on WhatsApp'); fab.setAttribute('aria-expanded', 'false');
  fab.appendChild(icon(GLYPH));
  launch.appendChild(fab);
  var tag = null;
  if (label) { tag = el('div', 'tag'); tag.appendChild(el('span', 'dot')); tag.appendChild(document.createTextNode(label)); launch.appendChild(tag); }

  wrap.appendChild(card); wrap.appendChild(launch);
  ui.appendChild(wrap);
  root.appendChild(ui);

  var isOpen = false;
  function setOpen(v, focus) {
    isOpen = v;
    card.classList.toggle('hide', !v);
    wrap.classList.toggle('open', v);
    if (tag) tag.classList.toggle('hide', v);
    fab.setAttribute('aria-expanded', v ? 'true' : 'false');
    if (v && focus) go.focus();
  }
  fab.addEventListener('click', function () { setOpen(!isOpen, true); });
  x.addEventListener('click', function () { setOpen(false); fab.focus(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) { setOpen(false); fab.focus(); } });

  if (preview) setOpen(true);
  else if (openAfter > 0) {
    var seen = false;
    try { seen = sessionStorage.getItem('chatflow_wa_opened') === '1'; } catch (e) { /* storage blocked: may reopen on each page */ }
    if (!seen) {
      setTimeout(function () {
        if (!isOpen) setOpen(true);
        try { sessionStorage.setItem('chatflow_wa_opened', '1'); } catch (e) { /* ignore */ }
      }, openAfter * 1000);
    }
  }

  function mount() { if (document.body) document.body.appendChild(host); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  window.__chatflowWaWidget = {
    open: function () { setOpen(true); },
    close: function () { setOpen(false); },
    destroy: function () { if (host.parentNode) host.parentNode.removeChild(host); window.__chatflowWaWidget = null; }
  };
})();
