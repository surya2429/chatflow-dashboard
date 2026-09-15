/*!
 * ChatFlow widget loader
 *
 * <script src="https://cdn.chatflow.io/v2/widget.js?id=YOUR_WIDGET_ID" async></script>
 *
 * The contract this file exists to keep: installing the widget must be
 * invisible to the host page's own CSS and layout. That means
 *
 *   - exactly ONE element is added to the page (a <div> on <body>) and nothing
 *     at all is added to <head>; no stylesheet, no font, no reset. A widget
 *     that injects Tailwind's preflight or a Google font into a customer's
 *     document is how "your chat plugin broke our buttons" happens.
 *   - that element carries a shadow root, so the host page's selectors cannot
 *     match anything we render;
 *   - the widget UI itself lives in an iframe inside that shadow root, because
 *     shadow DOM is not actually enough on its own: inherited properties
 *     (font-family, color, line-height, letter-spacing, direction, visibility)
 *     cross a shadow boundary, and rules targeting the host element still
 *     apply to it. A separate document has a separate cascade — nothing
 *     crosses in either direction.
 *   - every layout-critical property on the host element is set inline with
 *     !important. Inline !important outranks any author stylesheet, including
 *     a site's own `div { position: static !important }` or an over-eager
 *     `* { transform: none !important }`.
 *   - the iframe is only ever as big as what the visitor can actually see. A
 *     closed widget is a 92px box in one corner, not a full-height invisible
 *     panel sitting on top of the site's cookie banner or "back to top"
 *     button.
 *
 * It deliberately reads no cookies, writes no globals beyond one guard flag,
 * and never touches document.body's styles.
 */
(function () {
  'use strict';

  /* ── Find our own <script> and the widget id inside its src ───────────── */

  // document.currentScript is set for async classic scripts; the querySelector
  // fallback covers a snippet that was inlined or re-executed by a tag manager.
  var self = document.currentScript || (function () {
    var all = document.querySelectorAll('script[src*="widget.js"]');
    return all[all.length - 1] || null;
  })();
  if (!self || !self.src) return;

  var src, widgetId, origin;
  try {
    src = new URL(self.src, window.location.href);
    widgetId = src.searchParams.get('id') || self.getAttribute('data-id') || '';
    origin = src.origin;
  } catch (e) { return; }
  if (!widgetId) {
    // Nothing to load, and guessing would be worse than doing nothing.
    if (window.console) console.warn('[ChatFlow] widget.js was loaded without ?id= — nothing to render.');
    return;
  }

  // A tag manager firing the same snippet twice must not produce two widgets.
  if (window.__chatflowWidget) return;

  /* ── Config, all optional, all from the script tag ────────────────────── */

  var position = (src.searchParams.get('position') || self.getAttribute('data-position') || 'bottom-right');
  var sideGap  = toPx(src.searchParams.get('offset-x') || self.getAttribute('data-offset-x'), 20);
  var edgeGap  = toPx(src.searchParams.get('offset-y') || self.getAttribute('data-offset-y'), 20);
  // Just under the 32-bit max, so a site's own modal or cookie banner can
  // still deliberately sit above the widget by using a higher value.
  var zIndex   = src.searchParams.get('z') || '2147483000';

  var isRight  = position.indexOf('right') !== -1;
  var isBottom = position.indexOf('top') === -1;

  var CLOSED = { w: 92, h: 92 };
  var box = { w: CLOSED.w, h: CLOSED.h };
  var isOpen = false;

  /* ── The single node we add to the customer's page ────────────────────── */

  var host = document.createElement('div');
  host.id = 'chatflow-widget';
  host.setAttribute('aria-live', 'polite');

  // Inline + !important: unreachable by any author stylesheet on the page.
  //
  // The list is long on purpose. It is not enough to pin position and size:
  // a rule naming `#chatflow-widget` or a blanket `div {}` can still rotate,
  // fade, blur or hide the widget, and anything NOT declared here is a
  // property the host page is free to win. Every entry below corresponds to a
  // way public/embed-test.html can break the widget if it is left out.
  important(host, {
    position: 'fixed',
    // `auto` on the unused axis rather than a competing value, so the box is
    // anchored by exactly one horizontal and one vertical edge.
    top:    isBottom ? 'auto' : edgeGap + 'px',
    bottom: isBottom ? edgeGap + 'px' : 'auto',
    left:   isRight ? 'auto' : sideGap + 'px',
    right:  isRight ? sideGap + 'px' : 'auto',
    width:  box.w + 'px',
    height: box.h + 'px',
    // A page-set min/max would override the width/height above.
    'min-width': '0', 'min-height': '0',
    'max-width': 'none', 'max-height': 'none',
    margin: '0',
    padding: '0',
    border: '0',
    'border-radius': '0',
    // Harmless while padding and border are 0, but it stops a site-wide
    // `content-box !important` from silently changing what width/height mean
    // here if this box ever gains either.
    'box-sizing': 'border-box',
    // The corner rounding and drop shadow are drawn inside the iframe; a
    // background here would show through the transparent parts of it.
    background: 'transparent',
    'box-shadow': 'none',
    outline: 'none',
    float: 'none',
    display: 'block',
    visibility: 'visible',
    opacity: '1',
    transform: 'none',
    rotate: 'none', scale: 'none', translate: 'none',
    filter: 'none',
    'backdrop-filter': 'none',
    'clip-path': 'none',
    'mix-blend-mode': 'normal',
    perspective: 'none',
    zoom: '1',
    'z-index': zIndex,
    // The host box is exactly the iframe; nothing else should be hit-testable.
    'pointer-events': 'auto',
    // Never contribute to the page's scrollable area.
    overflow: 'hidden',
    // Immune to a site-wide `* { transition: all .3s }` / `animation: …`.
    transition: 'none',
    animation: 'none',
    'color-scheme': 'normal'
  });

  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

  // Scoped to the shadow root — this stylesheet is not in the customer's
  // document and cannot be reached by their selectors.
  if (host.attachShadow) {
    var style = document.createElement('style');
    style.textContent =
      /* `all: initial` drops every property the host page would otherwise pass
         down by inheritance (font, color, line-height, direction, visibility). */
      ':host{all:initial;display:block;width:100%;height:100%}' +
      'iframe{display:block;width:100%;height:100%;border:0;margin:0;padding:0;' +
      'background:transparent;color-scheme:normal}';
    root.appendChild(style);
  }

  var frame = document.createElement('iframe');
  frame.title = 'Chat widget';
  frame.setAttribute('allow', 'microphone; camera; autoplay; clipboard-write');
  // Transparent so the customer's page shows through the corners the widget
  // rounds off, instead of a white rectangle.
  frame.setAttribute('allowtransparency', 'true');
  frame.src = origin + '/webchat-embed?id=' + encodeURIComponent(widgetId);
  // Belt and braces: the shadow root already puts this iframe out of reach of
  // the page's `iframe {}` rules, but a browser without attachShadow falls
  // back to appending straight into the host element, where they would apply.
  important(frame, {
    width: '100%', height: '100%', border: '0', margin: '0', padding: '0',
    'border-radius': '0', background: 'transparent', 'color-scheme': 'normal',
    display: 'block', opacity: '1', visibility: 'visible', transform: 'none',
    filter: 'none', 'clip-path': 'none', 'box-shadow': 'none', outline: 'none',
    'max-width': 'none', 'max-height': 'none', 'min-width': '0', 'min-height': '0',
    transition: 'none', animation: 'none', zoom: '1'
  });
  root.appendChild(frame);

  /* ── Resize on the embed's say-so ─────────────────────────────────────── */

  function applyBox() {
    // Clamped so an open panel can never be taller or wider than the viewport
    // it is sitting in — the widget must not force the page to scroll, and on
    // a phone it has to fit rather than hang off the edge.
    var maxW = 'calc(100vw - ' + (sideGap * 2) + 'px)';
    var maxH = 'calc(100vh - ' + (edgeGap * 2) + 'px)';
    important(host, {
      width:  'min(' + box.w + 'px, ' + maxW + ')',
      height: 'min(' + box.h + 'px, ' + maxH + ')'
    });
  }
  applyBox();

  window.addEventListener('message', function (e) {
    // Only this iframe, only our namespace. Anything else on the page posting
    // messages is none of our business.
    if (!e.data || e.data.__chatflow !== 'chatflow-widget') return;
    if (e.source !== frame.contentWindow) return;
    if (e.data.type === 'state') {
      isOpen = !!e.data.open;
      box = { w: e.data.w || CLOSED.w, h: e.data.h || CLOSED.h };
      applyBox();
    }
  });

  /* ── Mount ────────────────────────────────────────────────────────────── */

  function mount() {
    if (!document.body) return;
    document.body.appendChild(host);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }

  /* ── The public handle ────────────────────────────────────────────────── */

  var api = {
    open:   function () { send({ type: 'open' }); },
    close:  function () { send({ type: 'close' }); },
    toggle: function () { send({ type: isOpen ? 'close' : 'open' }); },
    isOpen: function () { return isOpen; },
    destroy: function () {
      if (host.parentNode) host.parentNode.removeChild(host);
      window.__chatflowWidget = null;
    }
  };
  function send(msg) {
    try {
      msg.__chatflow = 'chatflow-widget';
      frame.contentWindow && frame.contentWindow.postMessage(msg, origin);
    } catch (e) { /* frame not ready yet */ }
  }

  window.__chatflowWidget = api;
  // Replay anything the page queued against the stub before this file loaded.
  var queued = window.ChatFlow && window.ChatFlow.q;
  window.ChatFlow = function (method) {
    var fn = api[method];
    if (typeof fn === 'function') return fn.apply(null, [].slice.call(arguments, 1));
  };
  window.ChatFlow.q = [];
  if (queued && queued.length) {
    for (var i = 0; i < queued.length; i++) {
      try { window.ChatFlow.apply(null, queued[i]); } catch (e) {}
    }
  }

  /* ── helpers ──────────────────────────────────────────────────────────── */

  function important(el, props) {
    for (var k in props) {
      if (Object.prototype.hasOwnProperty.call(props, k)) {
        el.style.setProperty(k, props[k], 'important');
      }
    }
  }
  function toPx(v, fallback) {
    var n = parseInt(v, 10);
    return isNaN(n) || n < 0 ? fallback : n;
  }
})();
