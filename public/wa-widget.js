/*!
 * ChatFlow "Chat on WhatsApp" website widget
 *
 * <script src="https://cdn.chatflow.io/v2/wa-widget.js" async
 *   data-phone="919876543210" data-message="Hi, I have a question"></script>
 *
 * A floating WhatsApp button. Click it and a small card opens with a greeting and a "Start chat" button that takes
 * the visitor to WhatsApp (app on a phone, WhatsApp Web / desktop app on a computer) with the message already typed.
 * It is a plain link, so nothing about the visitor is sent to us.
 *
 * Options (data-* on the script tag; the dashboard's Settings → Widget & QR Codes builds this tag for you):
 *   data-phone       business number, digits with country code, no "+"        (needed unless data-link is set)
 *   data-message     message typed in for the visitor
 *   data-link        a ready-made link instead, e.g. https://wa.me/message/CODE (a Message link from Settings)
 *   data-name        business name in the card header                          default "Chat with us"
 *   data-subtitle    line under the name                                        default "Typically replies in minutes"
 *   data-welcome     greeting bubble                                            default "Hi 👋 How can we help you?"
 *   data-cta         button text                                                default "Start chat on WhatsApp"
 *   data-label       small bubble beside the closed button (optional)
 *   data-color       brand colour, #rgb or #rrggbb                              default #25D366
 *   data-position    "right" | "left"                                           default "right"
 *   data-open-after  seconds before the card opens by itself, once per visit; 0 = never    default 0
 *   data-mobile      "false" to hide the widget on phones                       default "true"
 *
 * Like the chat widget loader it adds exactly one element to the page and nothing to <head>; the UI lives in a
 * shadow root so the host page's CSS cannot reach it. All text is set with textContent (no HTML from options).
 */
(function () {
  'use strict';

  var self = document.currentScript || (function () {
    var all = document.querySelectorAll('script[src*="wa-widget.js"]');
    return all[all.length - 1] || null;
  })();
  if (!self) return;
  if (window.__chatflowWaWidget) return;       // a tag manager firing the snippet twice must not make two buttons

  var d = self.dataset || {};
  var phone = String(d.phone || '').replace(/\D/g, '');
  var message = d.message || '';

  /* Where the button goes: a Message link if given (https only, on a WhatsApp host), else click-to-chat. */
  var link = '';
  if (d.link) {
    try {
      var u = new URL(d.link);
      if (u.protocol === 'https:' && (u.hostname === 'wa.me' || u.hostname === 'api.whatsapp.com')) link = u.href;
    } catch (e) { /* ignore: falls through to phone */ }
  }
  if (!link && phone.length >= 8 && phone.length <= 15) {
    link = 'https://wa.me/' + phone + (message ? '?text=' + encodeURIComponent(message) : '');
  }
  if (!link) {
    if (window.console) console.warn('[ChatFlow] wa-widget.js needs data-phone (digits with country code) or a wa.me data-link.');
    return;
  }

  var color = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(d.color || '') ? d.color : '#25D366';
  var left = d.position === 'left';
  var openAfter = Math.max(0, parseInt(d.openAfter, 10) || 0);
  var name = d.name || 'Chat with us';
  var subtitle = d.subtitle || 'Typically replies in minutes';
  var welcome = d.welcome || 'Hi 👋 How can we help you?';
  var cta = d.cta || 'Start chat on WhatsApp';
  var label = d.label || '';
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
    '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}' +
    '.wrap{position:fixed;bottom:calc(20px + env(safe-area-inset-bottom,0px));' + side + ':calc(20px + env(safe-area-inset-' + side + ',0px));display:flex;flex-direction:column;align-items:' + (left ? 'flex-start' : 'flex-end') + ';gap:12px}' +
    '.launch{display:flex;align-items:center;gap:10px;flex-direction:' + (left ? 'row' : 'row-reverse') + '}' +
    '.fab{width:58px;height:58px;border-radius:50%;border:0;background:' + color + ';color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.25);transition:transform .18s}' +
    '.fab:hover{transform:scale(1.06)}.fab:focus-visible,.cta:focus-visible,.x:focus-visible{outline:3px solid #fff;outline-offset:-5px;box-shadow:0 0 0 3px ' + color + '}' +
    '.fab svg{width:30px;height:30px;fill:currentColor}' +
    '.tag{background:#fff;color:#1f2937;font-size:13px;font-weight:600;padding:8px 12px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.18);white-space:nowrap}' +
    '.card{width:min(340px,calc(100vw - 32px));background:#fff;border-radius:16px;box-shadow:0 18px 48px rgba(0,0,0,.28);overflow:hidden;transform-origin:' + (left ? 'bottom left' : 'bottom right') + ';animation:pop .2s ease-out}' +
    '@keyframes pop{from{opacity:0;transform:scale(.92) translateY(8px)}to{opacity:1;transform:none}}' +
    '.head{display:flex;align-items:center;gap:10px;padding:14px 14px 14px 16px;background:' + color + ';color:#fff}' +
    '.av{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
    '.av svg{width:22px;height:22px;fill:#fff}' +
    '.who{flex:1;min-width:0}.nm{font-size:15px;font-weight:700;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.sub{font-size:12px;opacity:.9;margin-top:2px}' +
    '.x{border:0;background:transparent;color:#fff;font-size:22px;line-height:1;width:32px;height:32px;border-radius:8px;cursor:pointer;opacity:.9}.x:hover{background:rgba(255,255,255,.2)}' +
    '.body{padding:16px;background:#efeae2}' +
    '.bub{display:inline-block;max-width:88%;background:#fff;color:#111827;font-size:14px;line-height:1.45;padding:10px 12px;border-radius:0 12px 12px 12px;box-shadow:0 1px 1px rgba(0,0,0,.1);white-space:pre-wrap;word-break:break-word}' +
    '.foot{padding:12px 16px 16px;background:#fff}' +
    '.cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px 14px;border-radius:999px;background:' + color + ';color:#fff;font-size:14px;font-weight:700;text-decoration:none}' +
    '.cta:hover{filter:brightness(.95)}.cta svg{width:18px;height:18px;fill:currentColor}' +
    '.hide{display:none}' +
    '@media (prefers-reduced-motion:reduce){.card{animation:none}.fab{transition:none}}' +
    (d.mobile === 'false' ? '@media (max-width:640px){.wrap{display:none}}' : '');

  // The WhatsApp glyph (24×24).
  var GLYPH = 'M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.31a8.188 8.188 0 0 1-1.26-4.38c.01-4.54 3.7-8.24 8.25-8.24zM8.53 7.33c-.16 0-.43.06-.66.31-.22.25-.87.86-.87 2.07 0 1.22.89 2.39 1 2.56.14.17 1.76 2.67 4.25 3.73.59.27 1.05.42 1.41.53.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.27-.25-.14-1.47-.74-1.69-.82-.23-.09-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.53.07-.26-.13-1.06-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.12-.25-.01-.39.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14 0-.3-.01-.47-.01z';
  var NS = 'http://www.w3.org/2000/svg';
  function icon() {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', GLYPH);
    s.appendChild(p);
    return s;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  var style = document.createElement('style');
  style.textContent = css;
  root.appendChild(style);

  var wrap = el('div', 'wrap');

  /* the card */
  var card = el('div', 'card hide');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', name);
  var head = el('div', 'head');
  var av = el('div', 'av'); av.appendChild(icon());
  var who = el('div', 'who'); who.appendChild(el('div', 'nm', name)); who.appendChild(el('div', 'sub', subtitle));
  var x = el('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
  head.appendChild(av); head.appendChild(who); head.appendChild(x);
  var body = el('div', 'body'); body.appendChild(el('div', 'bub', welcome));
  var foot = el('div', 'foot');
  var a = el('a', 'cta'); a.href = link; a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.appendChild(icon()); a.appendChild(document.createTextNode(cta));
  foot.appendChild(a);
  card.appendChild(head); card.appendChild(body); card.appendChild(foot);

  /* the closed button (+ optional label) */
  var launch = el('div', 'launch');
  var fab = el('button', 'fab'); fab.type = 'button';
  fab.setAttribute('aria-label', 'Chat on WhatsApp'); fab.setAttribute('aria-expanded', 'false');
  fab.appendChild(icon());
  launch.appendChild(fab);
  var tag = label ? el('div', 'tag', label) : null;
  if (tag) launch.appendChild(tag);

  wrap.appendChild(card); wrap.appendChild(launch);
  root.appendChild(wrap);

  var isOpen = false;
  function setOpen(v, focus) {
    isOpen = v;
    card.classList.toggle('hide', !v);
    if (tag) tag.classList.toggle('hide', v);
    fab.setAttribute('aria-expanded', v ? 'true' : 'false');
    if (v && focus) a.focus();
  }
  fab.addEventListener('click', function () { setOpen(!isOpen, true); });
  x.addEventListener('click', function () { setOpen(false); fab.focus(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) { setOpen(false); fab.focus(); } });

  if (openAfter > 0) {
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
