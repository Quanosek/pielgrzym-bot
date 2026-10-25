const http = require('node:http')
const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const path = require('node:path')
const express = require('express')
const MarkdownIt = require('markdown-it')
const highlight = require('highlight.js')
const notionOAuth = require('./notion-oauth')
const sendMessage = require('../utils/web-message')
const { version, assetUrl, renderIcons } = require('../utils/web-assets')

const PROJECT_ROOT = path.join(__dirname, '..')
const DOCS_DIRECTORY = path.join(PROJECT_ROOT, 'docs')
const ASSETS_DIRECTORY = path.join(PROJECT_ROOT, 'web/public')
const IMAGES_DIRECTORY = path.join(PROJECT_ROOT, 'images')
const COMMANDS_DIRECTORY = path.join(PROJECT_ROOT, 'commands')
const README_FILE = path.join(PROJECT_ROOT, 'README.md')

const OPTION_TYPES = {
  1: 'podkomenda',
  2: 'grupa',
  3: 'tekst',
  4: 'liczba',
  5: 'bool',
  6: 'użytkownik',
  7: 'kanał',
  8: 'rola',
  9: 'mentionable',
  10: 'liczba zmiennoprzecinkowa',
  11: 'załącznik',
}

const documents = [
  { slug: '01-overview-and-architecture', file: '01-overview-and-architecture.md' },
  { slug: '02-setup-and-operations', file: '02-setup-and-operations.md' },
  { slug: '03-youtube-monitoring', file: '03-youtube-monitoring.md' },
  { slug: '04-notification-channels', file: '04-notification-channels.md' },
  { slug: '05-statistics-counters', file: '05-statistics-counters.md' },
  { slug: '06-notion-integration', file: '06-notion-integration.md' },
  { slug: '07-troubleshooting', file: '07-troubleshooting.md' },
]

const legacySlugMap = {
  '01-overview': '01-overview-and-architecture',
  '01-wprowadzenie-i-architektura': '01-overview-and-architecture',
  '02-instalacja-i-uruchomienie': '02-setup-and-operations',
  '03-monitoring-youtube': '03-youtube-monitoring',
  '04-channels-and-counters': '04-notification-channels',
  '04-kanaly-powiadomien': '04-notification-channels',
  '05-notion-integration': '06-notion-integration',
  '05-liczniki-statystyk': '05-statistics-counters',
  '06-integracja-notion': '06-notion-integration',
  '06-troubleshooting': '07-troubleshooting',
  '07-rozwiazywanie-problemow': '07-troubleshooting',
}

let commandGroups = []
let server

// Markdown setup
const markdown = new MarkdownIt({ html: true, linkify: false, typographer: true })
const escapeHtml = (text) => markdown.utils.escapeHtml(text)

highlight.registerAliases('dotenv', { languageName: 'ini' })
markdown.set({
  highlight: (code, language) => (highlight.getLanguage(language) ? highlight.highlight(code, { language }).value : ''),
})

const defaultFence = markdown.renderer.rules.fence
const defaultCodeBlock = markdown.renderer.rules.code_block

function renderCodeBlock(render, tokens, index, options, environment, renderer) {
  const language = tokens[index].info.trim().split(/\s+/)[0] || 'text'
  return (
    `<div class="code-block"><div class="code-block-toolbar"><span class="code-language">${escapeHtml(language)}</span></div>` +
    render(tokens, index, options, environment, renderer) +
    `</div>`
  )
}

markdown.renderer.rules.fence = (...args) => renderCodeBlock(defaultFence, ...args)
markdown.renderer.rules.code_block = (...args) => renderCodeBlock(defaultCodeBlock, ...args)

function stripLeadingNumber(text) {
  return text.replace(/^\d+(\.\d+)*\.\s*/, '').trim()
}

function slugify(text) {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

markdown.renderer.rules.image = (tokens, index) => `<span class="image-reference">${escapeHtml(tokens[index].content)}</span>`

const defaultLinkOpen = markdown.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))
markdown.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet('href')
  const match = href && href.match(/^(?:\.\/)?docs\/([a-z0-9-]+)\.md$/i)
  if (match) tokens[idx].attrSet('href', `/docs/${match[1]}`)
  return defaultLinkOpen(tokens, idx, options, env, self)
}

const defaultHeadingOpen = markdown.renderer.rules.heading_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))
markdown.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  if (token.tag === 'h2' && tokens[idx + 1]) {
    token.attrSet('id', slugify(stripLeadingNumber(tokens[idx + 1].content)))
  }
  return defaultHeadingOpen(tokens, idx, options, env, self)
}

// Startup hydration from docs/*.md and commands/*/*.js
async function hydrateDocuments() {
  for (const doc of documents) {
    const source = await fs.readFile(path.join(DOCS_DIRECTORY, doc.file), 'utf8')
    const titleMatch = source.match(/^#\s+(.+?)\s*$/m)
    const channelMatch = source.match(/<!--\s*channel:\s*([a-z0-9-]+)\s*-->/i)
    doc.title = titleMatch ? stripLeadingNumber(titleMatch[1]) : doc.slug
    doc.channel = channelMatch ? channelMatch[1] : doc.slug
    doc.threads = [...source.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => {
      const cleaned = stripLeadingNumber(match[1])
      return { title: cleaned, id: slugify(cleaned) }
    })
  }
}

function mapParameter(parameter) {
  return {
    name: parameter.name,
    description: parameter.description,
    required: !!parameter.required,
    type: OPTION_TYPES[parameter.type] || String(parameter.type),
    choices: parameter.choices || [],
  }
}

function loadCommands() {
  commandGroups = []
  for (const folder of fsSync.readdirSync(COMMANDS_DIRECTORY)) {
    const folderPath = path.join(COMMANDS_DIRECTORY, folder)
    if (!fsSync.statSync(folderPath).isDirectory()) continue
    const items = []
    for (const file of fsSync.readdirSync(folderPath)) {
      if (!file.endsWith('.js')) continue
      const mod = require(path.join(folderPath, file))
      if (!mod?.data?.toJSON) continue
      const { name, description, options = [] } = mod.data.toJSON()
      const subcommandOptions = options.filter((option) => option.type === 1 || option.type === 2)
      const inlineOptions = options.filter((option) => option.type !== 1 && option.type !== 2)
      items.push({
        name,
        description,
        subcommands: subcommandOptions.map((option) => ({
          name: option.name,
          description: option.description,
          options: (option.options || []).map(mapParameter),
        })),
        options: inlineOptions.map(mapParameter),
      })
    }
    if (items.length) commandGroups.push({ group: folder, items })
  }
}

// Page builders — each returns { title, content }
function heroBanner({ badge, title, highlight = '', lead, actions = '', visual = '', note = '', featured = false }) {
  return (
    `<section class="discord-welcome-banner${featured ? ' banner-featured' : ' banner-compact'}">` +
    `<div class="banner-copy">` +
    `<div class="banner-badge">${escapeHtml(badge)}</div>` +
    `<h1 class="banner-title">${escapeHtml(title)}${highlight ? ` <span class="banner-highlight">${escapeHtml(highlight)}</span>` : ''}</h1>` +
    `<p class="banner-lead">${escapeHtml(lead)}</p>` +
    actions +
    (note ? `<p class="banner-note">${escapeHtml(note)}</p>` : '') +
    `</div>` +
    visual +
    `</section>`
  )
}

async function buildHome() {
  const source = await fs.readFile(README_FILE, 'utf8')
  const environment = {}
  const tokens = markdown.parse(source, environment)
  const bodyStart = tokens.findIndex((token) => token.type === 'heading_open' && token.tag === 'h2')
  if (bodyStart === -1) throw new Error('README must contain a level-two heading after its introduction')

  const actions =
    `<div class="banner-actions">` +
    `<a class="discord-btn discord-btn-blurple" href="/docs/${documents[0].slug}">Poznaj Pielgrzyma →</a>` +
    `<a class="discord-btn discord-btn-secondary" href="/commands">Zobacz komendy</a>` +
    `</div>`

  const visual =
    `<figure class="banner-flow" aria-label="Przepływ publikacji z YouTube do Discorda i opcjonalnie Notion">` +
    `<div class="flow-card flow-source"><span class="flow-symbol" aria-hidden="true">▶</span>` +
    `<strong>YouTube</strong><span>Nowa publikacja</span></div>` +
    `<div class="flow-branches" aria-hidden="true"><span>↓</span><span>↓</span></div>` +
    `<div class="flow-destinations">` +
    `<div class="flow-card flow-discord"><span class="flow-symbol" aria-hidden="true">#</span>` +
    `<strong>Discord</strong><span>Powiadomienie</span></div>` +
    `<div class="flow-card flow-notion"><span class="flow-symbol" aria-hidden="true">N</span>` +
    `<strong>Notion</strong><span>Wpis z datą i URL</span></div>` +
    `</div><figcaption>Schemat działania · Notion jest opcjonalny</figcaption></figure>`

  const hero = heroBanner({
    badge: 'BOT DLA TWOJEJ SPOŁECZNOŚCI',
    title: 'Nowe publikacje.',
    highlight: 'Bliżej społeczności.',
    lead: 'Monitoruj wybrany kanał YouTube: wysyłaj powiadomienia o filmach i komentarzach na wskazane kanały Discord, śledź statystyki i dodawaj publikacje do Notion.',
    actions,
    visual,
    note: 'Jeden kanał YouTube na serwer · Notion opcjonalnie',
    featured: true,
  })
  const inviteUrl = process.env.DISCORD_INVITE_URL
  if (inviteUrl) {
    const parsed = new URL(inviteUrl)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
      throw new Error('DISCORD_INVITE_URL must be an HTTPS URL without credentials')
  }
  const invitation = `<section class="invite-section" aria-labelledby="invite-title">
    <h2 id="invite-title">Twoja społeczność. Nowa orbita.</h2>
    <p>Zaproś Pielgrzyma na swój serwer Discord.</p>
    ${
      inviteUrl
        ? `<a class="discord-btn invite-button" href="${escapeHtml(inviteUrl)}" target="_blank" rel="noopener noreferrer" data-invite>Zaproś bota</a>`
        : `<button class="discord-btn invite-button" disabled>Zaproś bota</button><p class="invite-unavailable">Zaproszenie jest chwilowo niedostępne.</p>`
    }
  </section>`
  return {
    title: 'Pielgrzym',
    content:
      hero + invitation + `<article class="prose">${markdown.renderer.render(tokens.slice(bodyStart), markdown.options, environment)}</article>`,
  }
}

async function buildTableOfContents() {
  const cards = documents
    .map((d) => {
      const tags = d.threads.map((t) => `<span class="toc-tag">${escapeHtml(t.title)}</span>`).join('')
      return (
        `<a class="toc-channel-row" href="/docs/${d.slug}">` +
        `<div class="toc-item-header"><span class="toc-hash">#</span><span class="toc-link-title">${escapeHtml(d.title)}</span></div>` +
        `<div class="toc-tags">${tags}</div>` +
        `</a>`
      )
    })
    .join('')
  const hero = heroBanner({
    badge: 'SPIS TREŚCI',
    title: 'Poznaj Pielgrzyma krok po kroku.',
    lead: 'Od pierwszego uruchomienia po YouTube, liczniki i Notion. Wybierz temat, którego potrzebujesz.',
    visual:
      `<div class="banner-map" aria-hidden="true"><span class="map-caption">ODKRYWAJ KROK PO KROKU</span>` +
      `<div class="map-stop"><span class="map-node">01</span><span>Poznaj projekt</span></div>` +
      `<div class="map-stop"><span class="map-node">02</span><span>Uruchom bota</span></div>` +
      `<div class="map-stop"><span class="map-node">03</span><span>Połącz usługi</span></div></div>`,
  })
  return { title: 'Spis treści dokumentacji', content: hero + `<div class="discord-toc-container">${cards}</div>` }
}

function renderParams(params) {
  if (!params.length) return ''
  const items = params
    .map(
      (p) =>
        `<li><code>${escapeHtml(p.name)}</code>` +
        ` <span class="param-type">${escapeHtml(p.type)}${p.required ? ' • wymagane' : ''}</span>` +
        ` — ${escapeHtml(p.description)}` +
        (p.choices.length
          ? `<div class="param-choices">Dostępne wartości: ${p.choices
              .map((choice) => `${escapeHtml(choice.name)} (<code>${escapeHtml(String(choice.value))}</code>)`)
              .join(', ')}</div>`
          : '') +
        `</li>`,
    )
    .join('')
  return `<ul class="command-params">${items}</ul>`
}

function renderSubcommand(commandName, sub) {
  return (
    `<div class="command-sub">` +
    `<div class="command-sub-head"><code>/${escapeHtml(commandName)} ${escapeHtml(sub.name)}</code></div>` +
    `<div class="command-sub-desc">${escapeHtml(sub.description)}</div>` +
    renderParams(sub.options) +
    `</div>`
  )
}

function renderCommand(command) {
  const subs = command.subcommands.length
    ? `<div class="command-subs">${command.subcommands.map((s) => renderSubcommand(command.name, s)).join('')}</div>`
    : ''
  return (
    `<article class="command-card" id="${escapeHtml(command.name)}">` +
    `<header class="command-head"><h3 class="command-name"><code>/${escapeHtml(command.name)}</code></h3></header>` +
    `<p class="command-desc">${escapeHtml(command.description)}</p>` +
    renderParams(command.options) +
    subs +
    `</article>`
  )
}

async function buildCommandsGuide() {
  const groups = commandGroups
    .map(
      ({ group, items }) =>
        `<section class="command-group"><h2 class="command-group-title">${escapeHtml(group)}</h2>${items.map(renderCommand).join('')}</section>`,
    )
    .join('')
  const hero = heroBanner({
    badge: 'KOMENDY BOTA',
    title: 'Wszystko zaczyna się od /.',
    lead: 'Sprawdź dostępne komendy, ich parametry i podkomendy — bez zgadywania składni. Lista powstaje bezpośrednio z kodu bota.',
    visual:
      `<div class="banner-syntax"><span class="syntax-slash" aria-hidden="true">/</span>` +
      `<div class="syntax-examples"><span class="syntax-caption">WPISZ NA DISCORDZIE</span>` +
      `<code><span>/youtube</span> status</code><code><span>/notion</span> status</code></div></div>`,
  })
  return { title: 'Komendy bota', content: hero + groups }
}

const navChannels = [
  { slug: 'strona-glowna', url: '/', build: buildHome },
  { slug: 'spis-tresci', url: '/table-of-contents', build: buildTableOfContents },
  { slug: 'komendy-bota', url: '/commands', build: buildCommandsGuide },
]

// Layout fragments
function renderChannelGroup({ href, label, active, threads = [] }) {
  const threadItems = threads
    .map(
      (thread) =>
        `<a class="thread-link" href="${href}#${thread.id}">` +
        `<span class="thread-icon" aria-hidden="true">╰</span>` +
        `<span class="thread-name">${escapeHtml(thread.title)}</span>` +
        `</a>`,
    )
    .join('')

  return (
    `<div class="channel-group">` +
    `<a class="channel-link${active ? ' active' : ''}" href="${href}">` +
    `<span class="channel-hash">#</span><span class="channel-name">${escapeHtml(label)}</span>` +
    `</a>` +
    (threadItems ? `<div class="thread-list"><span class="thread-progress" aria-hidden="true"></span>${threadItems}</div>` : '') +
    `</div>`
  )
}

function renderSidebar(activeSlug) {
  const navs = navChannels.map((c) => renderChannelGroup({ href: c.url, label: c.slug, active: activeSlug === c.slug })).join('')
  const docs = documents
    .map((d) => renderChannelGroup({ href: `/docs/${d.slug}`, label: d.channel, active: activeSlug === d.slug, threads: d.threads }))
    .join('')
  return `<div class="sidebar-scrollable">${navs}<div class="sidebar-divider" aria-hidden="true"></div>${docs}</div>`
}

function renderTopbar(activeSlug) {
  const nav = navChannels.find((c) => c.slug === activeSlug)
  const activeDoc = documents.find((d) => d.slug === activeSlug)
  const name = nav?.slug ?? activeDoc?.channel
  if (!name) return ''
  const topic = activeDoc ? `<span class="topbar-divider"></span><span class="topbar-topic">${escapeHtml(activeDoc.title)}</span>` : ''
  return `<div class="channel-topbar"><span class="topbar-hash">#</span><span class="topbar-name">${escapeHtml(name)}</span>${topic}</div>`
}

function layout(title, content, activeSlug = '') {
  return /*html*/ `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Oficjalna dokumentacja techniczna i podręcznik operacyjny bota Discord Pielgrzym">
    <meta name="app-version" content="${escapeHtml(version)}">
    <title>${escapeHtml(title)} · Dokumentacja Pielgrzym</title>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    ${renderIcons()}
    <link rel="stylesheet" href="${assetUrl('/assets/styles.css')}">
    <script src="${assetUrl('/assets/scripts.js')}" defer></script>
    <script src="${assetUrl('/assets/invitation-animation.js')}" defer></script>
  </head>

  <body>
    <header class="discord-header">
      <div class="header-inner">
        <div class="brand-wrapper">
          <div class="discord-avatar-container">
            <img src="${assetUrl('/images/avatar.png')}" alt="Pielgrzym Avatar" class="discord-avatar-img">
            <span class="status-indicator online" title="Status: Online"></span>
          </div>

          <div class="brand-info">
            <div class="brand-title-line">
              <a class="brand-name" href="/">Pielgrzym</a>
              <span class="discord-bot-tag"><svg class="bot-check-icon" width="12" height="12" viewBox="0 0 16 15" aria-hidden="true"><path fill="currentColor" d="M7.4 11.9 3.2 8.1l1.4-1.4 2.8 2.5 5.5-5.5 1.4 1.4-6.9 6.8Z"/></svg><span class="bot-tag-label">APP</span></span>
              <span class="version-tag">v${escapeHtml(version)}</span>
            </div>
          </div>
        </div>

        <button class="mobile-menu-toggle header-icon-button" type="button" aria-label="Otwórz menu" aria-expanded="false" aria-controls="header-menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <div class="header-menu" id="header-menu">
          <div class="header-actions">
          <div class="search-box">
            <input type="search" id="site-search" class="search-input" placeholder="Szukaj w dokumentacji…" autocomplete="off" aria-label="Wyszukiwarka dokumentacji">
            <button class="search-clear-button" id="search-clear" type="button" aria-label="Wyczyść wyszukiwanie" hidden>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 3 6 6m0-6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
            <kbd class="search-kbd">Ctrl K</kbd>
            <div class="search-results" id="search-results" hidden></div>
          </div>
          <a class="header-icon-button support-button" href="https://buycoffee.to/kubaklalo" aria-label="Wesprzyj na BuyCoffee" title="Wesprzyj na BuyCoffee">
            <span class="support-mark" aria-hidden="true"></span>
          </a>
          <a class="header-icon-button github-button" href="https://github.com/Quanosek/Pielgrzym" aria-label="Repozytorium na GitHub" title="Repozytorium na GitHub">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.043-1.61-4.043-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.838 1.237 1.838 1.237 1.07 1.835 2.807 1.305 3.492.998.108-.776.418-1.305.762-1.605-2.665-.305-5.467-1.334-5.467-5.93 0-1.31.468-2.38 1.235-3.22-.124-.303-.535-1.524.117-3.176 0 0 1.008-.323 3.3 1.23a11.5 11.5 0 0 1 3.003-.404c1.02.005 2.047.138 3.006.404 2.29-1.553 3.297-1.23 3.297-1.23.654 1.652.243 2.873.12 3.176.77.84 1.233 1.91 1.233 3.22 0 4.608-2.807 5.62-5.48 5.917.43.372.823 1.102.823 2.222 0 1.606-.015 2.9-.015 3.293 0 .322.216.694.825.576C20.565 22.296 24 17.8 24 12.5 24 5.87 18.627.5 12 .5Z"/></svg>
          </a>
          </div>
        </div>
      </div>
    </header>

    <div class="app-layout">
      <aside class="discord-sidebar" aria-label="Nawigacja kanałów dokumentacji">
        ${renderSidebar(activeSlug)}
      </aside>

      <div class="content-wrapper">
        ${renderTopbar(activeSlug)}
        <main class="discord-main">
          ${content}
        </main>
      </div>
    </div>

    <footer class="discord-footer">
      <div class="footer-inner">
        <div class="footer-top">
          <div class="footer-main">
            <div class="footer-identity">
              <span class="footer-brand">Pielgrzym</span>
              <span class="footer-version">v${escapeHtml(version)}</span>
            </div>
            <span class="footer-divider" aria-hidden="true">·</span>
            <nav class="footer-nav" aria-label="Nawigacja w stopce">
              <a href="/">Strona główna</a>
              <a href="/table-of-contents">Spis treści</a>
              <a href="/commands">Komendy bota</a>
            </nav>
          </div>
          <div class="footer-actions">
            <a class="footer-support" href="https://buycoffee.to/kubaklalo">Wesprzyj</a>
            <a href="https://github.com/Quanosek/Pielgrzym">GitHub</a>
          </div>
        </div>
        <div class="footer-bottom">
          <p class="footer-legal">Możesz używać, modyfikować i rozpowszechniać projekt zgodnie z warunkami licencji <a href="https://github.com/Quanosek/Pielgrzym/blob/HEAD/LICENSE">GNU AGPL v3.0</a>. Przy udostępnianiu zmodyfikowanej wersji przez sieć udostępnij jej użytkownikom odpowiadający kod źródłowy (sekcja 13). Oprogramowanie jest dostarczane bez gwarancji; nie publikuj tokenów ani innych danych poufnych. Znaki towarowe należą do ich właścicieli.</p>
          <p class="footer-author">Jakub Kłało &copy; <a href="https://www.klalo.pl">klalo.pl</a><img class="footer-mark" src="${assetUrl('/images/favicon-32x32.png')}" alt="" aria-hidden="true"></p>
        </div>
      </div>
    </footer>
  </body>
</html>`
}

function sendPage(response, { status = 200, title, body, activeSlug = '' }) {
  response
    .status(status)
    .type('html')
    .send(layout(title, body, activeSlug))
}

function buildSearchIndex() {
  const entries = navChannels.map((nav) => ({ title: nav.slug, url: nav.url, kind: 'strona', hint: '' }))
  for (const doc of documents) {
    entries.push({ title: doc.title, url: `/docs/${doc.slug}`, kind: 'dokument', hint: doc.channel })
    for (const thread of doc.threads) {
      entries.push({ title: thread.title, url: `/docs/${doc.slug}#${thread.id}`, kind: 'sekcja', hint: doc.title })
    }
  }
  for (const { items } of commandGroups) {
    for (const command of items) {
      entries.push({ title: `/${command.name}`, url: `/commands#${command.name}`, kind: 'komenda', hint: command.description })
      for (const sub of command.subcommands) {
        entries.push({ title: `/${command.name} ${sub.name}`, url: `/commands#${command.name}`, kind: 'podkomenda', hint: sub.description })
      }
    }
  }
  return entries
}

function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use((request, response, next) => {
    response.set(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; img-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    )
    response.set('X-Content-Type-Options', 'nosniff')
    response.set('Referrer-Policy', 'no-referrer')
    next()
  })

  notionOAuth.registerRoutes(app)
  app.use('/assets', express.static(ASSETS_DIRECTORY, { fallthrough: false, index: false, maxAge: '1h' }))
  app.use('/images', express.static(IMAGES_DIRECTORY, { fallthrough: false, index: false, maxAge: '1h' }))
  app.use((request, response, next) => {
    response.set('Cache-Control', 'no-cache')
    next()
  })
  app.get('/favicon.ico', (request, response) => response.redirect(302, assetUrl('/images/favicon.ico')))
  app.get('/apple-touch-icon.png', (request, response) => response.redirect(302, assetUrl('/images/apple-touch-icon.png')))
  app.get('/site.webmanifest', (request, response) =>
    response.type('application/manifest+json').send({
      name: 'Pielgrzym — dokumentacja',
      short_name: 'Pielgrzym',
      lang: 'pl',
      start_url: '/',
      display: 'browser',
      background_color: '#0d0f15',
      theme_color: '#0d0f15',
      icons: [192, 512].map((size) => ({
        src: assetUrl(`/images/icon-${size}x${size}.png`),
        sizes: `${size}x${size}`,
        type: 'image/png',
        purpose: 'any',
      })),
    }),
  )
  app.get('/healthz', (request, response) => response.json({ status: 'ok' }))
  app.get('/search-index.json', (request, response) => response.json(buildSearchIndex()))

  for (const channel of navChannels) {
    app.get(channel.url, async (request, response, next) => {
      try {
        const { title, content } = await channel.build()
        sendPage(response, { title, body: content, activeSlug: channel.slug })
      } catch (error) {
        console.error(`[Web] Could not build ${channel.url}:`, error.code || error.message || 'UNKNOWN')
        next(error)
      }
    })
  }

  app.get(['/docs/00-table-of-contents', '/spis-tresci'], (request, response) => response.redirect(301, '/table-of-contents'))

  app.get('/docs/:slug', async (request, response, next) => {
    const slug = legacySlugMap[request.params.slug] ?? request.params.slug
    const document = documents.find((entry) => entry.slug === slug)
    if (!document) return next()
    try {
      const source = await fs.readFile(path.join(DOCS_DIRECTORY, document.file), 'utf8')
      sendPage(response, { title: document.title, body: `<article class="prose">${markdown.render(source)}</article>`, activeSlug: document.slug })
    } catch (error) {
      console.error('[Web] Could not load project documentation:', error.code || 'UNKNOWN')
      next(error)
    }
  })

  app.use((request, response) =>
    sendMessage(response, {
      status: 404,
      title: 'Nie znaleziono strony',
      message: 'Ten adres nie prowadzi do dostępnej strony. Wróć na stronę główną lub wybierz rozdział dokumentacji.',
    }),
  )

  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error)
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500
    const messages = {
      400: ['Nieprawidłowy adres lub żądanie', 'Sprawdź adres i spróbuj ponownie albo wróć na stronę główną.'],
      403: ['Brak dostępu', 'Ten zasób nie jest dostępny. Wróć na stronę główną dokumentacji.'],
      404: ['Nie znaleziono zasobu', 'Podany plik lub strona nie istnieje. Wróć na stronę główną dokumentacji.'],
      405: ['Niedozwolona metoda', 'Otwórz stronę za pomocą odnośnika w dokumentacji.'],
      414: ['Adres jest zbyt długi', 'Skróć adres lub wróć na stronę główną dokumentacji.'],
      416: ['Nieprawidłowy zakres zasobu', 'Otwórz zasób ponownie bez wskazywania zakresu pobierania.'],
    }
    const [title, message] = messages[status] || [
      status >= 500 ? 'Błąd serwera' : 'Nie udało się obsłużyć żądania',
      'Dokumentacja jest chwilowo niedostępna. Spróbuj ponownie za chwilę lub wróć na stronę główną.',
    ]
    if (status >= 500) console.error('[Web] Request failed:', error.code || 'UNKNOWN')
    sendMessage(response, {
      status,
      title,
      message,
    })
  })

  return app
}

async function startServer() {
  if (server?.listening) return server
  await hydrateDocuments()
  loadCommands()
  const notionConfiguration = ['NOTION_CLIENT_ID', 'NOTION_CLIENT_SECRET', 'NOTION_REDIRECT_URI', 'NOTION_TOKEN_ENCRYPTION_KEY']
  if (notionConfiguration.some((key) => process.env[key])) notionOAuth.validateConfiguration()
  const port = Number(process.env.WEB_PORT || 3001)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('WEB_PORT must be a valid TCP port')
  const listener = http.createServer(createApp())
  listener.requestTimeout = 10_000
  listener.headersTimeout = 10_000
  await new Promise((resolve, reject) => {
    listener.once('error', reject)
    listener.listen(port, process.env.WEB_HOST || '127.0.0.1', resolve)
  })
  notionOAuth.setCallbackAvailable(true)
  listener.removeAllListeners('error')
  listener.on('error', (error) => console.error('[Web] Documentation server error:', error.code || 'UNKNOWN'))
  server = listener
  console.info(`[Web] Documentation available at http://${process.env.WEB_HOST || '127.0.0.1'}:${port}`)
  return listener
}

async function stopServer() {
  notionOAuth.setCallbackAvailable(false)
  if (server) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  server = undefined
}

module.exports = { startServer, stopServer }
