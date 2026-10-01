/* Hero: promotes a single vacancy. "Now hiring", very large title, and (by default) a QR code.
   Which vacancy: ?job= (a named one), otherwise featured, otherwise the newest (see ?hero=). */

import { el, clear } from '../dom.js';
import { pickHero } from '../vacancies.js';
import { createHeader, createStatus, createFeature, fitFeature, createStatePanel } from '../components.js';

export function mount(ctx) {
  const { app, cfg } = ctx;
  const root = el('div', 'mode mode-hero');
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

  /* Only speaks up when something is wrong. */
  const foot = el('footer', 'foot foot-quiet');
  const status = createStatus(ctx, { warnOnly: true });
  foot.appendChild(status.el);
  root.appendChild(foot);

  let view = null;
  let current = null;
  let picked = null;

  function draw() {
    clear(slideHost);
    current = createFeature(picked.item, ctx, 'hero');
    slideHost.appendChild(current.root);
    fitFeature(current);
  }

  return {
    update(v) {
      view = v;
      if (header) header.update(v);
      status.update(v);
      if (v.status !== 'ok') {
        clear(slideHost); clear(stateHost);
        current = null; picked = null;
        slideHost.hidden = true;
        stateHost.hidden = false;
        stateHost.appendChild(createStatePanel(v.status, ctx));
        return;
      }
      clear(stateHost);
      stateHost.hidden = true;
      slideHost.hidden = false;
      picked = pickHero(v.items, cfg);
      draw();
    },
    resize() { if (picked && picked.item) draw(); },
    refit() { if (current) fitFeature(current); },
    tick(now) { if (header) header.tick(now); },
    hold() { /* nothing rotates */ },
    info() { return { mode: 'hero', chosen: picked && picked.item ? picked.item.job.title : null, reason: picked ? picked.reason : null }; },
    destroy() { if (header) header.destroy(); root.remove(); }
  };
}
