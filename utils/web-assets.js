const { version } = require('../package.json')

function assetUrl(path) {
  return `${path}?v=${encodeURIComponent(version)}`
}

function renderIcons() {
  return `<link rel="icon" href="${assetUrl('/images/favicon.ico')}" sizes="16x16 32x32 48x48">
    <link rel="icon" type="image/png" href="${assetUrl('/images/favicon-32x32.png')}" sizes="32x32">
    <link rel="icon" type="image/png" href="${assetUrl('/images/icon-192x192.png')}" sizes="192x192">
    <link rel="apple-touch-icon" href="${assetUrl('/images/apple-touch-icon.png')}" sizes="180x180">
    <link rel="manifest" href="${assetUrl('/site.webmanifest')}">`
}

module.exports = { version, assetUrl, renderIcons }
