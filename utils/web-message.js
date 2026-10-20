const { STATUS_CODES } = require('node:http')
const { escapeHtml } = require('markdown-it')().utils
const { assetUrl, renderIcons } = require('./web-assets')

function sendMessage(response, { status, title, message, detail = '', helpHref = '/table-of-contents', helpLabel = 'Spis treści' }) {
  const success = status >= 200 && status < 300
  response
    .status(status)
    .set({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self'; manifest-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    })
    .type('html').send(`<!doctype html>
<html lang="pl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>${escapeHtml(title)} · Pielgrzym</title>
    ${renderIcons()}
    <link rel="stylesheet" href="${assetUrl('/assets/styles.css')}">
  </head>
  <body class="message-page">
    <main class="message-stage">
      <section class="message-card" aria-labelledby="message-title">
        ${
          success
            ? `<header class="message-status message-success-heading">
          <span class="message-symbol message-symbol-success" aria-hidden="true">✓</span>
          <h1 id="message-title">${escapeHtml(title)}</h1>
        </header>`
            : `<div class="message-status">
          <span class="message-symbol" aria-hidden="true">${status === 404 ? '?' : '!'}</span>
          <span class="message-status-code" lang="en">HTTP ${status} ${escapeHtml(STATUS_CODES[status] || '')}</span>
        </div>
        <h1 id="message-title">${escapeHtml(title)}</h1>`
        }
        ${detail ? `<p class="message-detail">${escapeHtml(detail)}</p>` : ''}
        <p class="message-description">${escapeHtml(message)}</p>
        <nav class="message-actions" aria-label="Dalsze kroki">
          <a class="discord-btn discord-btn-blurple" href="/">Strona główna</a>
          <a class="discord-btn discord-btn-secondary" href="${escapeHtml(helpHref)}">${escapeHtml(helpLabel)}</a>
        </nav>
      </section>
    </main>
  </body>
</html>`)
}

module.exports = sendMessage
