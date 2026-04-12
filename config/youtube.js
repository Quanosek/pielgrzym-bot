const { google } = require('googleapis')
const GuildConfig = require('../utils/guild-config')

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
})

async function getYouTubeConfig(guildId) {
  const guildConfig = await GuildConfig.getConfig(guildId)

  if (!guildConfig?.ytMonitoring?.enabled) {
    return null
  }

  const { ytMonitoring } = guildConfig

  return {
    youtube,
    channelId: ytMonitoring.youtubeChannel.id,
    notificationChannelId: ytMonitoring.notificationChannelId,
    setupDate: ytMonitoring.setupDate,
    youtubeChannel: ytMonitoring.youtubeChannel,
  }
}

module.exports = {
  youtube,
  getYouTubeConfig,
}
