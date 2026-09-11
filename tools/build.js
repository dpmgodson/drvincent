#!/usr/bin/env node
/**
 * Static site generator for vincentsamjebadurai.com
 *
 * Zero dependencies. Node >= 18.
 *   node tools/build.js
 *
 * Data in assets/data/*.json is the single source of truth.
 * Prose bodies live in content/<route>.html.
 * Every emitted link is RELATIVE and ends in index.html so the built site
 * can be opened directly from the filesystem (file://) without a server.
 */

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const D = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data', f + '.json'), 'utf8'));

const site = D('site');
const pages = D('pages');
const publications = D('publications');
const patents = D('patents');
const projects = D('projects');
const research = D('research');
const articles = D('articles');
const talks = D('talks');
const credentials = D('credentials');
const images = D('images');

const written = [];
let SEARCH_ITEMS = [];

/* ------------------------------------------------------------------ utils */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// strip tags for meta/plain contexts
const plain = (s) => String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const depthOf = (route) => (route === '' ? 0 : route.split('/').length);

/** Relative URL from one route to another, file:// safe. */
function url(from, to) {
  const up = '../'.repeat(depthOf(from));
  if (to === '') return up + 'index.html' === 'index.html' ? 'index.html' : up + 'index.html';
  return up + to + '/index.html';
}
/** Relative URL from a route to a repo-root-relative asset path. */
function asset(from, p) {
  return '../'.repeat(depthOf(from)) + p;
}
/** Absolute canonical URL for a route. */
function canonical(route) {
  return site.domain + '/' + (route === '' ? '' : route + '/');
}

function writeFile(rel, html) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, html);
  written.push(rel);
}

/* ------------------------------------------------------------------ icons */
/* Inline SVG sprite replaces the Font Awesome CDN stylesheet. */
const ICONS = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  external: '<path d="M14 5h5v5"/><path d="M19 5l-8 8"/><path d="M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  phone: '<path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
  pin: '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  doc: '<path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z"/><path d="M14 3v4h4"/>',
  award: '<circle cx="12" cy="9" r="5"/><path d="M8.5 13L7 21l5-2.5L17 21l-1.5-8"/>',
  cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M8 3v14"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3.2 3.2 0 0 1 0 6M17 20a6 6 0 0 0-2.5-4.9"/>',
  grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>'
};

function icon(name, cls) {
  const body = ICONS[name];
  if (!body) throw new Error('Unknown icon: ' + name);
  return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + '</svg>';
}

function spriteStyleNote() { return ''; }

/* ------------------------------------------------------------------ images */

const imgBySlot = Object.fromEntries(images.slots.map((s) => [s.id, s]));

/** Resolve an image slot to a src usable from `route`. Local file wins if present. */
function imgSrc(route, slotId) {
  const s = imgBySlot[slotId];
  if (!s) throw new Error('Unknown image slot: ' + slotId);
  const localRel = 'assets/img/' + s.id + '.jpg';
  if (fs.existsSync(path.join(ROOT, localRel))) return asset(route, localRel);
  return 'https://images.unsplash.com/' + s.remote + '?auto=format&fit=crop&w=' + s.width + '&q=80';
}
/** Absolute src for OG tags (must not be relative). */
function imgAbs(slotId) {
  const s = imgBySlot[slotId];
  const localRel = 'assets/img/' + s.id + '.jpg';
  if (fs.existsSync(path.join(ROOT, localRel))) return site.domain + '/' + localRel;
  return 'https://images.unsplash.com/' + s.remote + '?auto=format&fit=crop&w=' + s.width + '&q=80';
}

/** A framed figure that uses a slot. */
function figure(route, slotId, caption) {
  const s = imgBySlot[slotId];
  const alt = s.decorative ? '' : esc(s.alt);
  return '<figure class="frame">' +
    '<img src="' + esc(imgSrc(route, slotId)) + '" alt="' + alt + '" width="' + s.width + '" height="' + s.height + '" loading="lazy" decoding="async">' +
    (caption ? '<figcaption>' + esc(caption) + '</figcaption>' : '') +
    '</figure>';
}

/* ------------------------------------------------------------------ shell */

function headTag(page, opts) {
  opts = opts || {};
  const route = page.route;
  const title = page.title;
  const desc = plain(page.description);
  const ogImg = opts.ogImage || imgAbs('social-card');
  const ld = opts.jsonld || defaultJsonLd(page);

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>' + esc(title) + '</title>',
    '<meta name="description" content="' + esc(desc) + '">',
    '<meta name="author" content="' + esc(site.person.name) + '">',
    '<link rel="canonical" href="' + esc(canonical(route)) + '">',
    '<meta property="og:type" content="' + (route === '' ? 'website' : 'article') + '">',
    '<meta property="og:site_name" content="' + esc(site.person.name) + '">',
    '<meta property="og:title" content="' + esc(title) + '">',
    '<meta property="og:description" content="' + esc(desc) + '">',
    '<meta property="og:url" content="' + esc(canonical(route)) + '">',
    '<meta property="og:image" content="' + esc(ogImg) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + esc(title) + '">',
    '<meta name="twitter:description" content="' + esc(desc) + '">',
    '<meta name="twitter:image" content="' + esc(ogImg) + '">',
    '<meta name="theme-color" content="#10293D">',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap" rel="stylesheet">',
    '<link rel="stylesheet" href="' + asset(route, 'assets/css/site.css') + '">',
    '<link rel="manifest" href="' + asset(route, 'site.webmanifest') + '">',
    '<script type="application/ld+json">' + JSON.stringify(ld) + '</script>',
    '</head>'
  ].join('\n');
}

function personLd() {
  return {
    '@type': 'Person',
    name: site.person.name,
    alternateName: site.person.formalName,
    url: site.domain + '/',
    email: 'mailto:' + site.person.email,
    jobTitle: site.person.positions,
    worksFor: { '@type': 'CollegeOrUniversity', name: site.person.institution, url: site.person.institutionUrl },
    address: { '@type': 'PostalAddress', addressLocality: 'Coimbatore', addressRegion: 'Tamil Nadu', addressCountry: 'IN' },
    identifier: site.profiles.filter((p) => p.id).map((p) => ({ '@type': 'PropertyValue', propertyID: p.label, value: p.id })),
    sameAs: site.profiles.map((p) => p.url).concat((site.institutionLinks || []).map((l) => l.url)),
    knowsAbout: research.map((r) => r.name)
  };
}

function breadcrumbLd(route, label) {
  const items = [{ '@type': 'ListItem', position: 1, name: 'Home', item: site.domain + '/' }];
  if (route) items.push({ '@type': 'ListItem', position: 2, name: label, item: canonical(route) });
  return { '@type': 'BreadcrumbList', itemListElement: items };
}

function defaultJsonLd(page) {
  const graph = [];
  if (page.route === '') {
    graph.push(Object.assign({ '@id': site.domain + '/#person' }, personLd()));
    graph.push({
      '@type': 'WebSite', '@id': site.domain + '/#website', url: site.domain + '/',
      name: site.person.name, description: plain(page.description),
      inLanguage: 'en', about: { '@id': site.domain + '/#person' },
      publisher: { '@id': site.domain + '/#person' }
    });
  } else {
    graph.push({
      '@type': page.type || 'WebPage', url: canonical(page.route), name: page.title,
      description: plain(page.description), inLanguage: 'en',
      isPartOf: { '@type': 'WebSite', url: site.domain + '/', name: site.person.name },
      about: Object.assign({ '@id': site.domain + '/#person' }, personLd())
    });
    graph.push(breadcrumbLd(page.route, plain(page.eyebrow || page.title)));
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

function header(route) {
  const navLinks = site.nav.map((n) => {
    const active = n.route === route;
    return '<a class="nav-link' + (active ? ' active' : '') + '" href="' + url(route, n.route) + '"' +
      (active ? ' aria-current="page"' : '') + '>' + esc(n.label) + '</a>';
  }).join('');

  return [
    '<a class="skip-link" href="#main">Skip to main content</a>',
    '<header class="site-header">',
    '<div class="container nav-wrap">',
    '<a class="brand" href="' + url(route, '') + '">',
    '<span class="brand-mark" aria-hidden="true">' + buildMark() + '</span>',
    '<span class="brand-text"><strong>' + esc(site.person.name) + '</strong>',
    '<small>Build &middot; Inspire &middot; Serve</small></span></a>',
    '<button class="menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="primary-nav">' + icon('menu') + '</button>',
    '<nav class="nav" id="primary-nav" aria-label="Primary">' + navLinks +
    '<a class="nav-link nav-search" href="' + url(route, 'search') + '" aria-label="Search">' + icon('search') + '<span class="nav-search-text">Search</span></a>' +
    '</nav>',
    '</div>',
    '</header>'
  ].join('\n');
}

/* Small structural mark: a load path over a foundation line. */
function buildMark() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="mark">' +
    '<path d="M4 20h16" /><path d="M12 4v16" /><path d="M12 4L5.5 20M12 4l6.5 16" /><circle cx="12" cy="4" r="1.6" />' +
    '</svg>';
}

function footer(route) {
  const cols = site.footer.map((g) =>
    '<div class="footer-col"><h2>' + esc(g.heading) + '</h2>' +
    g.links.map((l) => '<a href="' + url(route, l.route) + '">' + esc(l.label) + '</a>').join('') +
    '</div>').join('');

  const profiles = site.profiles.map((p) =>
    '<a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.label) + icon('external', 'ic-xs') + '</a>').join('');

  const legal = site.legal.map((l) => '<a href="' + url(route, l.route) + '">' + esc(l.label) + '</a>').join(' <span aria-hidden="true">&middot;</span> ');

  return [
    '<footer class="site-footer">',
    '<div class="container footer-grid">',
    '<div class="footer-brand-col">',
    '<div class="footer-brand">' + esc(site.person.name) + '</div>',
    '<p class="footer-tagline">' + esc(site.brand.tagline) + '</p>',
    '<p class="footer-note">' + esc(site.person.positions.join(' &middot; ').replace(/&middot;/g, '·')) + '<br>' + esc(site.person.institution) + ', ' + esc(site.person.location) + '</p>',
    '</div>',
    cols,
    '<div class="footer-col"><h2>Profiles</h2>' + profiles + '</div>',
    '</div>',
    '<div class="container footer-bottom">',
    '<span>&copy; <span data-year>2026</span> ' + esc(site.person.formalName) + '</span>',
    '<span class="footer-legal">' + legal + '</span>',
    '</div>',
    '</footer>',
    '<script src="' + asset(route, 'assets/js/site.js') + '" defer></script>',
    '</body>',
    '</html>'
  ].join('\n');
}

function ctaButtons(route, ctas) {
  if (!ctas || !ctas.length) return '';
  return '<div class="hero-actions">' + ctas.map((c) =>
    '<a class="btn btn-' + c.style + '" href="' + url(route, c.route) + '">' + esc(c.label) + icon('arrow') + '</a>'
  ).join('') + '</div>';
}

function homeHero(page) {
  const r = page.route;
  return [
    '<section class="hero">',
    '<div class="hero-media" aria-hidden="true" style="background-image:url(\'' + imgSrc(r, 'home-hero') + '\')"></div>',
    '<div class="hero-grid" aria-hidden="true"></div>',
    '<div class="container hero-inner">',
    '<p class="eyebrow hero-eyebrow">' + esc(page.eyebrow) + '</p>',
    '<h1>' + page.h1 + '</h1>',
    '<p class="lede">' + esc(page.lede) + '</p>',
    ctaButtons(r, page.ctas),
    '<p class="hero-brand">' + site.brand.essence.map(function (w) { return '<span>' + esc(w) + '</span>'; }).join('<i aria-hidden="true">&bull;</i>') + '</p>',
    '</div>',
    '</section>'
  ].join('\n');
}

function pageHero(page) {
  const r = page.route;
  return [
    '<section class="page-hero">',
    '<div class="container">',
    '<p class="eyebrow">' + esc(page.eyebrow) + '</p>',
    '<h1>' + page.h1 + '</h1>',
    '<p class="lede">' + esc(page.lede) + '</p>',
    ctaButtons(r, page.ctas),
    '</div>',
    '<div class="hero-rule" aria-hidden="true"></div>',
    '</section>'
  ].join('\n');
}

/* ------------------------------------------------------- shared renderers */

const areaByS = Object.fromEntries(research.map((r) => [r.slug, r]));
const areaName = (s) => (areaByS[s] ? areaByS[s].name : s);

function citation(p) {
  const bits = [];
  bits.push(p.authors.join(', '));
  bits.push('(' + p.year + ')');
  bits.push(p.title + '.');
  bits.push(p.journal);
  const loc = [];
  if (p.volume) loc.push(p.volume);
  if (p.issue) loc.push('(' + p.issue + ')');
  let tail = loc.join('');
  if (p.pages) tail += (tail ? ', ' : '') + 'pp. ' + p.pages;
  if (p.articleNumber) tail += (tail ? ', ' : '') + 'Art. ' + p.articleNumber;
  if (tail) bits.push(tail);
  let out = bits.join(', ').replace(/, \(/g, ' (').replace(/\), /g, ') ');
  if (p.doi) out += '. https://doi.org/' + p.doi;
  return out.replace(/\.\./g, '.');
}

function pubMetaLine(p) {
  const parts = [String(p.year), p.journal];
  const loc = [];
  if (p.volume) loc.push('vol. ' + p.volume);
  if (p.issue) loc.push('no. ' + p.issue);
  if (p.pages) loc.push('pp. ' + p.pages);
  if (p.articleNumber) loc.push('art. ' + p.articleNumber);
  if (loc.length) parts.push(loc.join(', '));
  return parts.join(' · ');
}

function pubCard(route, p) {
  return '<article class="pub-card">' +
    '<p class="pub-card-meta">' + esc(p.year) + ' &middot; ' + esc(p.journal) + '</p>' +
    '<h3><a href="' + url(route, 'publications/' + p.slug) + '">' + esc(p.title) + '</a></h3>' +
    '<p class="pub-card-authors">' + esc(p.authors.join(', ')) + '</p>' +
    '<p class="tags">' + p.researchAreas.map((a) => '<span class="tag">' + esc(areaName(a)) + '</span>').join('') + '</p>' +
    '</article>';
}


/* ------------------------------------------------------------ page render */

function renderPage(page) {
  const route = page.route;
  const bodyFile = path.join(ROOT, 'content', (route === '' ? 'home' : route) + '.html');
  let body = fs.existsSync(bodyFile) ? fs.readFileSync(bodyFile, 'utf8') : '';

  body = expand(body, route);

  const isHome = route === '';
  const html = [
    headTag(page),
    '<body' + (isHome ? ' class="is-home"' : '') + '>',
    header(route),
    '<main id="main">',
    isHome ? homeHero(page) : pageHero(page),
    body,
    '</main>',
    footer(route)
  ].join('\n');

  writeFile((route === '' ? 'index.html' : route + '/index.html'), html);
}

/* Token expansion inside content files: {{token}} and {{token:arg}} */
function expand(html, route) {
  return html.replace(/\{\{([a-zA-Z0-9_-]+)(?::([^}]*))?\}\}/g, (m, name, arg) => {
    switch (name) {
      case 'link': { const [r, label] = arg.split('|'); return '<a href="' + url(route, r) + '">' + esc(label) + '</a>'; }
      case 'cta': { const [r, label, style] = arg.split('|'); return '<a class="btn btn-' + (style || 'dark') + '" href="' + url(route, r) + '">' + esc(label) + icon('arrow') + '</a>'; }
      case 'img': { const [slot, cap] = arg.split('|'); return figure(route, slot, cap); }
      case 'icon': return icon(arg);
      case 'email': return site.person.email;
      case 'mailto': { const [subj, label] = arg.split('|'); return '<a href="mailto:' + site.person.email + '?subject=' + encodeURIComponent(subj) + '">' + esc(label || site.person.email) + '</a>'; }
      case 'tagline': return esc(site.brand.tagline);
      case 'institution': return esc(site.person.institution);
      case 'metrics': return metricsBlock();
      case 'pillars': return pillarsBlock(route);
      case 'researchTrajectory': return trajectoryBlock(route);
      case 'researchAreas': return researchAreasBlock(route, arg);
      case 'researchDetail': return researchDetailBlock(route);
      case 'patentList': return patentListBlock(route, arg);
      case 'projectList': return projectListBlock(route);
      case 'talkList': return talkListBlock(route);
      case 'articleList': return articleListBlock(route);
      case 'selectedPublications': return selectedPubsBlock(route, arg);
      case 'publicationExplorer': return publicationExplorerBlock(route);
      case 'education': return educationBlock();
      case 'experience': return experienceBlock();
      case 'supervision': return supervisionBlock();
      case 'editorial': return editorialBlock();
      case 'development': return developmentBlock();
      case 'memberships': return membershipsBlock();
      case 'administration': return administrationBlock();
      case 'asset': return asset(route, arg);
      case 'conferences': return conferencesBlock();
      case 'profileLinks': return profileLinksBlock();
      case 'searchApp': return searchAppBlock(route);
      case 'contactRoutes': return contactRoutesBlock(route);
      default: throw new Error('Unknown token {{' + name + '}} in route "' + route + '"');
    }
  });
}

/* ----------------------------------------------------------- blocks */

function metricsBlock() {
  const m = site.metrics;
  const cells = m.items.map((it) =>
    '<div class="metric">' +
    '<strong>' + esc(it.value) + '</strong>' +
    '<span class="metric-label">' + esc(it.label) + '</span>' +
    (it.note ? '<span class="metric-note">' + esc(it.note) + '</span>' : '') +
    '</div>').join('');
  return '<div class="metric-grid">' + cells + '</div>' +
    '<p class="metric-source">Citation metrics from ' + esc(m.asOf) + '. Indexing figures change over time; the date is stated so the numbers can be read in context.</p>';
}

const PILLARS = [
  { n: '01', key: 'EDUCATE', icon: 'users', head: 'Building minds through knowledge and mentorship.', route: 'academia',
    copy: 'Seventeen years of teaching structural analysis, strength of materials and mechanics of solids; one doctorate completed and three in progress; more than fifteen M.Tech. projects guided. Teaching is the part of the work that compounds.' },
  { n: '02', key: 'INNOVATE', icon: 'cube', head: 'Turning ideas into solutions.', route: 'innovation',
    copy: 'A granted Indian patent for GI netting at RCC beam–column joints, published applications in construction 3D printing, and a funded prototype integrating reinforcement into multi-arm printing.' },
  { n: '03', key: 'LEAD', icon: 'building', head: 'Creating institutions and opportunities that make a difference.', route: 'leadership',
    copy: 'As IQAC Coordinator, contributed to quality-assurance work culminating in NAAC A++ accreditation with a CGPA of 3.53. As Manager – Institution Relations, leads school outreach and academic partnerships.' },
  { n: '04', key: 'SERVE', icon: 'spark', head: 'Using knowledge, leadership and faith to make a difference.', route: 'service',
    copy: 'Committee work, admissions, school engagement and ministry. The parts of a career that rarely appear in a citation count, and which shape it anyway.' }
];

function pillarsBlock(route) {
  return '<div class="pillar-grid">' + PILLARS.map((p) =>
    '<article class="pillar">' +
    '<p class="pillar-n"><span>' + p.n + '</span> &mdash; ' + p.key + '</p>' +
    '<h3>' + esc(p.head) + '</h3>' +
    '<p>' + esc(p.copy) + '</p>' +
    '<a class="card-link" href="' + url(route, p.route) + '">' + esc(pillarCta(p.key)) + icon('arrow') + '</a>' +
    '</article>').join('') + '</div>';
}
function pillarCta(key) {
  return { EDUCATE: 'Explore Academia', INNOVATE: 'Explore Innovation', LEAD: 'Explore Leadership', SERVE: 'Explore Service' }[key];
}

function trajectoryBlock(route) {
  const steps = [
    { years: '2006–2011', head: 'Foundation', copy: 'Civil engineering, then structural engineering. Roof truss configuration as a first research question.' },
    { years: '2011–2018', head: 'Masonry and seismic behaviour', copy: 'Doctoral work on confining masonry infill in RC frames with skin reinforcement — experimental, analytical and numerical.' },
    { years: '2018–2022', head: 'From strengthening to invention', copy: 'Latex-modified mortar, equivalent strut width, composite frames and damping systems; the GI-netting patent granted in 2022.' },
    { years: '2022–present', head: 'Printing, data and automation', copy: 'Printable cementitious materials, print-head and multi-arm systems, scan-to-BIM, and deep learning for crack characterisation.' }
  ];
  return '<ol class="trajectory">' + steps.map((s) =>
    '<li class="trajectory-step"><p class="trajectory-years">' + esc(s.years) + '</p>' +
    '<h3>' + esc(s.head) + '</h3><p>' + esc(s.copy) + '</p></li>').join('') + '</ol>' +
    '<p class="trajectory-foot">' + '<a class="card-link" href="' + url(route, 'research') + '">Explore the Research' + icon('arrow') + '</a></p>';
}

function researchAreasBlock(route, arg) {
  const featuredOnly = arg === 'featured';
  const list = research
    .filter((r) => (featuredOnly ? r.featured : true))
    .sort((a, b) => a.order - b.order);
  return '<div class="area-grid">' + list.map((r) =>
    '<article class="area-card">' +
    '<h3><a href="' + url(route, 'research') + '#' + esc(r.slug) + '">' + esc(r.name) + '</a></h3>' +
    '<p>' + esc(r.plain) + '</p>' +
    '</article>').join('') + '</div>';
}

function researchDetailBlock(route) {
  return research.sort((a, b) => a.order - b.order).map((r) => {
    const pubs = publications.filter((p) => p.researchAreas.includes(r.slug));
    const pats = patents.filter((p) => (r.relatedPatents || []).includes(p.slug));
    const rows = [];
    if (r.problem) rows.push(['What is the problem?', r.problem]);
    if (r.approach) rows.push(['What approach was taken?', r.approach]);
    if (r.contribution) rows.push(['What was contributed?', r.contribution]);
    if (r.next) rows.push(['What comes next?', r.next]);

    return '<section class="area-detail" id="' + esc(r.slug) + '">' +
      '<div class="area-detail-head">' +
      '<h3>' + esc(r.name) + '</h3>' +
      (r.emerging ? '<p class="area-flag">An active interest; the published record sits in the adjacent areas below.</p>' : '') +
      '<p class="area-plain">' + esc(r.plain) + '</p>' +
      (r.technical ? '<p class="area-technical"><span class="area-technical-label">In technical terms</span> ' + esc(r.technical) + '</p>' : '') +
      '</div>' +
      '<dl class="area-qa">' + rows.map(([q, a]) => '<dt>' + esc(q) + '</dt><dd>' + esc(a) + '</dd>').join('') + '</dl>' +
      (pats.length ? '<p class="area-rel"><span class="area-rel-label">Intellectual property</span> ' +
        pats.map((p) => '<a href="' + url(route, 'innovation') + '#' + esc(p.slug) + '">' + esc(p.title) + '</a>').join('; ') + '</p>' : '') +
      (pubs.length ? '<p class="area-rel"><span class="area-rel-label">Publications</span> ' +
        '<a href="' + url(route, 'publications') + '?area=' + esc(r.slug) + '">' + pubs.length + ' paper' + (pubs.length > 1 ? 's' : '') + ' in this area' + '</a></p>' : '') +
      '</section>';
  }).join('');
}

function patentListBlock(route, arg) {
  const list = arg === 'featured' ? patents.filter((p) => p.featured) : patents;
  return list.map((p) => {
    const rows = [];
    if (p.patentNumber) rows.push(['Indian Patent No.', p.patentNumber]);
    if (p.applicationNumber) rows.push(['Application No.', p.applicationNumber]);
    if (p.filingDate) rows.push(['Filed', fmtDate(p.filingDate)]);
    if (p.grantDate) rows.push(['Granted', fmtDate(p.grantDate)]);
    if (p.term) rows.push(['Term', p.term]);
    rows.push(['Status', p.status]);
    rows.push(['Inventors', p.inventors.join(', ')]);
    rows.push(['Institution', p.institution]);
    if (p.trl) rows.push(['Technology readiness', p.trl]);
    if (p.commercialization) rows.push(['Commercialization', p.commercialization]);

    return '<article class="record" id="' + esc(p.slug) + '">' +
      '<div class="record-body">' +
      '<p class="record-kicker">' + esc(p.status) + '</p>' +
      '<h3>' + esc(p.title) + '</h3>' +
      '<p class="record-summary">' + esc(p.summary) + '</p>' +
      (p.detail ? '<p>' + esc(p.detail) + '</p>' : '') +
      '<p class="tags">' + p.researchAreas.map((a) => '<span class="tag">' + esc(areaName(a)) + '</span>').join('') + '</p>' +
      '</div>' +
      '<dl class="record-data">' + rows.map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('') + '</dl>' +
      '</article>';
  }).join('');
}

function fmtDate(d) {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const [y, m, day] = d.split('-');
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return Number(day) + ' ' + months[Number(m) - 1] + ' ' + y;
}

function projectListBlock(route) {
  return projects.map((p) => {
    const rows = [];
    rows.push(['Status', p.status]);
    if (p.sanctionedDate) rows.push(['Sanctioned', p.sanctionedDate]);
    rows.push(['Funding agency', p.fundingAgency]);
    if (p.fundingAmount) rows.push(['Amount', p.fundingAmount]);
    rows.push(['Role', p.role]);
    return '<article class="record" id="' + esc(p.slug) + '">' +
      '<div class="record-body">' +
      '<p class="record-kicker"><span class="status status-' + p.status.toLowerCase().replace(/\s+/g, '-') + '">' + esc(p.status) + '</span></p>' +
      '<h3>' + esc(p.title) + '</h3>' +
      '<p class="record-summary">' + esc(p.description) + '</p>' +
      (p.deliverables.length ? '<p class="record-sub">Deliverables</p><ul class="ticks">' + p.deliverables.map((d) => '<li>' + icon('check') + esc(d) + '</li>').join('') + '</ul>' : '') +
      '<p class="tags">' + p.researchAreas.map((a) => '<span class="tag">' + esc(areaName(a)) + '</span>').join('') + '</p>' +
      (p.relatedPatents.length ? '<p class="area-rel"><span class="area-rel-label">Related IP</span> ' +
        p.relatedPatents.map((s) => { const pt = patents.find((x) => x.slug === s); return '<a href="' + url(route, 'innovation') + '#' + esc(s) + '">' + esc(pt.title) + '</a>'; }).join('; ') + '</p>' : '') +
      '</div>' +
      '<dl class="record-data">' + rows.map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('') + '</dl>' +
      '</article>';
  }).join('');
}

function talkListBlock(route) {
  return '<div class="talk-list">' + talks.map((t) =>
    '<article class="talk">' +
    '<p class="talk-format">' + esc(t.format) + ' &middot; ' + esc(t.displayDate) + '</p>' +
    '<h3>' + esc(t.title) + '</h3>' +
    '<p class="talk-summary">' + esc(t.summary) + '</p>' +
    '<dl class="talk-meta">' +
    '<div><dt>Organised by</dt><dd>' + esc(t.organisers) + '</dd></div>' +
    (t.chair ? '<div><dt>Chaired by</dt><dd>' + esc(t.chair) + '</dd></div>' : '') +
    (t.audience ? '<div><dt>Audience</dt><dd>' + esc(t.audience) + '</dd></div>' : '') +
    '</dl>' +
    '</article>').join('') + '</div>';
}

function articleListBlock(route) {
  return '<div class="article-grid">' + articles.map((a) =>
    '<article class="article-card">' +
    '<h3><a href="' + url(route, 'articles/' + a.slug) + '">' + esc(a.title) + '</a></h3>' +
    '<p>' + esc(a.summary) + '</p>' +
    '<p class="tags">' + a.researchAreas.map((x) => '<span class="tag">' + esc(areaName(x)) + '</span>').join('') + '</p>' +
    '</article>').join('') + '</div>';
}

function selectedPubsBlock(route, arg) {
  const n = Number(arg || 6);
  const list = publications.slice().sort((a, b) => b.year - a.year).slice(0, n);
  return '<div class="pub-grid">' + list.map((p) => pubCard(route, p)).join('') + '</div>' +
    '<p class="block-foot"><a class="card-link" href="' + url(route, 'publications') + '">Browse Publications' + icon('arrow') + '</a></p>';
}

function publicationExplorerBlock(route) {
  const years = [...new Set(publications.map((p) => p.year))].sort((a, b) => b - a);
  const areas = research.filter((r) => publications.some((p) => p.researchAreas.includes(r.slug))).sort((a, b) => a.order - b.order);

  const rows = publications.slice().sort((a, b) => b.year - a.year || a.title.localeCompare(b.title)).map((p) =>
    '<article class="pub-row" data-year="' + p.year + '" data-areas="' + esc(p.researchAreas.join(' ')) + '" data-type="' + esc(p.type) + '" ' +
    'data-text="' + esc((p.title + ' ' + p.authors.join(' ') + ' ' + p.journal).toLowerCase()) + '">' +
    '<p class="pub-row-meta">' + esc(pubMetaLine(p)) + '</p>' +
    '<h3><a href="' + url(route, 'publications/' + p.slug) + '">' + esc(p.title) + '</a></h3>' +
    '<p class="pub-row-authors">' + esc(p.authors.join(', ')) + '</p>' +
    '<p class="pub-row-links">' +
    (p.doi ? '<a href="https://doi.org/' + esc(p.doi) + '" target="_blank" rel="noopener">DOI ' + esc(p.doi) + icon('external', 'ic-xs') + '</a>' : '<span class="muted">No DOI on record</span>') +
    '<a href="' + url(route, 'publications/' + p.slug) + '">Details' + icon('arrow', 'ic-xs') + '</a>' +
    '</p>' +
    '</article>').join('');

  return '<div class="explorer" data-explorer>' +
    '<div class="explorer-controls">' +
    '<div class="field"><label for="pub-q">Search titles, authors and journals</label>' +
    '<input type="search" id="pub-q" data-filter="q" placeholder="e.g. masonry, printing, Hemalatha" autocomplete="off"></div>' +
    '<div class="field"><label for="pub-year">Year</label><select id="pub-year" data-filter="year"><option value="">All years</option>' +
    years.map((y) => '<option value="' + y + '">' + y + '</option>').join('') + '</select></div>' +
    '<div class="field"><label for="pub-area">Research area</label><select id="pub-area" data-filter="area"><option value="">All areas</option>' +
    areas.map((a) => '<option value="' + esc(a.slug) + '">' + esc(a.name) + '</option>').join('') + '</select></div>' +
    '<div class="field"><label for="pub-type">Type</label><select id="pub-type" data-filter="type"><option value="">All types</option>' +
    '<option value="journal">Journal article</option><option value="proceedings">Conference proceedings</option></select></div>' +
    '</div>' +
    '<p class="explorer-count" role="status" data-count>Showing all ' + publications.length + ' publications.</p>' +
    '<div class="pub-rows" data-rows>' + rows + '</div>' +
    '<p class="explorer-empty" data-empty hidden>No publications match these filters. <button type="button" class="linkbtn" data-reset>Clear filters</button></p>' +
    '</div>';
}

function educationBlock() {
  return '<ol class="timeline">' + credentials.education.map((e) =>
    '<li class="timeline-item"><p class="timeline-date">' + esc(e.year) + '</p>' +
    '<h3>' + esc(e.qualification) + '</h3>' +
    '<p class="timeline-org">' + esc(e.institution) + '</p>' +
    (e.detail ? '<p>' + esc(e.detail) + '</p>' : '') + '</li>').join('') + '</ol>';
}

function experienceBlock() {
  return '<ol class="timeline">' + credentials.experience.map((e) =>
    '<li class="timeline-item"><p class="timeline-date">' + esc(e.period) + '</p>' +
    '<h3>' + esc(e.role) + '</h3>' +
    '<p class="timeline-org">' + esc(e.institution) + '</p>' +
    (e.detail ? '<p>' + esc(e.detail) + '</p>' : '') + '</li>').join('') + '</ol>';
}

function supervisionBlock() {
  const s = credentials.supervision;
  return '<div class="supervision">' +
    '<div class="sup-figures">' +
    '<div class="metric"><strong>' + s.phdCompleted.count + '</strong><span class="metric-label">Ph.D. completed</span></div>' +
    '<div class="metric"><strong>' + s.phdOngoing.count + '</strong><span class="metric-label">Ph.D. in progress</span></div>' +
    '<div class="metric"><strong>15+</strong><span class="metric-label">M.Tech. projects guided</span></div>' +
    '</div>' +
    '<p>' + esc(s.phdCompleted.detail) + '</p>' +
    '<ul class="plain-list">' + s.phdOngoing.named.map((n) =>
      '<li><strong>' + esc(n.name) + '</strong> — ' + esc(n.role) + (n.topic ? '. ' + esc(n.topic) : '') + '. <span class="muted">' + esc(n.stage) + '</span></li>').join('') + '</ul>' +
    '<p>' + esc(s.committee) + '</p>' +
    '</div>';
}

function editorialBlock() {
  const e = credentials.editorial;
  return '<div class="two-col">' +
    '<div><h3>Editorial and advisory</h3><ul class="plain-list">' +
    e.advisory.map((a) => '<li><strong>' + esc(a.role) + '</strong>, ' + esc(a.journal) + ' <span class="muted">(' + esc(a.years) + ')</span></li>').join('') +
    '</ul></div>' +
    '<div><h3>Peer review</h3><ul class="plain-list">' +
    e.reviewerJournals.map((j) => '<li>' + esc(j.journal) + (j.publisher ? ' <span class="muted">' + esc(j.publisher) + '</span>' : '') + (j.detail ? ' <span class="muted">— ' + esc(j.detail) + '</span>' : '') + '</li>').join('') +
    e.reviewerConferences.map((c) => '<li>' + esc(c.name) + ' <span class="muted">' + esc(c.host) + '</span></li>').join('') +
    '</ul></div></div>';
}

function developmentBlock() {
  return '<ul class="plain-list">' + credentials.development.map((d) =>
    '<li><strong>' + esc(d.title) + '</strong> — ' + esc(d.provider) + ' <span class="muted">' + esc(d.date) + '</span></li>').join('') + '</ul>';
}

function membershipsBlock() {
  return '<ul class="plain-list">' + credentials.memberships.map((m) =>
    '<li>' + (m.grade ? '<strong>' + esc(m.grade) + '</strong>, ' : '') + esc(m.body) + '</li>').join('') + '</ul>';
}

function administrationBlock() {
  return '<div class="role-grid">' + credentials.administration.map(function (a) {
    return '<article class="role-card">' +
      '<h3>' + esc(a.role) + '</h3>' +
      '<p class="role-org">' + esc(a.institution) + '</p>' +
      (a.detail ? '<p>' + esc(a.detail) + '</p>' : '') +
      '</article>';
  }).join('') + '</div>';
}

function conferencesBlock() {
  const c = credentials.conferences;
  const bc = credentials.bookChapter;
  return '<h3>Book chapter</h3><ul class="plain-list"><li>' + esc(bc.authors.join(', ')) + '. <em>' + esc(bc.title) + '</em>. ' +
    '<a href="https://doi.org/' + esc(bc.doi) + '" target="_blank" rel="noopener">https://doi.org/' + esc(bc.doi) + '</a></li></ul>' +
    '<h3>Conference papers</h3><ul class="plain-list">' + c.map((x) =>
      '<li>' + esc(x.authors.join(', ')) + ' (' + x.year + '). <em>' + esc(x.title) + '</em>. ' + esc(x.venue) + '.</li>').join('') + '</ul>';
}

function profileLinksBlock() {
  return '<div class="profile-links">' + site.profiles.map((p) =>
    '<a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.label) +
    (p.id ? ' <span class="muted">' + esc(p.id) + '</span>' : '') + icon('external', 'ic-xs') + '</a>').join('') + '</div>';
}

function contactRoutesBlock(route) {
  const routes = [
    { icon: 'book', head: 'Research collaboration', copy: 'Joint work in seismic strengthening, printable materials, construction automation or applied machine learning.', subject: 'Research collaboration enquiry' },
    { icon: 'building', head: 'Institutional partnership', copy: 'School engagement, academic outreach, or a partnership between your institution and Karunya.', subject: 'Institutional partnership enquiry' },
    { icon: 'users', head: 'Speaking invitation', copy: 'Invited talks, webinars, faculty development programmes and technical sessions.', subject: 'Speaking invitation' },
    { icon: 'award', head: 'Doctoral supervision', copy: 'Prospective research scholars in structural engineering, additive manufacturing or construction technology.', subject: 'Doctoral supervision enquiry' }
  ];
  return '<div class="contact-grid">' + routes.map((r) =>
    '<article class="contact-card">' +
    '<span class="contact-icon" aria-hidden="true">' + icon(r.icon) + '</span>' +
    '<h3>' + esc(r.head) + '</h3>' +
    '<p>' + esc(r.copy) + '</p>' +
    '<a class="card-link" href="mailto:' + site.person.email + '?subject=' + encodeURIComponent(r.subject) + '">Start a Conversation' + icon('arrow') + '</a>' +
    '</article>').join('') + '</div>';
}

function searchAppBlock(route) {
  return '<div class="search-app" data-search>' +
    '<div class="search-box">' +
    '<label class="visually-hidden" for="q">Search this site</label>' +
    '<input type="search" id="q" placeholder="Try: 3D concrete printing, masonry, IQAC, PEB" autocomplete="off" data-search-input>' +
    '</div>' +
    '<div class="search-filters" data-search-filters>' +
    '<button type="button" class="chip is-on" data-type="">All</button>' +
    ['Research', 'Publication', 'Patent', 'Project', 'Article', 'Talk', 'Page'].map((t) =>
      '<button type="button" class="chip" data-type="' + t.toLowerCase() + '">' + t + '</button>').join('') +
    '</div>' +
    '<p class="search-status" role="status" data-search-status>Start typing to search across publications, research, patents, projects, articles and talks.</p>' +
    '<div class="search-results" data-search-results></div>' +
    '</div>' +
    // Inlined so search works when the site is opened from the filesystem,
    // where fetch() of a local JSON file is blocked by the browser.
    '<script>window.SEARCH_INDEX=' + JSON.stringify(SEARCH_ITEMS).replace(/</g, '\\u003c') + ';</script>';
}

/* ------------------------------------------- publication detail pages */

function publicationLd(p) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': p.type === 'proceedings' ? 'ScholarlyArticle' : 'ScholarlyArticle',
    headline: p.title,
    name: p.title,
    author: p.authors.map((a) => ({ '@type': 'Person', name: a })),
    datePublished: String(p.year),
    inLanguage: 'en',
    url: canonical('publications/' + p.slug),
    isPartOf: { '@type': 'Periodical', name: p.journal },
    about: p.researchAreas.map((a) => areaName(a)),
    publisher: { '@type': 'CollegeOrUniversity', name: site.person.institution }
  };
  if (p.volume) ld.volumeNumber = String(p.volume);
  if (p.issue) ld.issueNumber = String(p.issue);
  if (p.pages) ld.pagination = p.pages;
  if (p.articleNumber) ld.articleNumber = String(p.articleNumber);
  if (p.doi) {
    ld.identifier = { '@type': 'PropertyValue', propertyID: 'DOI', value: p.doi };
    ld.sameAs = 'https://doi.org/' + p.doi;
  }
  return ld;
}

function renderPublication(p) {
  const route = 'publications/' + p.slug;
  const page = {
    route,
    title: p.title + ' | Publication | ' + site.person.name,
    description: p.title + ' — ' + p.authors.join(', ') + ', ' + p.journal + ', ' + p.year + '.',
    type: 'ScholarlyArticle'
  };

  const rows = [];
  rows.push(['Authors', p.authors.join(', ')]);
  rows.push(['Year', String(p.year)]);
  rows.push([p.type === 'proceedings' ? 'Proceedings' : 'Journal', p.journal]);
  if (p.volume) rows.push(['Volume', p.volume]);
  if (p.issue) rows.push(['Issue', p.issue]);
  if (p.pages) rows.push(['Pages', p.pages]);
  if (p.articleNumber) rows.push(['Article number', p.articleNumber]);
  if (p.doi) rows.push(['DOI', '<a href="https://doi.org/' + esc(p.doi) + '" target="_blank" rel="noopener">' + esc(p.doi) + '</a>']);
  if (p.note) rows.push(['Note', p.note]);

  const related = publications
    .filter((x) => x.slug !== p.slug && x.researchAreas.some((a) => p.researchAreas.includes(a)))
    .sort((a, b) => b.year - a.year).slice(0, 3);

  const relatedPatents = patents.filter((pt) => pt.researchAreas.some((a) => p.researchAreas.includes(a)));

  const body = [
    '<section class="section">',
    '<div class="container narrow">',
    '<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="' + url(route, '') + '">Home</a> <span aria-hidden="true">/</span> <a href="' + url(route, 'publications') + '">Publications</a></nav>',
    '<p class="eyebrow">' + (p.type === 'proceedings' ? 'Conference proceedings' : 'Journal article') + '</p>',
    '<h1 class="pub-title">' + esc(p.title) + '</h1>',
    '<p class="pub-strap">' + esc(pubMetaLine(p)) + '</p>',
    '<p class="tags">' + p.researchAreas.map((a) => '<span class="tag">' + esc(areaName(a)) + '</span>').join('') + '</p>',
    '</div>',
    '</section>',

    '<section class="section section-alt">',
    '<div class="container narrow">',
    '<h2>Bibliographic record</h2>',
    '<dl class="record-data record-data-wide">' + rows.map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + v + '</dd></div>').join('') + '</dl>',
    '<div class="cite">',
    '<h3>Citation</h3>',
    '<p class="cite-text" data-cite>' + esc(citation(p)) + '</p>',
    '<button type="button" class="btn btn-ghost btn-sm" data-copy-cite>Copy citation</button>',
    p.doi ? '<a class="btn btn-dark btn-sm" href="https://doi.org/' + esc(p.doi) + '" target="_blank" rel="noopener">View at publisher' + icon('external') + '</a>' : '',
    '</div>',
    '</div>',
    '</section>',

    '<section class="section">',
    '<div class="container narrow">',
    '<h2>Where this sits in the research</h2>',
    '<p>' + esc(p.researchAreas.map((a) => areaByS[a] ? areaByS[a].plain : '').filter(Boolean)[0] || 'This paper forms part of the wider research record.') + '</p>',
    '<p class="block-foot">' + p.researchAreas.map((a) =>
      '<a class="card-link" href="' + url(route, 'research') + '#' + esc(a) + '">' + esc(areaName(a)) + icon('arrow') + '</a>').join('') + '</p>',
    relatedPatents.length ? '<p class="area-rel"><span class="area-rel-label">Related intellectual property</span> ' +
      relatedPatents.map((pt) => '<a href="' + url(route, 'innovation') + '#' + esc(pt.slug) + '">' + esc(pt.title) + '</a>').join('; ') + '</p>' : '',
    '</div>',
    '</section>',

    related.length ? '<section class="section section-alt"><div class="container">' +
      '<h2>Related publications</h2><div class="pub-grid">' + related.map((r) => pubCard(route, r)).join('') + '</div>' +
      '<p class="block-foot"><a class="card-link" href="' + url(route, 'publications') + '">Browse Publications' + icon('arrow') + '</a></p>' +
      '</div></section>' : ''
  ].join('\n');

  const html = [
    headTag(page, { jsonld: publicationLd(p) }),
    '<body>',
    header(route),
    '<main id="main">',
    body,
    '</main>',
    footer(route)
  ].join('\n');

  writeFile(route + '/index.html', html);
}

/* ------------------------------------------------ article detail pages */

function renderArticle(a) {
  const route = 'articles/' + a.slug;
  const bodyFile = path.join(ROOT, 'content/articles/' + a.slug + '.html');
  const prose = fs.existsSync(bodyFile) ? expand(fs.readFileSync(bodyFile, 'utf8'), route) : '<p>' + esc(a.summary) + '</p>';

  const page = {
    route,
    title: a.title + ' | Articles | ' + site.person.name,
    description: a.summary,
    type: 'Article'
  };

  const relPubs = a.relatedPublications.map((s) => publications.find((p) => p.slug === s)).filter(Boolean);
  const relPats = a.relatedPatents.map((s) => patents.find((p) => p.slug === s)).filter(Boolean);

  const body = [
    '<section class="section"><div class="container narrow">',
    '<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="' + url(route, '') + '">Home</a> <span aria-hidden="true">/</span> <a href="' + url(route, 'articles') + '">Articles</a></nav>',
    '<p class="eyebrow">Research note</p>',
    '<h1>' + esc(a.title) + '</h1>',
    '<p class="lede">' + esc(a.summary) + '</p>',
    '<p class="tags">' + a.researchAreas.map((x) => '<span class="tag">' + esc(areaName(x)) + '</span>').join('') + '</p>',
    '</div></section>',
    '<section class="section"><div class="container narrow prose">',
    prose,
    '</div></section>',
    (relPubs.length || relPats.length) ? '<section class="section section-alt"><div class="container narrow">' +
      '<h2>The record behind this note</h2>' +
      (relPubs.length ? '<div class="pub-grid">' + relPubs.map((p) => pubCard(route, p)).join('') + '</div>' : '') +
      (relPats.length ? '<p class="area-rel"><span class="area-rel-label">Intellectual property</span> ' +
        relPats.map((p) => '<a href="' + url(route, 'innovation') + '#' + esc(p.slug) + '">' + esc(p.title) + '</a>').join('; ') + '</p>' : '') +
      '</div></section>' : ''
  ].join('\n');

  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.summary,
    author: { '@type': 'Person', name: site.person.name, url: site.domain + '/about/' },
    publisher: { '@type': 'Person', name: site.person.name },
    url: canonical(route), inLanguage: 'en', about: a.researchAreas.map((x) => areaName(x))
  };

  writeFile(route + '/index.html', [
    headTag(page, { jsonld: ld }), '<body>', header(route), '<main id="main">', body, '</main>', footer(route)
  ].join('\n'));
}

/* --------------------------------------------------------- redirects */

const REDIRECTS = [
  ['professor', 'academia'],
  ['researcher', 'research'],
  ['motivational-speaker', 'speaking'],
  ['talks', 'speaking'],
  ['preacher', 'ministry'],
  ['sermons', 'ministry'],
  ['philanthropist', 'service'],
  ['manager-institution-relations', 'institution-relations'],
  ['patents', 'innovation'],
  ['publications/a-review-on-confined-masonry-wall-with-opening-under-cyclic-loading', 'publications'],
  ['publications/experimental-and-analysis-technique-of-confinement-of-brick-masonry-without-openings', 'publications'],
  ['publications/towards-sustainable-infrastructure-a-framework-for-automated-extraction-of', 'publications']
];

function renderRedirect(from, to) {
  const target = url(from, to);
  const label = (pages.find((p) => p.route === to) || {}).eyebrow || to;
  const html = [
    '<!doctype html>', '<html lang="en">', '<head>', '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>Moved to ' + esc(label) + ' | ' + esc(site.person.name) + '</title>',
    '<link rel="canonical" href="' + esc(canonical(to)) + '">',
    '<meta name="robots" content="noindex,follow">',
    '<meta http-equiv="refresh" content="0;url=' + esc(target) + '">',
    '<link rel="stylesheet" href="' + asset(from, 'assets/css/site.css') + '">',
    '</head>', '<body class="redirect-page">',
    '<main id="main"><div class="container narrow">',
    '<h1>This page has moved</h1>',
    '<p class="lede">It now lives at <a href="' + target + '">' + esc(label) + '</a>.</p>',
    '<p><a class="btn btn-dark" href="' + target + '">Continue</a></p>',
    '</div></main>',
    '<script>location.replace(' + JSON.stringify(target) + ');</script>',
    '</body>', '</html>'
  ].join('\n');
  writeFile(from + '/index.html', html);
}

/* ----------------------------------------------------- search index */

function buildSearchIndex() {
  const items = [];
  const push = (type, title, route, text, meta) => items.push({ type, title, url: '/' + (route ? route + '/' : ''), text: text, meta: meta || '' });

  for (const p of publications)
    push('publication', p.title, 'publications/' + p.slug,
      [p.authors.join(' '), p.journal, p.year, p.doi || '', p.researchAreas.map(areaName).join(' ')].join(' '),
      p.year + ' · ' + p.journal);
  for (const r of research)
    push('research', r.name, 'research', [r.plain, r.technical, r.problem, r.approach, r.contribution].filter(Boolean).join(' '), 'Research area');
  for (const p of patents)
    push('patent', p.title, 'innovation', [p.summary, p.detail, p.inventors.join(' '), p.patentNumber || '', p.applicationNumber || ''].filter(Boolean).join(' '),
      p.status + (p.patentNumber ? ' · Patent No. ' + p.patentNumber : ''));
  for (const p of projects)
    push('project', p.title, 'projects', [p.description, p.fundingAgency, p.role].join(' '), p.status + ' · ' + p.fundingAgency);
  for (const a of articles)
    push('article', a.title, 'articles/' + a.slug, a.summary + ' ' + a.researchAreas.map(areaName).join(' '), 'Research note');
  for (const t of talks)
    push('talk', t.title, 'speaking', [t.summary, t.organisers, t.chair || '', t.audience || ''].join(' '), t.format + ' · ' + t.displayDate);
  for (const pg of pages)
    if (!['search'].includes(pg.route))
      push('page', plain(pg.h1) || pg.title, pg.route, plain(pg.lede) + ' ' + plain(pg.description), 'Page');

  SEARCH_ITEMS = items;
  fs.writeFileSync(path.join(ROOT, 'assets/data/search-index.json'), JSON.stringify(items));
  written.push('assets/data/search-index.json');
  return items.length;
}

/* ---------------------------------------------------------- sitemap */

function buildSitemap() {
  const routes = [];
  for (const p of pages) routes.push({ route: p.route, pri: p.route === '' ? '1.0' : '0.8' });
  for (const p of publications) routes.push({ route: 'publications/' + p.slug, pri: '0.6' });
  for (const a of articles) routes.push({ route: 'articles/' + a.slug, pri: '0.6' });

  const today = new Date().toISOString().slice(0, 10);
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    routes.map((r) => '  <url><loc>' + canonical(r.route) + '</loc><lastmod>' + today + '</lastmod><priority>' + r.pri + '</priority></url>').join('\n') +
    '\n</urlset>\n';
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
  written.push('sitemap.xml');

  fs.writeFileSync(path.join(ROOT, 'robots.txt'),
    'User-agent: *\nAllow: /\n\nSitemap: ' + site.domain + '/sitemap.xml\n');
  written.push('robots.txt');
  return routes.length;
}

/* ---------------------------------------------------------- imginf.csv */

function buildImgInf() {
  const head = ['slot_id', 'route', 'purpose', 'intended_local_path', 'current_placeholder_url', 'width', 'height', 'aspect', 'alt_text', 'brief'];
  const q = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
  const rows = images.slots.map((s) => [
    s.id, s.route, s.purpose, 'assets/img/' + s.id + '.jpg',
    'https://images.unsplash.com/' + s.remote + '?auto=format&fit=crop&w=' + s.width + '&q=80',
    s.width, s.height, (s.width / s.height).toFixed(2) + ':1',
    s.decorative ? '(decorative — leave alt empty)' : s.alt, s.brief
  ].map(q).join(','));
  fs.writeFileSync(path.join(ROOT, 'imginf.csv'), head.join(',') + '\n' + rows.join('\n') + '\n');
  written.push('imginf.csv');
  return images.slots.length;
}

/* ------------------------------------------------------------ 404 */

function render404() {
  const route = '';   // served from the site root, so root-relative depth
  const page = {
    route: '',
    title: 'Page not found | ' + site.person.name,
    description: 'The page you asked for is not here. Search the site or start from one of the main sections.',
    type: 'WebPage'
  };
  const body = [
    '<section class="section"><div class="container narrow">',
    '<p class="eyebrow">404</p>',
    '<h1>That page is not here.</h1>',
    '<p class="lede">The address may be mistyped, or the page may have moved when the site was reorganised.</p>',
    '<p class="block-foot">' +
      '<a class="btn btn-dark" href="' + url(route, 'search') + '">Search the site' + icon('search') + '</a>' +
      '<a class="btn btn-ghost" href="' + url(route, '') + '">Go to the homepage</a></p>',
    '</div></section>',
    '<section class="section section-alt"><div class="container">',
    '<div class="section-head"><div><p class="eyebrow">Main sections</p><h2>Where you may have been going</h2></div></div>',
    '<div class="area-grid">' + site.nav.map((n) =>
      '<article class="area-card"><h3><a href="' + url(route, n.route) + '">' + esc(n.label) + '</a></h3>' +
      '<p>' + esc(plain((pages.find((p) => p.route === n.route) || {}).lede || '')) + '</p></article>').join('') + '</div>',
    '</div></section>'
  ].join('\n');

  const html = [
    headTag(page).replace('<link rel="canonical"', '<meta name="robots" content="noindex">\n<link rel="canonical"'),
    '<body>', header(route), '<main id="main">', body, '</main>', footer(route)
  ].join('\n');
  writeFile('404.html', html);
}

function renderManifest() {
  const m = {
    name: site.person.name,
    short_name: 'V. S. Jebadurai',
    description: site.brand.tagline,
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#10293D',
    lang: 'en'
  };
  fs.writeFileSync(path.join(ROOT, 'site.webmanifest'), JSON.stringify(m, null, 2) + '\n');
  written.push('site.webmanifest');
}

function buildManifestTxt() {
  const lines = [];
  lines.push('URL MANIFEST — generated by tools/build.js. Do not edit by hand.');
  lines.push('Site: ' + site.domain);
  lines.push('');
  lines.push('PAGES');
  for (const p of pages) lines.push('  /' + (p.route ? p.route + '/' : '') + '  —  ' + p.title);
  lines.push('');
  lines.push('PUBLICATION PAGES (' + publications.length + ')');
  for (const p of publications) lines.push('  /publications/' + p.slug + '/  —  ' + p.year + ' ' + p.journal);
  lines.push('');
  lines.push('ARTICLE PAGES (' + articles.length + ')');
  for (const a of articles) lines.push('  /articles/' + a.slug + '/  —  ' + a.title);
  lines.push('');
  lines.push('REDIRECTS (V0.6 routes preserved, nothing 404s)');
  for (const [from, to] of REDIRECTS) lines.push('  /' + from + '/  ->  /' + (to ? to + '/' : ''));
  lines.push('');
  lines.push('OTHER');
  lines.push('  /404.html, /sitemap.xml, /robots.txt, /site.webmanifest, /imginf.csv');
  fs.writeFileSync(path.join(ROOT, 'URL-MANIFEST.txt'), lines.join('\n') + '\n');
  written.push('URL-MANIFEST.txt');
}

/* ------------------------------------------------------------- main */

function main() {
  const n = buildSearchIndex();          // must precede rendering: the search page inlines it
  for (const p of pages) renderPage(p);
  for (const p of publications) renderPublication(p);
  for (const a of articles) renderArticle(a);
  for (const [from, to] of REDIRECTS) renderRedirect(from, to);
  render404();
  renderManifest();

  const s = buildSitemap();
  const i = buildImgInf();
  buildManifestTxt();

  console.log('pages          ' + pages.length);
  console.log('publications   ' + publications.length);
  console.log('articles       ' + articles.length);
  console.log('redirects      ' + REDIRECTS.length);
  console.log('search index   ' + n + ' items');
  console.log('sitemap        ' + s + ' urls');
  console.log('imginf.csv     ' + i + ' slots');
  console.log('files written  ' + written.length);
}

main();
