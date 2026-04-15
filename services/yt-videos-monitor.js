const { EmbedBuilder } = require('discord.js')
const he = require('he')

const { getYouTubeConfig } = require('../config/youtube')
const DataStore = require('../utils/yt-cache')

class YTVideosMonitor {
  constructor(client, guildId) {
    this.client = client
    this.guildId = guildId
  }

  async checkNewVideos() {
    try {
      const config = await getYouTubeConfig(this.guildId)
      if (!config) {
        console.error(`[YT-Checker] No YouTube config found for guild ${this.guildId}`.yellow)
        return
      }

      const { youtube, notifications, youtubeChannel } = config
      const notificationChannelId = notifications?.newVideosChannelId

      if (!notificationChannelId) {
        console.error(`[YT-Checker] Guild #${this.guildId}: Missing newVideosChannelId in config`.yellow)
        return
      }

      const cachedVideos = await DataStore.getVideosCache(this.guildId)
      if (cachedVideos.length === 0) {
        console.log(`[YT-Checker] Guild #${this.guildId}: No cached videos, skipping videos check`.yellow)
        return
      }

      const data = await DataStore.getData(this.guildId)
      if (data.lastVideoId === null) {
        console.log(`[YT-Checker] Guild #${this.guildId}: lastVideoId not set, skipping videos check`.yellow)
        return
      }

      const videosResponse = await youtube.search.list({
        part: 'id,snippet',
        channelId: youtubeChannel.id,
        type: 'video',
        order: 'date',
        maxResults: 50, // max allowed by YouTube API
      })

      const items = videosResponse.data.items || []
      if (items.length === 0) return

      const cachedVideoIds = new Set(cachedVideos.map((v) => v.id))
      const newVideos = []

      for (const item of items) {
        const videoId = item.id.videoId

        if (videoId === data.lastVideoId) break

        if (!cachedVideoIds.has(videoId)) {
          newVideos.push({
            id: videoId,
            snippet: item.snippet,
          })
        }
      }

      for (const video of newVideos.reverse()) {
        await this._sendNotification(video, notificationChannelId, youtubeChannel)
        await DataStore.updateLastVideoId(this.guildId, video.id, video.snippet)
      }
    } catch (error) {
      console.error(`[YT-Checker] Guild #${this.guildId}: Error checking new videos:\n`.red, error.message)
    }
  }

  async _sendNotification(video, notificationChannelId, youtubeChannel) {
    const { snippet, id: videoId } = video
    const decodedTitle = he.decode(snippet.title)
    const thumbnailUrl = snippet.thumbnails.maxres?.url || snippet.thumbnails.high?.url || snippet.thumbnails.medium?.url

    const embed = new EmbedBuilder()
      .setColor('#eaaa6a')
      .setAuthor({
        name: youtubeChannel.snippet.title,
        iconURL: youtubeChannel.snippet.thumbnails.high.url,
      })
      .setTitle('Opublikowano nowy film! 🎬')
      .setURL(`https://www.youtube.com/watch?v=${videoId}`)
      .setThumbnail(thumbnailUrl)
      .setDescription(decodedTitle)
      .addFields({ name: 'Data', value: new Date(snippet.publishedAt).toLocaleString('pl-PL') })

    const guild = this.client.guilds.cache.get(this.guildId)
    if (!guild) return

    const channel = await guild.channels.fetch(notificationChannelId).catch(() => null)
    if (!channel) {
      console.error(`[YT-Checker] Guild #${this.guildId}: Notification channel not found!`.yellow)
      return
    }

    await channel.send({ embeds: [embed] })
  }
}

module.exports = YTVideosMonitor
