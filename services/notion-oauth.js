const { randomBytes, createHash } = require('node:crypto')
const { PermissionFlagsBits } = require('discord.js')
const auth = require('../utils/notion-auth')
const GuildConfig = require('../utils/guild-config')
const runGuildTask = require('../utils/yt-task')
const sendMessage = require('../utils/web-message')

const sessions = new Map()
const SESSION_TTL = 10 * 60_000
let callbackAvailable = false

function sessionKey(state) {
  return createHash('sha256').update(state).digest('hex')
}

function pruneSessions() {
  for (const [key, session] of sessions) {
    if (session.expiresAt <= Date.now()) sessions.delete(key)
  }
}

function createAuthorization(guildId, userId) {
  const { clientId, redirectUri } = auth.oauthConfiguration()
  if (!callbackAvailable) throw new Error('Notion OAuth callback route is not available')
  pruneSessions()
  if (sessions.size >= 1000) throw new Error('Too many pending Notion authorizations')
  for (const [key, session] of sessions) {
    if (session.guildId === guildId) sessions.delete(key)
  }
  const state = randomBytes(32).toString('base64url')
  const key = sessionKey(state)
  sessions.set(key, { guildId, userId, expiresAt: Date.now() + SESSION_TTL, phase: 'waiting' })
  setTimeout(() => sessions.delete(key), SESSION_TTL).unref()
  const url = new URL('https://api.notion.com/v1/oauth/authorize')
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', owner: 'user', state }).toString()
  return { url: url.toString(), state }
}

async function confirmAuthorization(state, interaction) {
  pruneSessions()
  const key = sessionKey(state)
  const session = sessions.get(key)
  if (!session || session.guildId !== interaction.guildId || session.userId !== interaction.user.id) {
    return { message: '⚠️ Połączenie wygasło lub należy do innego administratora. Użyj `/notion connect` ponownie.' }
  }
  if (!['ready', 'reviewed'].includes(session.phase)) {
    return { message: '⚠️ Najpierw dokończ autoryzację w przeglądarce, a następnie naciśnij przycisk ponownie.', keepPanel: true }
  }
  if (session.phase === 'ready') {
    session.phase = 'reviewed'
    return {
      message: `Wybrana przestrzeń robocza: **${session.connection.workspaceName.slice(0, 150)}**\nIdentyfikator: \`${session.connection.workspaceId}\`\nSprawdź, czy to właściwa przestrzeń robocza. Potwierdzenie zastąpi poprzednie połączenie i wstrzyma zapis do czasu wybrania tabeli.`,
      keepPanel: true,
      reviewed: true,
    }
  }
  const member = await interaction.guild.members.fetch(interaction.user.id)
  if (!member.permissions.has(PermissionFlagsBits.Administrator) && interaction.user.id !== process.env.OWNER_ID) {
    return { message: '🛑 Nie masz już uprawnień administratora tego serwera.' }
  }
  return runGuildTask(`notion:${session.guildId}`, async () => {
    if (sessions.get(key) !== session || session.expiresAt <= Date.now() || session.phase !== 'reviewed') {
      return { message: '⚠️ To połączenie jest już nieaktualne. Użyj `/notion connect` ponownie.' }
    }
    const config = await GuildConfig.getConfig(session.guildId)
    await GuildConfig.updateGuildConfig(session.guildId, {
      notionIntegration: { ...config?.notionIntegration, enabled: false, revision: randomBytes(6).toString('hex') },
    })
    await runGuildTask(`notion-auth:${session.guildId}`, () => auth.saveConnection(session.guildId, session.connection))
    sessions.delete(key)
    return {
      message: `✅ Połączono przestrzeń roboczą Notion: ${session.connection.workspaceName.slice(0, 150)}. Teraz wybierz tabelę przez \`/notion enable\`.`,
    }
  })
}

function cancelGuild(guildId) {
  for (const [key, session] of sessions) {
    if (session.guildId === guildId) sessions.delete(key)
  }
}

function respond(response, status, title, message, detail = '') {
  return sendMessage(response, {
    status,
    title,
    message,
    detail,
    helpHref: '/docs/06-notion-integration',
    helpLabel: 'Pomoc z Notion',
  })
}

async function handleCallback(request, response) {
  if (request.method !== 'GET') {
    response.set('Allow', 'GET')
    return respond(response, 405, 'Niedozwolona metoda', 'Wróć do Discorda i otwórz link otrzymany po użyciu /notion connect.')
  }
  if ((request.url || '').length > 8192) {
    return respond(response, 414, 'Adres jest zbyt długi', 'Wróć do Discorda i rozpocznij nowe połączenie przez /notion connect.')
  }
  const url = new URL(request.url, 'http://localhost')
  if (url.pathname !== '/notion/oauth/callback') {
    return respond(response, 404, 'Nie znaleziono strony', 'Sprawdź adres lub rozpocznij nowe połączenie na Discordzie.')
  }
  const state = url.searchParams.get('state')
  pruneSessions()
  const key = state && sessionKey(state)
  const session = key && sessions.get(key)
  if (!session || session.phase !== 'waiting' || url.searchParams.getAll('state').length !== 1) {
    return respond(
      response,
      400,
      'To połączenie nie jest już aktywne',
      'Link jest nieprawidłowy, wygasł lub został już użyty. Wróć do Discorda i rozpocznij nowe połączenie przez /notion connect.',
    )
  }
  session.phase = 'exchanging'
  if (url.searchParams.has('error')) {
    sessions.delete(key)
    return respond(response, 400, 'Nie udzielono dostępu', 'Możesz rozpocząć nowe połączenie na Discordzie przez /notion connect.')
  }
  const code = url.searchParams.get('code')
  if (!code || url.searchParams.getAll('code').length !== 1) {
    sessions.delete(key)
    return respond(response, 400, 'Brak poprawnego kodu autoryzacji', 'Wróć do Discorda i rozpocznij połączenie ponownie przez /notion connect.')
  }
  try {
    const token = await auth.exchangeToken({ grant_type: 'authorization_code', code, redirect_uri: auth.oauthConfiguration().redirectUri })
    if (sessions.get(key) !== session || session.expiresAt <= Date.now()) {
      return respond(
        response,
        400,
        'To połączenie nie jest już aktywne',
        'Sesja wygasła lub została zastąpiona podczas autoryzacji. Rozpocznij połączenie ponownie na Discordzie.',
      )
    }
    session.connection = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || null,
      workspaceId: token.workspace_id,
      workspaceName: token.workspace_name || token.workspace_id,
      connectionId: randomBytes(16).toString('hex'),
      connectedBy: session.userId,
      connectedAt: Date.now(),
    }
    session.phase = 'ready'
    return respond(
      response,
      200,
      'Notion udzielił dostępu',
      'Aby zapisać połączenie, wróć do prywatnej odpowiedzi bota na Discordzie, wybierz „Sprawdź autoryzację” i potwierdź przestrzeń roboczą.',
      `Przestrzeń robocza: ${session.connection.workspaceName}`,
    )
  } catch (error) {
    sessions.delete(key)
    console.error('[Notion OAuth] Authorization failed:', error.message)
    return respond(
      response,
      502,
      'Nie udało się zakończyć autoryzacji',
      'Nie można teraz połączyć się z Notion. Wróć do Discorda i rozpocznij połączenie ponownie przez /notion connect.',
    )
  }
}

function registerRoutes(app) {
  app.all('/notion/oauth/callback', (request, response) => {
    handleCallback(request, response).catch(() => {
      console.error('[Notion OAuth] Callback request failed')
      if (!response.headersSent) {
        respond(response, 500, 'Wystąpił błąd połączenia', 'Wróć do Discorda i spróbuj ponownie przez /notion connect.')
      } else response.destroy()
    })
  })
}

function setCallbackAvailable(available) {
  callbackAvailable = available
  if (!available) sessions.clear()
}

module.exports = {
  createAuthorization,
  confirmAuthorization,
  cancelGuild,
  registerRoutes,
  setCallbackAvailable,
  validateConfiguration: auth.oauthConfiguration,
}
