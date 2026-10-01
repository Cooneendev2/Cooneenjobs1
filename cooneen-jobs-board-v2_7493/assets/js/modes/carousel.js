/* Carousel: one vacancy at a time, full screen, rotating on its own with a gentle cross-fade. */

import { el, clear } from '../dom.js';
import {
  createHeader, createStatus, createControls, createFeature, fitFeature, createStatePanel, buildPager
} from '../components.js';
import { createRotator } from '../rotator.js';

export function mount(ctx) {
  const { app, cfg } = ctx;
  const root = el('div', 'mode mode-carousel');
  app.appendChild(root);

  const header = cfg.header ? createHeader(ctx) : null;
  if (header) root.appendChild(header.el);

  const area = el('main', 'slide-area');
  const slideHost = el('div', 'slide-host');
  const stateHost = el('div', 'state-host');
  stateHost.hidden = true;
  area.appendChild(slideHost);
  area.appendChild(stateHost);
  root.appendChild(area);

  const foot = el('footer', 'foot');
  const pager = el('div', 'pager');
  const counter = el('p', 'counter');
  const status = createStatus(ctx);
  foot.appendChild(pager);
  foot.appendChild(counter);
  foot.appendChild(status.el);
  root.appendChild(foot);

  let view = null;
  let items = [];
  let index = 0;
  let current = null;
  let paused = false;
  let controls = null;
  const timers = new Set();

  function later(fn, ms) {
    const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  }
  const rotator = createRotator(() => go(1, false));

  if (cfg.controls) {
    controls = createControls(ctx, { prev: () => go(-1, true), next: () => go(1, true), toggle: () => togglePause() });
    foot.appendChild(controls.el);
  }

  function showState(kind) {
    rotator.stop();
    items = [];
    current = null;
    clear(slideHost);
    clear(stateHost);
    pager.hidden = true;
    counter.hidden = true;
    slideHost.hidden = true;
    stateHost.hidden = false;
    stateHost.appendChild(createStatePanel(kind, ctx));
  }

  function build(i) {
    if (!items[i]) return;            /* the data may have changed during the fade */
    clear(slideHost);
    buildPager(pager, items.length, i, cfg.rotation);
    counter.hidden = items.length <= 1;
    counter.textContent = ctx.i18n.t('slideOf', { n: i + 1, total: items.length });
    current = createFeature(items[i], ctx, 'carousel');
    slideHost.appendChild(current.root);
    fitFeature(current);
  }

  function render(i, animate) {
    if (!items[i]) return;
    if (animate && !ctx.reducedMotion) {
      slideHost.classList.add('is-out');
      later(() => { build(i); slideHost.classList.remove('is-out'); }, 380);
    } else {
      slideHost.classList.remove('is-out');
      build(i);
    }
  }

  function go(delta, manual) {
    if (items.length < 2) return;
    index = (index + delta + items.length) % items.length;
    render(index, true);
    if (manual) {
      rotator.restart();
      ctx.announce(items[index].job.title);
    }
  }

  function togglePause() {
    paused = !paused;
    if (paused) rotator.hold('user'); else rotator.release('user');
    ctx.setPaused(paused);
    if (controls) controls.setPaused(paused);
  }

  return {
    update(v) {
      view = v;
      if (header) header.update(v);
      status.update(v);
      if (v.status !== 'ok') { showState(v.status); return; }
      /* Stay on the same vacancy if it is still there. */
      const currentId = items[index] ? items[index].id : null;
      items = v.items;
      const found = currentId ? items.findIndex((it) => it.id === currentId) : -1;
      index = found >= 0 ? found : 0;
      clear(stateHost);
      stateHost.hidden = true;
      slideHost.hidden = false;
      render(index, false);
      if (items.length > 1) rotator.start(cfg.rotationMs); else rotator.stop();
    },
    resize() { if (view && view.status === 'ok') render(index, false); },
    refit() { if (current) fitFeature(current); },
    tick(now) { if (header) header.tick(now); },
    next() { go(1, true); },
    prev() { go(-1, true); },
    togglePause,
    hold(reason, on) { if (on) rotator.hold(reason); else rotator.release(reason); },
    info() { return { mode: 'carousel', slides: items.length, index }; },
    destroy() {
      if (header) header.destroy();
      rotator.destroy();
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
      root.remove();
    }
  };
}
