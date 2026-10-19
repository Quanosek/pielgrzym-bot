const path = require('node:path')

function getDiscordConfig() {
  const token = process.env.DISCORD_TOKEN || ''
  const clientId = process.env.CLIENT_ID || ''
  const ownerId = process.env.OWNER_ID || ''
  const guildId = process.env.GUILD_ID || ''

  return {
    name: 'discord',
    title: 'Moduł Discord',
    token,
    clientId,
    ownerId,
    guildId,
    isConfigured: Boolean(token && clientId),
  }
}

function getYouTubeConfig() {
  const apiKey = process.env.YOUTUBE_API_KEY || ''

  return {
    name: 'youtube',
    title: 'Moduł YouTube Data API',
    apiKey,
    isConfigured: Boolean(apiKey),
  }
}

function getWebConfig() {
  const host = process.env.WEB_HOST || '127.0.0.1'
  const port = Number(process.env.WEB_PORT || 3001)

  return {
    name: 'web',
    title: 'Moduł serwera Web i dokumentacji Express',
    host,
    port,
    isConfigured: Number.isInteger(port) && port >= 1 && port <= 65535,
  }
}

function getNotionConfig() {
  const clientId = process.env.NOTION_CLIENT_ID || ''
  const clientSecret = process.env.NOTION_CLIENT_SECRET || ''
  const redirectUri = process.env.NOTION_REDIRECT_URI || ''
  const encryptionKey = process.env.NOTION_TOKEN_ENCRYPTION_KEY || ''
  const isConfigured = Boolean(clientId && clientSecret && redirectUri && encryptionKey)

  return {
    name: 'notion',
    title: 'Moduł Notion OAuth i publikacji wpisów',
    clientId,
    clientSecret,
    redirectUri,
    encryptionKey,
    isConfigured,
  }
}

function getModulesConfig() {
  const discord = getDiscordConfig()
  const youtube = getYouTubeConfig()
  const web = getWebConfig()
  const notion = getNotionConfig()

  return {
    discord,
    youtube,
    web,
    notion,
    features: {
      discord: discord.isConfigured,
      youtube: youtube.isConfigured,
      web: web.isConfigured,
      notion: notion.isConfigured,
    },
    paths: {
      dataDir: path.join(__dirname, '../data'),
      docsDir: path.join(__dirname, '../docs'),
      publicDir: path.join(__dirname, '../web/public'),
    },
  }
}

module.exports = {
  getDiscordConfig,
  getYouTubeConfig,
  getWebConfig,
  getNotionConfig,
  getModulesConfig,
}
