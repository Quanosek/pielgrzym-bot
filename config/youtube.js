const { setTimeout: delay } = require('node:timers/promises')
const GuildConfig = require('../utils/guild-config')

async function list(resource, params) {
  if (!process.env.YOUTUBE_API_KEY) throw new Error('Missing YOUTUBE_API_KEY')

  const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`)
  url.searchParams.set('key', process.env.YOUTUBE_API_KEY)

  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(name, Array.isArray(value) ? value.join(',') : String(value))
    }
  }

  for (let attempt = 0; ; attempt++) {
    let response
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    } catch (error) {
      if (attempt >= 3) throw error
      await delay(100 * 2 ** attempt)
      continue
    }

    if (attempt < 3 && (response.status === 408 || response.status === 429 || response.status >= 500)) {
      await response.body?.cancel()
      await delay(100 * 2 ** attempt)
      continue
    }

    if (!response.ok) {
      const body = await response.text()
      let data
      try {
        data = JSON.parse(body)
      } catch (cause) {
        const error = new Error(`YouTube API request failed: HTTP ${response.status} ${response.statusText}`, { cause })
        error.code = response.status
        throw error
      }
      const error = new Error(data.error?.message || `YouTube API request failed: HTTP ${response.status}`)
      error.code = response.status
      error.errors = data.error?.errors || []
      throw error
    }

    return { data: await response.json() }
  }
}

function isQuotaError(error) {
  return error?.errors?.some(({ reason }) => reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') === true
}

const youtube = Object.fromEntries(
  ['channels', 'playlistItems', 'videos', 'commentThreads', 'comments'].map((resource) => [resource, { list: (params) => list(resource, params) }]),
)

function getUploadsPlaylistId(channelId) {
  if (typeof channelId !== 'string' || !channelId.startsWith('UC')) return null
  return 'UU' + channelId.slice(2)
}

async function getYouTubeConfig(guildId) {
  const config = await GuildConfig.getConfig(guildId)
  if (!config?.ytMonitoring?.enabled) return null

  const { ytMonitoring } = config || {}

  return {
    youtube,
    counters: ytMonitoring.counters,
    notifications: ytMonitoring.notifications,
    setupDate: ytMonitoring.setupDate,
    youtubeChannel: ytMonitoring.youtubeChannel,
  }
}

module.exports = {
  youtube,
  isQuotaError,
  getYouTubeConfig,
  getUploadsPlaylistId,
}
