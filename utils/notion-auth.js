const fs = require('node:fs/promises')
const path = require('node:path')
const { createCipheriv, createDecipheriv, randomBytes } = require('node:crypto')
const runGuildTask = require('./yt-task')

const AUTH_FILE = path.join(__dirname, '../data/notion-auth.min.json')
let writeQueue = Promise.resolve()

function encryptionKey() {
  const value = process.env.NOTION_TOKEN_ENCRYPTION_KEY || ''
  const key = Buffer.from(value, 'base64')
  if (key.length !== 32 || key.toString('base64') !== value) throw new Error('NOTION_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key')
  return key
}

function oauthConfiguration() {
  const clientId = process.env.NOTION_CLIENT_ID
  const clientSecret = process.env.NOTION_CLIENT_SECRET
  const redirectUri = process.env.NOTION_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) throw new Error('Notion OAuth configuration is incomplete')
  const url = new URL(redirectUri)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/notion/oauth/callback') {
    throw new Error('NOTION_REDIRECT_URI must be an HTTPS URL ending in /notion/oauth/callback without query parameters')
  }
  encryptionKey()
  return { clientId, clientSecret, redirectUri }
}

async function readCredentials() {
  try {
    const records = JSON.parse(await fs.readFile(AUTH_FILE, 'utf8'))
    if (!records || typeof records !== 'object' || Array.isArray(records)) throw new Error('Invalid encrypted Notion credentials')
    return records
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return {}
  }
}

function seal(guildId, connection) {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), nonce)
  cipher.setAAD(Buffer.from(guildId))
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(connection), 'utf8'), cipher.final()])
  return { nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') }
}

async function getConnection(guildId) {
  const records = await readCredentials()
  if (!Object.hasOwn(records, guildId)) return null
  try {
    const record = records[guildId]
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(record.nonce, 'base64'))
    decipher.setAAD(Buffer.from(guildId))
    decipher.setAuthTag(Buffer.from(record.tag, 'base64'))
    const plaintext = Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()])
    const connection = JSON.parse(plaintext.toString('utf8'))
    if (
      !connection ||
      ['accessToken', 'workspaceId', 'workspaceName', 'connectionId'].some((field) => typeof connection[field] !== 'string' || !connection[field]) ||
      (connection.refreshToken !== null && typeof connection.refreshToken !== 'string')
    )
      throw new Error('Invalid credential fields')
    return connection
  } catch {
    throw new Error('Cannot decrypt Notion credentials; verify the persistent encryption key and credential file')
  }
}

async function saveConnection(guildId, connection) {
  const pending = writeQueue.then(async () => {
    const records = await readCredentials()
    if (!connection && !Object.hasOwn(records, guildId)) return
    if (connection) records[guildId] = seal(guildId, connection)
    else delete records[guildId]
    await fs.mkdir(path.dirname(AUTH_FILE), { recursive: true })
    const temporaryFile = `${AUTH_FILE}.${process.pid}.tmp`
    await fs.writeFile(temporaryFile, JSON.stringify(records), { mode: 0o600 })
    await fs.rename(temporaryFile, AUTH_FILE)
  })
  writeQueue = pending.catch(() => {})
  return pending
}

async function exchangeToken(body) {
  const { clientId, clientSecret } = oauthConfiguration()
  let response
  try {
    response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2026-03-11',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
      redirect: 'error',
    })
  } catch {
    throw new Error('Notion OAuth token exchange failed; authorize again')
  }
  if (!response.ok) {
    await response.body?.cancel()
    const error = new Error(`Notion OAuth token exchange failed: HTTP ${response.status}`)
    error.status = response.status
    throw error
  }
  let token
  try {
    token = await response.json()
  } catch {
    throw new Error('Invalid Notion OAuth token response')
  }
  if (
    !token ||
    typeof token.access_token !== 'string' ||
    !token.access_token ||
    typeof token.workspace_id !== 'string' ||
    !token.workspace_id ||
    (token.refresh_token != null && (typeof token.refresh_token !== 'string' || !token.refresh_token)) ||
    (token.workspace_name != null && typeof token.workspace_name !== 'string')
  ) {
    throw new Error('Invalid Notion OAuth token response')
  }
  return token
}

async function accessToken(guildId) {
  const connection = await getConnection(guildId)
  if (!connection) {
    const error = new Error('This Discord guild has no Notion OAuth connection')
    error.code = 'NOTION_NOT_CONNECTED'
    throw error
  }
  return connection.accessToken
}

async function refreshAccessToken(guildId, rejectedToken) {
  return runGuildTask(`notion-auth:${guildId}`, async () => {
    const connection = await getConnection(guildId)
    if (!connection) return accessToken(guildId)
    if (connection.accessToken !== rejectedToken) return connection.accessToken
    if (!connection.refreshToken) {
      const error = new Error('Notion authorization expired; reconnect through Discord')
      error.status = 401
      throw error
    }
    const token = await exchangeToken({ grant_type: 'refresh_token', refresh_token: connection.refreshToken })
    if (token.workspace_id !== connection.workspaceId) throw new Error('Notion token refresh returned a different workspace')
    await saveConnection(guildId, {
      ...connection,
      accessToken: token.access_token,
      refreshToken: token.refresh_token || connection.refreshToken,
    })
    return token.access_token
  })
}

module.exports = { oauthConfiguration, getConnection, saveConnection, exchangeToken, accessToken, refreshAccessToken }
