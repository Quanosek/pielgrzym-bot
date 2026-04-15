const { google } = require('googleapis')
const GuildConfig = require('../utils/guild-config')

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
})

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
  getYouTubeConfig,
}
