#!/usr/bin/env node
/* Verification suite. Run after `node tools/build.js`.
   Checks internal links, heading order, placeholders, alt text, and data integrity. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let errors = 0, warnings = 0;
const err = (m) => { console.log('  FAIL  ' + m); errors++; };
const warn = (m) => { console.log('  WARN  ' + m); warnings++; };

function walk(dir, out) {
  out = out || [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    // content/ holds body partials, not documents; tools/ is the generator itself
    if (['.git', 'node_modules', 'content', 'tools'].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
console.log('HTML files: ' + files.length + '\n');

/* ---------------------------------------------------- internal links */
console.log('Internal links');
let linkCount = 0;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const dir = path.dirname(f);
  const re = /(?:href|src)="([^"#][^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:|data:|\/\/)/.test(href)) continue;
    const clean = href.split('#')[0].split('?')[0];
    if (!clean) continue;
    linkCount++;
    const target = path.resolve(dir, clean);
    if (!fs.existsSync(target)) {
      err(path.relative(ROOT, f) + ' -> ' + href);
    }
  }
}
if (!errors) console.log('  OK    ' + linkCount + ' internal links all resolve');

/* ------------------------------------------------- absolute-path links */
console.log('\nRoot-relative links (break under file://)');
let abs = 0;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const re = /(?:href|src)="\/(?!\/)([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) { abs++; err(path.relative(ROOT, f) + ' uses root-relative "/' + m[1] + '"'); }
}
if (!abs) console.log('  OK    no root-relative links; site opens from the filesystem');

/* ------------------------------------------------------- placeholders */
console.log('\nUnresolved placeholders and verification markers');
const BAD = [/\{\{[a-zA-Z]/, /\[confirm[^\]]*\]/i, /\[update[^\]]*\]/i, /\[add [^\]]*\]/i,
  /\[under review\]/i, /\[no online record/i, /lorem ipsum/i, /TODO/, /FIXME/];
let ph = 0;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  for (const re of BAD) {
    const m = html.match(re);
    if (m) { err(path.relative(ROOT, f) + ' contains "' + m[0] + '"'); ph++; }
  }
}
if (!ph) console.log('  OK    no placeholders or verification markers in output');

/* ------------------------------------------------------ heading order */
console.log('\nHeading structure');
let hIssues = 0;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  const rel = path.relative(ROOT, f);
  if (h1 === 0) { err(rel + ' has no <h1>'); hIssues++; }
  else if (h1 > 1) { err(rel + ' has ' + h1 + ' <h1> elements'); hIssues++; }

  const levels = (html.match(/<h([1-6])[\s>]/g) || []).map((x) => Number(x.match(/[1-6]/)[0]));
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) {
      warn(rel + ' heading jumps h' + levels[i - 1] + ' -> h' + levels[i]);
      hIssues++;
      break;
    }
  }
}
if (!hIssues) console.log('  OK    every page has exactly one h1 and no skipped levels');

/* ------------------------------------------------------------- images */
console.log('\nImage alt attributes');
let imgIssues = 0;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const imgs = html.match(/<img[^>]*>/g) || [];
  for (const tag of imgs) {
    if (!/\salt=/.test(tag)) { err(path.relative(ROOT, f) + ' <img> without alt'); imgIssues++; }
  }
}
if (!imgIssues) console.log('  OK    every <img> carries an alt attribute');

/* --------------------------------------------------------- lang/title */
console.log('\nDocument basics');
let basics = 0;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const rel = path.relative(ROOT, f);
  if (!/<html lang="en"/.test(html)) { err(rel + ' missing lang'); basics++; }
  if (!/<title>[^<]{5,}<\/title>/.test(html)) { err(rel + ' missing or short <title>'); basics++; }
  if (!/name="viewport"/.test(html)) { err(rel + ' missing viewport'); basics++; }
}
if (!basics) console.log('  OK    lang, title and viewport present on every page');

/* -------------------------------------------------------- data checks */
console.log('\nData integrity');
const D = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data', f + '.json'), 'utf8'));
const pubs = D('publications');
let dataIssues = 0;
for (const p of pubs) {
  if (!fs.existsSync(path.join(ROOT, 'publications', p.slug, 'index.html'))) { err('no page for ' + p.slug); dataIssues++; }
  if (p.doi && !/^10\.\d{4,9}\//.test(p.doi)) { err('malformed DOI on ' + p.slug + ': ' + p.doi); dataIssues++; }
}
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
for (const p of pubs) {
  if (sitemap.indexOf('/publications/' + p.slug + '/') === -1) { err(p.slug + ' missing from sitemap'); dataIssues++; }
}
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/search-index.json'), 'utf8'));
for (const p of pubs) {
  if (!idx.some((i) => i.url === '/publications/' + p.slug + '/')) { err(p.slug + ' missing from search index'); dataIssues++; }
}
if (!dataIssues) console.log('  OK    all ' + pubs.length + ' publications have a page, a sitemap entry and a search entry');

/* --------------------------------------------------------- no CDN deps */
console.log('\nThird-party dependencies');
const cdnRe = /https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|code\.jquery\.com)/;
let cdn = 0;
for (const f of files) {
  if (cdnRe.test(fs.readFileSync(f, 'utf8'))) { err(path.relative(ROOT, f) + ' still loads a CDN script/stylesheet'); cdn++; }
}
if (!cdn) console.log('  OK    no CDN script or stylesheet dependencies remain');

console.log('\n' + (errors ? 'FAILED: ' + errors + ' error(s), ' + warnings + ' warning(s)' :
  'PASSED' + (warnings ? ' with ' + warnings + ' warning(s)' : '')));
process.exit(errors ? 1 : 0);
