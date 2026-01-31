const cron = require('node-cron')
const { Events } = require('discord.js')

const GuildConfig = require('../utils/guild-config')
const YTVideosMonitor = require('../services/yt-videos-monitor')
const YTCommentsMonitor = require('../services/yt-comments-monitor')

const timezone = 'America/Los_Angeles' // YouTube API uses Pacific Time

module.exports = {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    console.log('Bot ' + `${client.user.tag}`.rainbow + ' is ready to use!')

    // Get initial count of guilds with enabled YouTube monitoring
    const initialGuildConfigs = await GuildConfig.getConfig()
    const initialMonitoredCount = Object.entries(initialGuildConfigs).filter(([, config]) => config?.ytMonitoring?.enabled).length

    if (initialMonitoredCount === 0) {
      console.log('[YT-Checker] No guilds with enabled monitoring found.'.gray)
    } else {
      console.log(`[YT-Checker] Monitoring enabled for ${initialMonitoredCount} guild(s)`.cyan)
    }

    let monitoredGuildsCache = null
    let lastCacheUpdate = 0
    const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

    async function getMonitoredGuilds() {
      const now = Date.now()

      if (monitoredGuildsCache && now - lastCacheUpdate < CACHE_TTL) {
        return monitoredGuildsCache
      }

      const allGuildConfigs = await GuildConfig.getConfig()

      monitoredGuildsCache = Object.entries(allGuildConfigs)
        .filter(([, config]) => config?.ytMonitoring?.enabled)
        .map(([guildId]) => guildId)

      lastCacheUpdate = now
      return monitoredGuildsCache
    }

    // Check for new videos for all monitored guilds
    cron.schedule(
      '5 * * * *',
      async () => {
        console.log('[YT-Checker] 🎬 Checking for new videos'.gray)
        const monitoredGuilds = await getMonitoredGuilds()

        for (const guildId of monitoredGuilds) {
          const ytVideosMonitor = new YTVideosMonitor(client, guildId)
          await ytVideosMonitor.checkNewVideos()
        }
      },
      { timezone },
    )

    // Check for new comments for all monitored guilds
    cron.schedule(
      '1,31 * * * *',
      async () => {
        console.log('[YT-Checker] 💬 Checking for new comments'.gray)
        const monitoredGuilds = await getMonitoredGuilds()

        for (const guildId of monitoredGuilds) {
          const ytCommentsMonitor = new YTCommentsMonitor(client, guildId)
          await ytCommentsMonitor.checkNewComments()
        }
      },
      { timezone },
    )
  },
}
