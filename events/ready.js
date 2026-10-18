const cron = require('node-cron')
const { Events } = require('discord.js')
const GuildConfig = require('../utils/guild-config')
const runGuildTask = require('../utils/yt-task')

const YTVideosMonitor = require('../services/yt-videos-monitor')
const YTCommentsMonitor = require('../services/yt-comments-monitor')
const YTVideosCache = require('../services/yt-videos-cache')
const YTSubsCounterMonitor = require('../services/yt-subs-counter-monitor')
const YTViewsCounterMonitor = require('../services/yt-views-counter-monitor')
const YTVideosCounterMonitor = require('../services/yt-videos-counter-monitor')

const TIMEZONE = 'America/Los_Angeles'
const hourFormatter = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, hour: '2-digit', hourCycle: 'h23' })

module.exports = {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    console.log('Bot ' + `${client.user.tag}`.rainbow + ' is ready to use!')

    const initialGuildConfigs = await GuildConfig.getConfig()
    const initialMonitoredCount = Object.values(initialGuildConfigs).filter((config) => config?.ytMonitoring?.enabled).length
    console.info(`[YT-Checker] Monitoring enabled for ${initialMonitoredCount} guild(s)`)

    function schedule(expression, name, operation) {
      cron.schedule(
        expression,
        async ({ date }) => {
          const started = performance.now()
          try {
            const configs = await GuildConfig.getConfig()
            for (const [guildId, config] of Object.entries(configs)) {
              if (!config?.ytMonitoring?.enabled) continue
              try {
                await operation(guildId, date)
              } catch (error) {
                console.error(`[YT-Checker] ${name} failed for guild #${guildId}:`, error.message)
              }
            }
          } finally {
            console.info(`[YT-Checker] ${name} finished in ${Math.round(performance.now() - started)}ms`)
          }
        },
        { timezone: TIMEZONE, noOverlap: true, name },
      )
    }

    schedule('0 4 * * *', 'refresh-videos-cache', (guildId) => new YTVideosCache(client, guildId).refreshVideosCache())
    schedule('*/10 * * * *', 'check-new-videos', (guildId) => new YTVideosMonitor(client, guildId).checkNewVideos())
    schedule('*/30 * * * *', 'check-new-comments', (guildId) => new YTCommentsMonitor(client, guildId).checkNewComments())
    schedule('0 9 * * *', 'diagnose-old-videos', (guildId) => new YTCommentsMonitor(client, guildId).checkOldVideosDiagnostic())
    schedule('0 * * * *', 'update-channel-statistics', (guildId, date) =>
      runGuildTask(guildId, async () => {
        const monitor = new YTSubsCounterMonitor(client, guildId)
        const item = await monitor.updateChannelStatistics()
        if (!item) {
          console.error(`[YT-Checker] Guild #${guildId}: No channel statistics returned; skipping counters`)
          return
        }
        await monitor.updateSubscriberCount(false)
        if (hourFormatter.format(date) === '00') {
          await new YTViewsCounterMonitor(client, guildId).updateViewsCount(false)
          await new YTVideosCounterMonitor(client, guildId).updateVideosCount(false)
        }
      }),
    )
  },
}
