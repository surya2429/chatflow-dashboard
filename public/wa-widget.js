/*!
 * ChatFlow "Chat on WhatsApp" website widget
 *
 *   <script src="https://cdn.chatflow.io/v2/wa-widget.js" async data-phone="919876543210" data-message="Hi!"></script>
 *
 * A round button that opens a small card: greeting, one "Start chat" button, up to three quick-message chips and (on
 * computers) a QR code to continue on a phone. Every button is a plain link to WhatsApp - nothing about the visitor is
 * sent to us. On phones the card spans the width and the QR is left out.
 *
 * Options, all optional except the number (data-* on the script tag; Settings -> Widget & QR Codes writes it for you):
 *   data-phone   digits with country code        data-message  text typed in for the main button
 *   data-link    a wa.me Message link instead of phone + message
 *   data-q1 / data-q2 / data-q3   quick buttons as "Label|Message" (need data-phone)
 *   data-name, data-subtitle, data-welcome, data-cta, data-label (pill beside the button)
 *   data-color #hex (default #5B5BF0)   data-theme light|dark   data-position right|left   data-font (see WEB below)
 *   data-qr false   data-branding false   data-mobile false   data-open-after <seconds, once per visit>
 *   data-preview / data-device   used only by the Settings preview
 *
 * One element is added to the page (a shadow root keeps the host's CSS out) - plus, only when a web font is chosen,
 * one Google Fonts stylesheet link. All text is set with textContent; nothing from the options is parsed as HTML.
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

  var self = document.currentScript || (function () { var a = document.querySelectorAll('script[src*="wa-widget"]'); return a[a.length - 1]; })();
  if (!self || window.__chatflowWaWidget) return;       // a tag manager firing the snippet twice must not make two buttons
  var d = self.dataset;

  var phone = String(d.phone || '').replace(/\D/g, '');
  function chat(text) { return 'https://wa.me/' + phone + (text ? '?text=' + encodeURIComponent(text) : ''); }

  /* Main button: a Message link if given (https, WhatsApp host only), else click-to-chat with the number. */
  var link = '', byLink = false;
  if (d.link) {
    try { var u = new URL(d.link); if (u.protocol === 'https:' && /^(wa\.me|api\.whatsapp\.com)$/.test(u.hostname)) { link = u.href; byLink = true; } } catch (e) { /* use the number */ }
  }
  if (!link && phone.length >= 8 && phone.length <= 15) link = chat(d.message);
  if (!link) { if (window.console) console.warn('[ChatFlow] wa-widget.js needs data-phone (digits with country code) or a wa.me data-link.'); return; }

  /* Quick buttons: data-q1="Label|Message", up to three; click-to-chat only. */
  var quick = [];
  for (var q = 1; q <= 3 && !byLink; q++) {
    var raw = d['q' + q] || '', bar = raw.indexOf('|'), label = (bar < 0 ? raw : raw.slice(0, bar)).trim();
    if (label) quick.push({ l: label, u: chat(bar < 0 ? '' : raw.slice(bar + 1).trim()) });
  }

  /* Accent colour; the text on it is white or near-black, whichever reads better. */
  var accent = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(d.color || '') ? d.color : '#5B5BF0';
  if (accent.length === 4) accent = '#' + accent[1] + accent[1] + accent[2] + accent[2] + accent[3] + accent[3];
  var lum = [1, 3, 5].map(function (i) { var c = parseInt(accent.substr(i, 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  var on = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2] > 0.5 ? '#0b1020' : '#fff';

  /* Font: a short allow-list. Web fonts are fetched from Google Fonts only when one is chosen. */
  var WEB = { 'Inter': 1, 'Poppins': 1, 'DM Sans': 1, 'Manrope': 1, 'Nunito': 1, 'Roboto': 1, 'Playfair Display': 1 };
  var font = WEB[d.font] || d.font === 'Georgia' ? d.font : '';
  if (WEB[font] && document.head && !document.getElementById('cf-wa-font-' + font.replace(/ /g, '-'))) {
    var lk = document.createElement('link');
    lk.id = 'cf-wa-font-' + font.replace(/ /g, '-'); lk.rel = 'stylesheet';
    lk.href = 'https://fonts.googleapis.com/css2?family=' + font.replace(/ /g, '+') + ':wght@400;500;600;700&display=swap';
    document.head.appendChild(lk);
  }

  var dark = d.theme === 'dark', side = d.position === 'left' ? 'left' : 'right', preview = d.preview === '1';
  var name = d.name || 'Chat with us';
  var openAfter = Math.max(0, parseInt(d.openAfter, 10) || 0);

  var host = document.createElement('div');
  host.id = 'chatflow-wa-widget';
  host.style.cssText = 'all:initial!important;position:fixed!important;bottom:0!important;' + side + ':0!important;z-index:2147482000!important;width:0!important;height:0!important';
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

  var css =
    ':host{all:initial}*{box-sizing:border-box;margin:0}' +
    '.ui{--a:' + accent + ';--on:' + on + ';--bg:' + (dark ? '#14181f' : '#fff') + ';--fg:' + (dark ? '#eceef2' : '#111827') + ';--mut:' + (dark ? '#8f98a8' : '#6b7280') + ';' +
      '--line:' + (dark ? 'rgba(255,255,255,.1)' : 'rgba(17,24,39,.09)') + ';--soft:' + (dark ? 'rgba(255,255,255,.06)' : '#f4f5f7') + ';' +
      'font:14px/1.4 ' + (font && font !== 'Georgia' ? '"' + font + '",' : font ? 'Georgia,"Times New Roman",serif,' : '') + 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased;color:var(--fg)}' +
    '.wrap{position:fixed;bottom:calc(20px + env(safe-area-inset-bottom,0px));' + side + ':calc(20px + env(safe-area-inset-' + side + ',0px));display:flex;flex-direction:column;align-items:flex-' + (side === 'left' ? 'start' : 'end') + ';gap:10px}' +
    '.launch{display:flex;align-items:center;gap:10px;flex-direction:row' + (side === 'left' ? '' : '-reverse') + '}' +
    '.fab{position:relative;width:54px;height:54px;border-radius:50%;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;background:var(--a);color:var(--on);box-shadow:0 6px 18px rgba(17,24,39,.22),0 1px 3px rgba(17,24,39,.2);transition:transform .2s cubic-bezier(.2,.9,.3,1.3)}' +
    '.fab:hover{transform:scale(1.06)}.fab:active{transform:scale(.95)}.fab svg{width:26px;height:26px;fill:currentColor}' +
    '.fab::after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid var(--a);opacity:0;animation:ring 2.6s ease-out 1s 2}' +
    '@keyframes ring{0%{opacity:.5;transform:scale(1)}100%{opacity:0;transform:scale(1.5)}}' +
    ':focus-visible{outline:2px solid var(--a);outline-offset:2px}' +
    '.tag{display:flex;align-items:center;gap:7px;background:var(--bg);font-size:13px;font-weight:600;padding:8px 12px;border-radius:999px;box-shadow:0 4px 14px rgba(17,24,39,.18),0 0 0 1px var(--line);white-space:nowrap}' +
    '.dot{width:7px;height:7px;border-radius:50%;background:#22c55e;flex-shrink:0}' +
    '.card{width:min(300px,calc(100vw - 24px));max-height:calc(100vh - 100px);max-height:calc(100dvh - 100px);overflow-y:auto;scrollbar-width:none;border-radius:18px;background:var(--bg);' +
      'box-shadow:0 18px 44px -12px rgba(17,24,39,.35),0 0 0 1px var(--line);transform-origin:bottom ' + side + ';animation:pop .2s cubic-bezier(.2,.9,.3,1.1)}' +
    '.card::-webkit-scrollbar{display:none}' +
    '@keyframes pop{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}' +
    '.head{display:flex;align-items:center;gap:10px;padding:14px 10px 0 18px}' +
    '.av{width:30px;height:30px;border-radius:50%;background:var(--a);color:var(--on);font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
    '.who{flex:1;min-width:0}.nm{font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.st{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--mut);margin-top:1px}' +
    '.x{border:0;background:transparent;width:26px;height:26px;border-radius:8px;color:var(--mut);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}.x:hover{background:var(--soft);color:var(--fg)}' +
    '.x svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2.2;stroke-linecap:round}' +
    '.msg{margin:12px 18px 0;padding:8px 11px;background:var(--soft);border-radius:4px 12px 12px 12px;font-size:13px;line-height:1.4;white-space:pre-wrap;word-break:break-word}' +
    '.body{padding:12px 18px 10px}' +
    '.go{display:flex;align-items:center;justify-content:center;gap:8px;height:38px;border-radius:11px;background:var(--a);color:var(--on);text-decoration:none;font-weight:600;font-size:13.5px;transition:filter .15s,transform .15s}' +
    '.go:hover{filter:brightness(1.07)}.go:active{transform:scale(.985)}.go svg{width:17px;height:17px;fill:currentColor;flex-shrink:0}' +
    '.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}' +
    '.chip{display:inline-flex;align-items:center;max-width:100%;height:28px;padding:0 11px;border-radius:999px;font-size:12.5px;font-weight:500;color:var(--fg);text-decoration:none;box-shadow:inset 0 0 0 1px var(--line);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:background .15s,box-shadow .15s}' +
    '.chip:hover{background:var(--soft);box-shadow:inset 0 0 0 1px var(--a)}' +
    '.qr{display:flex;align-items:center;gap:12px;margin-top:12px;padding:10px;border-radius:12px;background:var(--soft)}' +
    '.tile{width:76px;height:76px;border-radius:7px;background:#fff;padding:3px;flex-shrink:0}.tile svg{display:block;width:100%;height:100%}' +
    '.qr strong{display:block;font-size:12.5px;font-weight:600}.qr p{font-size:11.5px;line-height:1.4;color:var(--mut);margin-top:2px}' +
    '.pw{margin-top:8px;text-align:right;font-size:10.5px;color:var(--mut);opacity:.85}.pw b{font-weight:600}' +
    '.hide{display:none!important}' +
    '.ph .card{width:calc(100vw - 16px)}.ph .wrap{' + side + ':8px;bottom:calc(8px + env(safe-area-inset-bottom,0px))}.ph .qr{display:none}.ph .body{padding-bottom:calc(10px + env(safe-area-inset-bottom,0px))}.ph .wrap.open .launch{display:none}' +
    (d.mobile === 'false' ? '.ph .wrap{display:none}' : '') +
    '@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}';

  var NS = 'http://www.w3.org/2000/svg';
  var WA = 'M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.31a8.188 8.188 0 0 1-1.26-4.38c.01-4.54 3.7-8.24 8.25-8.24zM8.53 7.33c-.16 0-.43.06-.66.31-.22.25-.87.86-.87 2.07 0 1.22.89 2.39 1 2.56.14.17 1.76 2.67 4.25 3.73.59.27 1.05.42 1.41.53.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.27-.25-.14-1.47-.74-1.69-.82-.23-.09-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.53.07-.26-.13-1.06-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.12-.25-.01-.39.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14 0-.3-.01-.47-.01z';
  function svg(path, fill, vb) {
    var s = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path');
    s.setAttribute('viewBox', vb || '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    p.setAttribute('d', path); if (fill) p.setAttribute('fill', fill);
    s.appendChild(p); return s;
  }
  function el(tag, cls, text, kids) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    (kids || []).forEach(function (k) { n.appendChild(k); });
    return n;
  }
  function a(cls, href, text, kids) { var n = el('a', cls, text, kids); n.href = href; n.target = '_blank'; n.rel = 'noopener noreferrer'; return n; }

  /* QR: drawn right in the card, on computers only (the phone layout hides it) */
  var code = d.qr === 'false' ? null : qrEncode(link), qr = null;
  if (code) {
    var N = code.size, path = '';
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      if (!code.modules[y][x]) continue;
      var run = 1;
      while (x + run < N && code.modules[y][x + run]) run++;
      path += 'M' + (x + 2) + ',' + (y + 2) + 'h' + run + 'v1h-' + run + 'z';
      x += run;
    }
    var qs = svg(path, '#0b1020', '0 0 ' + (N + 4) + ' ' + (N + 4));
    qs.setAttribute('role', 'img'); qs.setAttribute('aria-label', 'QR code that opens this chat in WhatsApp'); qs.setAttribute('shape-rendering', 'crispEdges');
    qr = el('div', 'qr', '', [el('div', 'tile', '', [qs]), el('div', '', '', [el('strong', '', 'Scan to chat on your phone'), el('p', '', 'Point your camera at the code to open WhatsApp.')])]);
  }

  var close = el('button', 'x', '', [svg('M6 6l12 12M18 6L6 18')]);
  close.type = 'button'; close.setAttribute('aria-label', 'Close');
  var go = a('go', link, d.cta || 'Start chat on WhatsApp', []); go.insertBefore(svg(WA, ''), go.firstChild);
  var card = el('div', 'card hide', '', [
    el('div', 'head', '', [
      el('div', 'av', (name.trim().charAt(0) || 'C').toUpperCase()),
      el('div', 'who', '', [el('div', 'nm', name), el('div', 'st', '', [el('span', 'dot'), document.createTextNode(d.subtitle || 'Typically replies in minutes')])]),
      close
    ]),
    el('div', 'msg', d.welcome || 'Hi 👋 How can we help you today?'),
    el('div', 'body', '', [go].concat(
      quick.length ? [el('div', 'chips', '', quick.map(function (c) { var n = a('chip', c.u, c.l); n.title = c.l; return n; }))] : [],
      qr ? [qr] : [],
      d.branding === 'false' ? [] : [el('div', 'pw', 'Powered by ', [el('b', '', 'ChatFlow')])]
    ))
  ]);
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', name);

  var fab = el('button', 'fab', '', [svg(WA)]);
  fab.type = 'button'; fab.setAttribute('aria-label', 'Chat on WhatsApp'); fab.setAttribute('aria-expanded', 'false');
  var tag = d.label ? el('div', 'tag', '', [el('span', 'dot'), document.createTextNode(d.label)]) : null;
  var wrap = el('div', 'wrap', '', [card, el('div', 'launch', '', tag ? [fab, tag] : [fab])]);
  var ui = el('div', 'ui', '', [wrap]);
  root.appendChild(el('style', '', css));
  root.appendChild(ui);

  /* phone layout = a narrow window (in the Settings preview: the chosen device) */
  var mq = window.matchMedia && window.matchMedia('(max-width:640px)');
  function phoneMode() { ui.classList.toggle('ph', preview ? d.device === 'mobile' : !!(mq && mq.matches)); }
  phoneMode();
  if (mq && mq.addEventListener) mq.addEventListener('change', phoneMode);

  var isOpen = false;
  function setOpen(v, focus) {
    isOpen = v;
    card.classList.toggle('hide', !v); wrap.classList.toggle('open', v);
    if (tag) tag.classList.toggle('hide', v);
    fab.setAttribute('aria-expanded', v ? 'true' : 'false');
    if (v && focus) go.focus();
  }
  fab.onclick = function () { setOpen(!isOpen, true); };
  close.onclick = function () { setOpen(false); fab.focus(); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) { setOpen(false); fab.focus(); } });

  if (preview) setOpen(true);
  else if (openAfter) {
    var seen = false;
    try { seen = sessionStorage.getItem('chatflow_wa_opened') === '1'; } catch (e) { /* storage blocked: may reopen on each page */ }
    if (!seen) setTimeout(function () { if (!isOpen) setOpen(true); try { sessionStorage.setItem('chatflow_wa_opened', '1'); } catch (e) { /* ignore */ } }, openAfter * 1000);
  }

  function mount() { if (document.body) document.body.appendChild(host); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();

  window.__chatflowWaWidget = {
    open: function () { setOpen(true); },
    close: function () { setOpen(false); },
    destroy: function () { if (host.parentNode) host.parentNode.removeChild(host); window.__chatflowWaWidget = null; }
  };
})();
