const cron = require('node-cron')
const { Events } = require('discord.js')
const GuildConfig = require('../utils/guild-config')

const YTVideosMonitor = require('../services/yt-videos-monitor')
const YTCommentsMonitor = require('../services/yt-comments-monitor')

const YTSubsCounterMonitor = require('../services/yt-subs-counter-monitor')
const YTViewsCounterMonitor = require('../services/yt-views-counter-monitor')
const YTVideosCounterMonitor = require('../services/yt-videos-counter-monitor')

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

    // Fetch monitored guilds
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

    // Check for new YouTube videos
    cron.schedule(
      '5 * * * *',
      async () => {
        console.log('[YT-Checker] 🎬 Checking for new videos'.gray)
        const monitoredGuilds = await getMonitoredGuilds()

        for (const guildId of monitoredGuilds) {
          const monitor = new YTVideosMonitor(client, guildId)
          await monitor.checkNewVideos()
        }
      },
      { timezone },
    )

    // Check for new YouTube comments
    cron.schedule(
      '1,31 * * * *',
      async () => {
        console.log('[YT-Checker] 💬 Checking for new comments'.gray)
        const monitoredGuilds = await getMonitoredGuilds()

        for (const guildId of monitoredGuilds) {
          const monitor = new YTCommentsMonitor(client, guildId)
          await monitor.checkNewComments()
        }
      },
      { timezone },
    )

    // Check YouTube channel basic statistics (and subscriber count)
    cron.schedule(
      '0 * * * *',
      async () => {
        console.log('[YT-Checker] 📊 Updating subscriber count'.gray)
        const monitoredGuilds = await getMonitoredGuilds()

        for (const guildId of monitoredGuilds) {
          const monitor = new YTSubsCounterMonitor(client, guildId)
          await monitor.updateSubscriberCount()
        }
      },
      { timezone },
    )

    // Update voice channel views counter
    cron.schedule(
      '0 0 * * *',
      async () => {
        console.log('[YT-Checker] 📊 Updating views count'.gray)
        const monitoredGuilds = await getMonitoredGuilds()

        for (const guildId of monitoredGuilds) {
          const monitor = new YTViewsCounterMonitor(client, guildId)
          await monitor.updateViewsCount()
        }
      },
      { timezone },
    )

    // Update voice channel videos counter
    cron.schedule(
      '0 0 * * *',
      async () => {
        console.log('[YT-Checker] 📊 Updating videos count'.gray)
        const monitoredGuilds = await getMonitoredGuilds()

        for (const guildId of monitoredGuilds) {
          const monitor = new YTVideosCounterMonitor(client, guildId)
          await monitor.updateVideosCount()
        }
      },
      { timezone },
    )
  },
}
