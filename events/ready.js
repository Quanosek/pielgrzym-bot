const cron = require('node-cron')
const { Events } = require('discord.js')

const YTVideosCache = require('../services/yt-videos-cache')
const YTVideosMonitor = require('../services/yt-videos-monitor')
const YTCommentsMonitor = require('../services/yt-comments-monitor')

const timezone = 'America/Los_Angeles' // YouTube API uses Pacific Time

module.exports = {
  name: Events.ClientReady,
  once: true,

  execute(client) {
    console.log('Bot ' + `${client.user.tag}`.rainbow + ' is ready to use!')

    const ytVideosCache = new YTVideosCache(client)
    cron.schedule(
      '0 0 1/14 * *',
      async () => {
        console.log('[YT-Checker] 🔄 Refreshing videos cache...'.gray)
        await ytVideosCache.refreshVideosCache()
      },
      { timezone },
    )

    const ytVideosMonitor = new YTVideosMonitor(client)
    cron.schedule(
      '1 * * * *',
      async () => {
        console.log('[YT-Checker] 🎬 Checking for new videos...'.gray)
        await ytVideosMonitor.checkNewVideos()
      },
      { timezone },
    )

    const ytCommentsMonitor = new YTCommentsMonitor(client)
    cron.schedule(
      '1,20,40 * * * *',
      async () => {
        console.log('[YT-Checker] 💬 Checking for new comments...'.gray)
        await ytCommentsMonitor.checkNewComments()
      },
      { timezone },
    )
  },
}
