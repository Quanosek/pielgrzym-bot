const { setTimeout: delay } = require('node:timers/promises')
const auth = require('../utils/notion-auth')

const NOTION_VERSION = '2026-03-11'
let requestQueue = Promise.resolve()
let nextRequestAt = 0

async function request(guildId, endpoint, method = 'GET', body) {
  const pending = requestQueue
    .catch(() => {})
    .then(async () => {
      await delay(Math.max(0, nextRequestAt - Date.now()))
      nextRequestAt = Date.now() + 350

      let token = await auth.accessToken(guildId)
      let response
      try {
        const send = () =>
          fetch(`https://api.notion.com/v1/${endpoint}`, {
            method,
            headers: {
              Authorization: `Bearer ${token}`,
              'Notion-Version': NOTION_VERSION,
              'Content-Type': 'application/json',
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(30_000),
            redirect: 'error',
          })
        response = await send()
        if (response.status === 401) {
          await response.body?.cancel()
          token = await auth.refreshAccessToken(guildId, token)
          response = await send()
        }
      } catch (cause) {
        if (cause.status || cause.code === 'NOTION_NOT_CONNECTED') throw cause
        throw new Error('Notion request failed before a response was received', { cause })
      }

      if (!response.ok) {
        const error = new Error(`Notion API request failed: HTTP ${response.status}`)
        error.status = response.status
        if (response.status === 429) {
          const seconds = Number(response.headers.get('retry-after'))
          error.retryAfter = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds * 1000) : 60_000
          nextRequestAt = Date.now() + error.retryAfter
        }
        await response.body?.cancel()
        throw error
      }

      return response.json()
    })
  requestQueue = pending.catch(() => {})
  return pending
}

function parseSourceId(input) {
  let value = input.trim()
  if (/^https?:/i.test(value)) {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !['notion.so', 'www.notion.so', 'notion.com', 'www.notion.com', 'app.notion.com'].includes(url.hostname)) {
      throw new Error('Expected an HTTPS Notion URL')
    }
    value = url.pathname.split('/').filter(Boolean).at(-1) || ''
  }
  const match = value.match(/(?:^|-)([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i)
  if (!match) throw new Error('Invalid Notion database or data source ID')
  const id = match[1].replaceAll('-', '').toLowerCase()
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`
}

async function resolveSources(guildId, input) {
  const id = parseSourceId(input)
  try {
    const database = await request(guildId, `databases/${id}`)
    if (!Array.isArray(database.data_sources) || !database.data_sources.length) throw new Error('Notion database contains no data sources')
    return database.data_sources.map((source) => ({ id: source.id, name: source.name || source.id }))
  } catch (error) {
    if (error.status !== 404) throw error
    const source = await getSource(guildId, id)
    return [{ id: source.id, name: source.title?.map((text) => text.plain_text || text.text?.content || '').join('') || source.id }]
  }
}

async function getSource(guildId, id) {
  const source = await request(guildId, `data_sources/${encodeURIComponent(id)}`)
  if (!source.id || !source.properties) throw new Error('Invalid Notion data source response')
  return source
}

function validateFields(source, fields) {
  for (const [role, type] of [
    ['title', 'title'],
    ['date', 'date'],
    ['url', 'url'],
    ['status', null],
  ]) {
    const field = fields?.[role]
    if (role === 'status' && !field) continue
    const property = Object.values(source.properties).find((entry) => entry.id === field?.id)
    if (!property || (type ? property.type !== type : !['status', 'select'].includes(property.type))) {
      throw new Error(`Missing or incompatible Notion ${role} property`)
    }
    if (role === 'status' && !property[property.type].options.some((option) => option.id === field.optionId)) {
      throw new Error('The configured Notion status option no longer exists')
    }
  }
}

async function findVideo(guildId, sourceId, urlPropertyId, videoUrl) {
  const result = await request(guildId, `data_sources/${encodeURIComponent(sourceId)}/query`, 'POST', {
    filter: { property: urlPropertyId, url: { equals: videoUrl } },
    page_size: 1,
  })
  if (!Array.isArray(result.results)) throw new Error('Invalid Notion query response')
  if (result.results.length && !result.results[0].id) throw new Error('Notion query returned a page without an ID')
  return result.results[0] || null
}

async function createVideo(guildId, sourceId, fields, video) {
  const dateParts = Object.fromEntries(
    new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Warsaw',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'longOffset',
    })
      .formatToParts(new Date(video.publishedAt))
      .map(({ type, value }) => [type, value]),
  )
  const publicationDate = `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}${dateParts.timeZoneName.replace('GMT', '')}`
  const properties = {
    [fields.title.id]: { title: [{ text: { content: video.title.slice(0, 2000) } }] },
    [fields.date.id]: { date: { start: publicationDate } },
    [fields.url.id]: { url: video.url },
  }
  if (fields.status) {
    properties[fields.status.id] = { [fields.status.type]: { id: fields.status.optionId } }
  }
  const page = await request(guildId, 'pages', 'POST', {
    parent: { type: 'data_source_id', data_source_id: sourceId },
    properties,
  })
  if (!page.id) throw new Error('Notion page creation returned no page ID')
  return page
}

function userError(error) {
  if (error.code === 'NOTION_NOT_CONNECTED') return 'Ten serwer nie ma połączenia Notion. Użyj `/notion connect`.'
  if (error.status === 401)
    return 'Autoryzacja Notion wygasła lub została cofnięta. Użyj `/notion connect`, aby ponownie połączyć przestrzeń roboczą.'
  if (error.status === 403) return 'Integracja Notion nie ma wymaganych uprawnień do odczytu lub tworzenia wpisów.'
  if (error.status === 404) {
    return 'Nie znaleziono dostępnej bazy. Udostępnij integracji oryginalną bazę i skopiuj jej link lub identyfikator źródła danych, nie zwykłej strony ani połączonego widoku.'
  }
  if (error.status === 429) return 'Notion ogranicza liczbę zapytań. Poczekaj chwilę i spróbuj ponownie.'
  return 'Nie udało się wykonać operacji Notion. Sprawdź link, uprawnienia i zgodność kolumn, a następnie spróbuj ponownie.'
}

module.exports = { resolveSources, getSource, validateFields, findVideo, createVideo, userError }
