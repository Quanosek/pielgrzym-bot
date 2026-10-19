const he = require('he')
const notion = require('../config/notion')
const GuildConfig = require('../utils/guild-config')
const store = require('../utils/notion-store')
const runGuildTask = require('../utils/yt-task')
const DataStore = require('../utils/yt-cache')
const auth = require('../utils/notion-auth')

async function enqueueVideos(guildId, videos, youtubeChannelId) {
  const config = (await GuildConfig.getConfig(guildId))?.notionIntegration
  if (!config?.enabled || config.youtubeChannelId !== youtubeChannelId) return

  await store.updateGuild(guildId, (state) => {
    let changed = false
    for (const video of videos) {
      const publishedAt = new Date(video.snippet?.publishedAt).getTime()
      if (!Number.isFinite(publishedAt) || publishedAt < config.monitoringStartedAt) continue
      const key = `${config.sourceId}:${video.id}`
      if (state.pending[key] || state.completed[key]) continue
      state.pending[key] = {
        sourceId: config.sourceId,
        fields: config.fields,
        youtubeChannelId,
        video: {
          id: video.id,
          title: he.decode(video.snippet.title),
          publishedAt: new Date(publishedAt).toISOString(),
          url: `https://www.youtube.com/watch?v=${video.id}`,
        },
        attempts: 0,
        nextAttemptAt: 0,
        uncertain: false,
      }
      changed = true
    }
    return changed
  })
}

async function flushGuild(guildId) {
  return runGuildTask(`notion:${guildId}`, async () => {
    const guild = await GuildConfig.getConfig(guildId)
    const config = guild?.notionIntegration
    if (!config?.enabled) return { delivered: 0, failed: 0 }
    const connection = await auth.getConnection(guildId)
    if (!connection || connection.workspaceId !== config.workspaceId) return { delivered: 0, failed: 0, paused: true }
    if (!guild?.ytMonitoring?.enabled || guild.ytMonitoring.youtubeChannel?.id !== config.youtubeChannelId) {
      return { delivered: 0, failed: 0, paused: true }
    }
    await enqueueVideos(guildId, await DataStore.getVideosCache(guildId), config.youtubeChannelId)
    if (config.historyPending) {
      await GuildConfig.updateGuildConfig(guildId, { notionIntegration: { ...config, historyPending: false } })
    }
    const state = await store.getGuild(guildId)
    let delivered = 0
    let failed = 0
    let source

    for (const [key, job] of Object.entries(state.pending)
      .filter(
        ([, entry]) => entry.sourceId === config.sourceId && entry.youtubeChannelId === config.youtubeChannelId && entry.nextAttemptAt <= Date.now(),
      )
      .slice(0, 5)) {
      try {
        source ||= await notion.getSource(guildId, job.sourceId)
        const fields = job.uncertain ? job.fields : config.fields
        let page = await notion.findVideo(guildId, job.sourceId, fields.url.id, job.video.url)
        if (!page && job.uncertain) {
          throw new Error('Previous Notion creation may have succeeded; manual verification is required before retrying')
        }
        if (!page) {
          notion.validateFields(source, fields)
          await store.updateGuild(guildId, (current) => {
            current.pending[key].uncertain = true
            current.pending[key].fields = fields
          })
          try {
            page = await notion.createVideo(guildId, job.sourceId, fields, job.video)
          } catch (error) {
            if ([400, 401, 403, 404, 429].includes(error.status)) {
              await store.updateGuild(guildId, (current) => {
                current.pending[key].uncertain = false
              })
            }
            throw error
          }
        }
        await store.updateGuild(guildId, (current) => {
          current.completed[key] = page.id
          delete current.pending[key]
        })
        delivered++
      } catch (error) {
        console.error(`[Notion] Guild #${guildId}: Delivery failed for video ${job.video.id}:`, error.message)
        await store.updateGuild(guildId, (current) => {
          const entry = current.pending[key]
          entry.attempts++
          entry.nextAttemptAt = Date.now() + Math.max(error.retryAfter || 0, Math.min(60 * 60_000, 60_000 * 2 ** Math.min(entry.attempts - 1, 6)))
          entry.lastError = error.message
        })
        failed++
        if (error.status === 429 || error.status === 401 || error.status === 403) break
      }
    }
    return { delivered, failed }
  })
}

module.exports = { enqueueVideos, flushGuild }
