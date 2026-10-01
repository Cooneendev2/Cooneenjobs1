/* Shared presentation components: badges, facts, timing lines, QR tile, vacancy card,
   feature slide (hero + carousel), header, status line, paging controls and empty/error panels.
   Components only build DOM from data they are given; they never fetch anything. */

import { el, svgEl, icon, clear } from './dom.js';
import { shortLocation } from './vacancies.js';
import { encodeQR, qrToPath } from './qr.js';

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */
export function closingText(item, ctx) {
  const t = ctx.i18n.t;
  if (!isFinite(item.job.closingMs)) return '';
  if (item.closingSoon) {
    if (item.closeDays <= 0) return t('closesToday');
    if (item.closeDays === 1) return t('closesTomorrow');
    return t('closesInDays', { n: item.closeDays });
  }
  return t('closesOn', { date: ctx.i18n.date(item.job.closingMs) });
}

export function postedText(item, ctx) {
  const t = ctx.i18n.t;
  const d = item.postedDays;
  if (!isFinite(d)) return '';
  if (d <= 0) return t('postedToday');
  if (d === 1) return t('postedYesterday');
  if (d <= 30) return t('postedDaysAgo', { n: d });
  return t('postedOn', { date: ctx.i18n.date(item.job.postedMs) });
}

/* ------------------------------------------------------------------ */
/* Badges (icon + word, so meaning never depends on colour alone)      */
/* ------------------------------------------------------------------ */
const BADGES = {
  closing: { icon: 'clock', key: 'badgeClosing' },
  featured: { icon: 'star', key: 'badgeFeatured' },
  new: { icon: 'bolt', key: 'badgeNew' }
};

/* compact: icon only (the word stays for screen readers and as a tooltip) for tight rows, where a legend
   elsewhere on the panel spells the meanings out. */
export function createBadges(item, ctx, opts) {
  if (!item.badges.length) return null;
  const compact = !!(opts && opts.compact);
  const list = el('ul', 'badges' + (compact ? ' badges-compact' : ''));
  item.badges.forEach((kind) => {
    const word = ctx.i18n.t(BADGES[kind].key);
    const li = el('li', 'badge badge-' + kind + (compact ? ' badge-compact' : ''));
    li.appendChild(icon(BADGES[kind].icon));
    li.appendChild(el('span', compact ? 'sr-only' : null, word));
    if (compact) li.title = word;
    list.appendChild(li);
  });
  return list;
}

/* ------------------------------------------------------------------ */
/* Facts: location, department, type                                  */
/* ------------------------------------------------------------------ */
export function createFacts(item, ctx) {
  const cfg = ctx.cfg;
  const job = item.job;
  const rows = [];
  if (cfg.showLocation && job.location) rows.push(['pin', 'labelLocation', shortLocation(job.location, cfg.fullLocation), 'loc']);
  if (cfg.showDepartment && job.department) rows.push(['team', 'labelDepartment', job.department, 'dept']);
  if (cfg.showType) {
    const type = [job.employmentType, job.workPattern].filter(Boolean).join(', ');
    if (type) rows.push(['tag', 'labelType', type, 'type']);
    if (job.remote) rows.push(['home', 'remote', ctx.i18n.t('remote'), 'remote']);
  }
  if (!rows.length) return null;
  const list = el('ul', 'facts');
  rows.forEach((row) => {
    const li = el('li', 'fact fact-' + row[3]);
    li.appendChild(icon(row[0]));
    li.appendChild(el('span', 'sr-only', ctx.i18n.t(row[1]) + ': '));
    li.appendChild(el('span', 'fact-text', row[2]));
    list.appendChild(li);
  });
  return list;
}

/* ------------------------------------------------------------------ */
/* Closing / posted lines                                              */
/* ------------------------------------------------------------------ */
export function createTiming(item, ctx) {
  const wrap = el('div', 'timing');
  const closing = closingText(item, ctx);
  if (closing) {
    const p = el('p', 'timing-close' + (item.closingSoon ? ' is-soon' : ''));
    p.appendChild(icon(item.closingSoon ? 'clock' : 'calendar'));
    p.appendChild(el('span', null, closing));
    wrap.appendChild(p);
  }
  if (ctx.cfg.showPostedDate) {
    const posted = postedText(item, ctx);
    if (posted) wrap.appendChild(el('p', 'timing-posted', posted));
  }
  return wrap.firstChild ? wrap : null;
}

/* ------------------------------------------------------------------ */
/* QR code                                                             */
/* ------------------------------------------------------------------ */
const QR_MIN_DEVICE_PX_PER_MODULE = 2.4;
const qrCache = new Map();

export function qrFor(url) {
  if (qrCache.has(url)) return qrCache.get(url);
  let value = null;
  try {
    const qr = encodeQR(url, { ecl: 'M' });
    const path = qrToPath(qr, 4);
    value = { size: path.size, d: path.d, modules: qr.size };
  } catch (e) { value = null; }
  if (qrCache.size > 200) qrCache.clear();
  qrCache.set(url, value);
  return value;
}

/* cssPx = how big the code will be drawn; skip it if modules would be too small to scan reliably. */
export function createQr(item, ctx, cssPx) {
  const url = item.job.url;
  if (!url) return null;
  const q = qrFor(url);
  if (!q) return null;
  if (cssPx && (cssPx * (ctx.stage.info.dpr || 1)) / q.size < QR_MIN_DEVICE_PX_PER_MODULE) {
    ctx.notes.qrHidden = (ctx.notes.qrHidden || 0) + 1;
    return null;
  }
  const figure = el('figure', 'qr');
  const box = el('div', 'qr-code');
  const svg = svgEl('svg', {
    viewBox: '0 0 ' + q.size + ' ' + q.size, role: 'img', class: 'qr-svg', 'shape-rendering': 'crispEdges',
    'aria-label': ctx.i18n.t('scanToApply') + ': ' + item.job.title
  });
  svg.appendChild(svgEl('rect', { width: q.size, height: q.size, fill: '#ffffff' }));
  svg.appendChild(svgEl('path', { d: q.d, fill: '#000000' }));
  box.appendChild(svg);
  figure.appendChild(box);
  figure.appendChild(el('figcaption', null, ctx.i18n.t('scanToApply')));
  return figure;
}

/* ------------------------------------------------------------------ */
/* Vacancy card (wall)                                                 */
/* ------------------------------------------------------------------ */
export function createCard(item, ctx, opts) {
  const cfg = ctx.cfg;
  const job = item.job;
  const linked = ctx.links && job.url;
  const node = linked ? el('a', 'card') : el('article', 'card');
  if (linked) {
    node.href = job.url;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
  }
  item.badges.forEach((kind) => node.classList.add('is-' + kind));
  if (item.featured) node.classList.add('is-featured');

  const main = el('div', 'card-main');
  const top = el('div', 'card-top');
  const badges = createBadges(item, ctx);
  if (badges) top.appendChild(badges);
  main.appendChild(top);

  main.appendChild(el('h3', 'card-title', job.title));
  if (cfg.showSummary && job.summary) main.appendChild(el('p', 'card-summary', job.summary));
  const facts = createFacts(item, ctx);
  if (facts) main.appendChild(facts);

  const foot = el('div', 'card-foot');
  const timing = createTiming(item, ctx);
  if (timing) foot.appendChild(timing);
  if (cfg.showRef && job.reference) foot.appendChild(el('p', 'card-ref', ctx.i18n.t('ref', { ref: job.reference })));
  if (foot.firstChild) main.appendChild(foot);
  node.appendChild(main);

  /* QR "stub" down the right-hand side, set off by a dashed perforation. */
  if (cfg.qr && opts && opts.qrPx) {
    const qr = createQr(item, ctx, opts.qrPx);
    if (qr) {
      const side = el('div', 'card-side');
      side.appendChild(qr);
      node.appendChild(side);
      node.classList.add('has-qr');
    }
  }
  return node;
}

/* Make every card's content fit its card. Needs the cards to be in the document.
   1. A title too long for its three lines is shrunk on its own card only (an unusually long title should
      not make the whole board small).
   2. If any card is still taller than it should be, the text on ALL cards of the page shrinks by the same
      factor, so the cards stay consistent with each other.
   3. If even the smallest text does not fit, the QR stubs are dropped (text matters more) and step 2 repeats. */
export function fitCards(nodes) {
  const cut = (title) => title.scrollHeight > title.clientHeight * 1.08 + 1;       /* title cut short by its line limit */
  nodes.forEach((node) => {
    node.style.removeProperty('--ct');
    const title = node.querySelector('.card-title');
    let factor = 1;
    let guard = 0;
    while (title && guard < 12 && factor > 0.6 && cut(title)) {
      factor *= 0.94;
      node.style.setProperty('--ct', factor.toFixed(3));
      guard += 1;
    }
  });
  /* "Too tall" means the content runs past the bottom of the card's content area, i.e. into its padding where the dashed
     border sits, not just past the card's edge. (An element's scrollHeight does not count overflow that stays inside its own
     padding, so the content blocks are measured, not the card.) */
  const overflows = (box) => !!box && box.scrollHeight > box.clientHeight + 1;
  const tooTall = () => nodes.some((node) => node.scrollHeight > node.clientHeight + 1 ||
    overflows(node.querySelector('.card-main')) || overflows(node.querySelector('.card-side')));
  function shrink() {
    nodes.forEach((node) => node.style.removeProperty('--cf'));
    let factor = 1;
    let guard = 0;
    while (guard < 16 && factor > 0.4 && tooTall()) {
      factor *= 0.94;
      nodes.forEach((node) => node.style.setProperty('--cf', factor.toFixed(3)));
      guard += 1;
    }
    return !tooTall();
  }
  nodes.forEach((node) => node.classList.remove('qr-dropped'));
  if (!shrink() && nodes.some((node) => node.classList.contains('has-qr'))) {
    nodes.forEach((node) => node.classList.add('qr-dropped'));
    shrink();
  }
}

/* ------------------------------------------------------------------ */
/* Feature slide (hero + carousel): one vacancy, as big as the screen  */
/* ------------------------------------------------------------------ */
export function createFeature(item, ctx, variant) {
  const cfg = ctx.cfg;
  const t = ctx.i18n.t;
  const job = item.job;
  const hero = variant === 'hero';
  const linked = ctx.links && job.url;
  const root = el(linked ? 'a' : 'article', 'feature feature-' + variant);
  if (linked) {
    root.href = job.url;
    root.target = '_blank';
    root.rel = 'noopener noreferrer';
  }
  item.badges.forEach((kind) => root.classList.add('is-' + kind));

  /* Hero only: "Now hiring" on the left, who is hiring (and that it is internal) on the right. */
  if (hero) {
    const top = el('div', 'feature-top');
    top.appendChild(el('p', 'feature-kicker', t('nowHiring')));
    const brand = el('p', 'feature-brand');
    brand.appendChild(el('span', 'feature-brand-name', t('brand')));
    brand.appendChild(el('span', 'feature-brand-sub', cfg.title || t('title')));
    top.appendChild(brand);
    root.appendChild(top);
  }

  const main = el('div', 'feature-main');
  const badges = createBadges(item, ctx);
  if (badges) main.appendChild(badges);
  const wrap = el('div', 'feature-titlewrap');
  const title = el('h2', 'feature-title', job.title);
  wrap.appendChild(title);
  main.appendChild(wrap);
  if (cfg.showSummary && job.summary) main.appendChild(el('p', 'feature-summary', job.summary));

  /* The details: under the title on the hero; in a label card beside the title on the carousel. */
  const details = hero ? main : el('aside', 'feature-card');
  const facts = createFacts(item, ctx);
  if (facts) details.appendChild(facts);
  const timing = createTiming(item, ctx);
  if (timing) details.appendChild(timing);
  if (cfg.showRef && job.reference) details.appendChild(el('p', 'feature-ref', t('ref', { ref: job.reference })));
  root.appendChild(main);

  let qr = null;
  let qrMinFactor = 0;
  if (cfg.qr) {
    const px = (hero ? 360 : 240) * ctx.stage.info.s * cfg.fontscale;
    qr = createQr(item, ctx, px);
    if (qr) {
      const q = qrFor(item.job.url);
      qrMinFactor = Math.min(1, (QR_MIN_DEVICE_PX_PER_MODULE * q.size / (ctx.stage.info.dpr || 1)) / px);
    }
  }
  let card = null;
  if (hero) {
    if (qr) {
      const side = el('aside', 'feature-side');
      side.appendChild(qr);
      root.appendChild(side);
    }
  } else {
    if (qr) details.appendChild(qr);
    if (details.firstChild) { root.appendChild(details); card = details; }
  }
  return { root, wrap, title, card, qr, qrMinFactor };
}

/* Make the slide fit its screen however large the text setting is: first the label card (carousel),
   shrinking it, and dropping its QR code only if that would no longer be scannable; then the title. */
export function fitFeature(parts) {
  const root = parts.root;
  root.style.removeProperty('--ft');
  root.style.removeProperty('--fc');
  if (parts.qr) parts.qr.hidden = false;
  if (parts.card) {
    const cs = window.getComputedStyle(root);
    const inner = root.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const portrait = root.closest('.stage') && root.closest('.stage').getAttribute('data-orientation') === 'portrait';
    const limit = portrait ? inner * 0.5 : inner;
    let factor = 1;
    let guard = 0;
    while (guard < 24 && factor > 0.3 && parts.card.offsetHeight > limit + 1) {
      factor *= 0.93;
      root.style.setProperty('--fc', factor.toFixed(3));
      if (parts.qr && !parts.qr.hidden && factor < parts.qrMinFactor) parts.qr.hidden = true;
      guard += 1;
    }
  }
  let factor = 1;
  let guard = 0;
  while (guard < 24 && factor > 0.3 &&
    (parts.title.offsetHeight > parts.wrap.clientHeight + 1 || parts.title.scrollWidth > parts.wrap.clientWidth + 1)) {
    factor *= 0.93;
    root.style.setProperty('--ft', factor.toFixed(3));
    guard += 1;
  }
}

/* ------------------------------------------------------------------ */
/* Heading band                                                        */
/* ------------------------------------------------------------------ */
export function createHeader(ctx) {
  const cfg = ctx.cfg;
  const t = ctx.i18n.t;
  const root = el('header', 'hdr');
  const left = el('div', 'hdr-left');

  const brand = el('div', 'hdr-brand');
  const logo = el('img', 'hdr-logo');
  logo.alt = '';
  logo.hidden = true;
  const brandName = el('span', 'hdr-brandname', t('brand'));
  /* Optional: drop a logo.png next to index.html and it replaces the text wordmark. */
  logo.addEventListener('load', () => { if (logo.naturalWidth > 0) { logo.hidden = false; brandName.hidden = true; } });
  logo.src = 'logo.png';
  brand.appendChild(logo);
  brand.appendChild(brandName);
  left.appendChild(brand);
  left.appendChild(el('span', 'hdr-rule'));

  const titleBox = el('div', 'hdr-title');
  titleBox.appendChild(el('h1', null, cfg.title || t('title')));
  if (!cfg.title) titleBox.appendChild(el('p', 'hdr-tag', t('tagline')));
  left.appendChild(titleBox);
  root.appendChild(left);

  const right = el('div', 'hdr-right');
  const count = el('p', 'hdr-count');
  count.hidden = true;
  right.appendChild(count);
  const clock = el('p', 'hdr-clock');
  clock.hidden = !cfg.clock;
  right.appendChild(clock);
  root.appendChild(right);

  /* The clock shows hours and minutes, so it is redrawn exactly when the minute changes (not up to 30 s late). */
  let clockTimer = 0;
  function drawClock(now) { clock.textContent = ctx.i18n.time(now === undefined ? Date.now() : now); }
  function armClock() {
    window.clearTimeout(clockTimer);
    clockTimer = window.setTimeout(() => { drawClock(); armClock(); }, 60000 - (Date.now() % 60000) + 100);
  }
  if (cfg.clock) { drawClock(); armClock(); }

  return {
    el: root,
    update(view) {
      if (view.status === 'ok') {
        count.hidden = false;
        count.textContent = t('count', { n: view.items.length });
      } else {
        count.hidden = true;
      }
      this.tick(view.now);
    },
    tick(now) { if (cfg.clock) drawClock(now); },
    destroy() { window.clearTimeout(clockTimer); }
  };
}

/* ------------------------------------------------------------------ */
/* Data-health line                                                    */
/* ------------------------------------------------------------------ */
export function createStatus(ctx, options) {
  const warnOnly = !!(options && options.warnOnly);
  const node = el('p', 'status');
  node.hidden = true;
  return {
    el: node,
    update(view) {
      const t = ctx.i18n.t;
      const h = view.health;
      let text = '';
      let warn = false;
      if (h === 'offline' || h === 'saved' || h === 'stale') {
        text = t('statusOffline', { time: ctx.i18n.time(view.dataTimeMs) });
        warn = true;
      } else if (h === 'old') {
        text = t('statusOld', { date: ctx.i18n.dateTime(view.dataTimeMs) });
        warn = true;
      } else if (h === 'fresh' && !ctx.cfg.kiosk && !warnOnly) {
        text = t('statusUpdated', { time: ctx.i18n.time(view.dataTimeMs) });
      }
      clear(node);
      node.className = 'status' + (warn ? ' is-warn' : '');
      node.hidden = !text;
      if (text) {
        if (warn) node.appendChild(icon('alert'));
        node.appendChild(el('span', null, text));
      }
    }
  };
}

/* ------------------------------------------------------------------ */
/* Paging controls (only shown when someone might be at the screen)    */
/* ------------------------------------------------------------------ */
export function createControls(ctx, handlers) {
  const t = ctx.i18n.t;
  const bar = el('div', 'controls');
  function button(name, iconName, labelKey, onClick) {
    const b = el('button', 'ctl ctl-' + name);
    b.type = 'button';
    b.setAttribute('aria-label', t(labelKey));
    b.title = t(labelKey);
    b.appendChild(icon(iconName));
    b.addEventListener('click', onClick);
    bar.appendChild(b);
    return b;
  }
  const prev = button('prev', 'prev', 'prev', handlers.prev);
  const toggle = button('toggle', 'pause', 'pause', handlers.toggle);
  const next = button('next', 'next', 'next', handlers.next);
  if (document.documentElement.requestFullscreen) {
    button('full', 'expand', 'fullscreen', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    });
  }
  return {
    el: bar,
    setPaused(paused) {
      clear(toggle);
      toggle.appendChild(icon(paused ? 'play' : 'pause'));
      toggle.setAttribute('aria-label', t(paused ? 'play' : 'pause'));
      toggle.title = t(paused ? 'play' : 'pause');
    },
    buttons: { prev, toggle, next }
  };
}

/* ------------------------------------------------------------------ */
/* Loading / error / nothing-to-show panels                            */
/* ------------------------------------------------------------------ */
export function createStatePanel(kind, ctx) {
  const t = ctx.i18n.t;
  const panel = el('div', 'state state-' + kind);
  if (kind === 'failed') panel.appendChild(icon('alert'));
  else if (kind === 'empty') panel.appendChild(icon('team'));
  const key = kind === 'failed' ? 'error' : kind === 'empty' ? 'empty' : 'loading';
  panel.appendChild(el('h2', null, t(key + 'Title')));
  if (kind !== 'loading') panel.appendChild(el('p', null, t(key + 'Body')));
  return panel;
}

/* Paging segments: one per page/slide, the current one fills over the rotation time. */
export function buildPager(host, count, index, rotationSeconds) {
  clear(host);
  host.hidden = count <= 1;
  if (count <= 1) return;
  host.style.setProperty('--rot', rotationSeconds + 's');
  for (let i = 0; i < count; i += 1) {
    const seg = el('i', i < index ? 'is-done' : (i === index ? 'is-active' : ''));
    seg.appendChild(el('b'));
    host.appendChild(seg);
  }
}
