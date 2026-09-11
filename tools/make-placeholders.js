#!/usr/bin/env node
/* Generates on-brand local placeholder images, one per slot in images.json.
   These ship with the repo so every page renders correctly offline and with no
   third-party requests. Replace any of them by saving a real photograph at the
   same path with a .jpg extension — build.js prefers a real photo over the .svg. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const images = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/images.json'), 'utf8'));
const OUT = path.join(ROOT, 'assets/img');
fs.mkdirSync(OUT, { recursive: true });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A head-and-shoulders silhouette, for the portrait slot only.
function silhouette(w, h) {
  const cx = w / 2, cy = h * 0.40, r = Math.min(w, h) * 0.15;
  return `<g fill="#24455F">
    <circle cx="${cx}" cy="${cy}" r="${r}"/>
    <path d="M ${cx - r * 2.1} ${h * 0.98}
             a ${r * 2.1} ${r * 2.4} 0 0 1 ${r * 4.2} 0 Z"/>
  </g>`;
}

function svg(slot) {
  const { width: w, height: h, id } = slot;
  const unit = Math.max(w, h) / 16;
  const label = id.replace(/-/g, ' ').toUpperCase();
  const fs1 = Math.round(Math.min(w, h) * 0.055);
  const fs2 = Math.round(Math.min(w, h) * 0.038);
  const isPortrait = id === 'about-portrait';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)} placeholder">
  <defs>
    <pattern id="g" width="${unit}" height="${unit}" patternUnits="userSpaceOnUse">
      <path d="M ${unit} 0 L 0 0 0 ${unit}" fill="none" stroke="#FFFFFF" stroke-opacity="0.10" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="#10293D"/>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  ${isPortrait ? silhouette(w, h) : ''}
  <path d="M 0 ${h - 1.5} L ${w} ${h - 1.5}" stroke="#E46F2E" stroke-width="3"/>
  <path d="M ${unit} ${unit} L ${unit * 2.6} ${unit}" stroke="#E46F2E" stroke-width="3"/>
  <text x="${unit}" y="${unit * 2.1}" fill="#FFFFFF" font-family="Inter,Segoe UI,Arial,sans-serif"
        font-size="${fs1}" font-weight="700" letter-spacing="1">${esc(label)}</text>
  <text x="${unit}" y="${unit * 3.1}" fill="#A9BBC7" font-family="Inter,Segoe UI,Arial,sans-serif"
        font-size="${fs2}">${w} &#215; ${h} &#183; replace with a photograph</text>
</svg>
`;
}

let n = 0;
for (const slot of images.slots) {
  fs.writeFileSync(path.join(OUT, slot.id + '.svg'), svg(slot));
  n++;
}
console.log('wrote ' + n + ' placeholder images to assets/img/');
