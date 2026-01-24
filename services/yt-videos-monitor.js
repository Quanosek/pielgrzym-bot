const he = require('he')
const { EmbedBuilder } = require('discord.js')

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

      const { youtube, channelId, notificationChannelId } = config
      const data = await DataStore.getData(this.guildId)
      const cachedVideos = await DataStore.getVideosCache(this.guildId)

      if (data.lastVideoId === null) {
        console.log(`[YT-Checker] Guild ${this.guildId}: lastVideoId not set, skipping check`.yellow)
        return
      }

      const videosResponse = await youtube.search.list({
        part: 'id,snippet',
        channelId,
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

      if (newVideos.length === 0) return

      console.log(`[YT-Checker] Guild ${this.guildId}: Found ${newVideos.length} new video(s)`.cyan)

      for (const video of newVideos.reverse()) {
        await this._sendVideoNotification(video, notificationChannelId)
        await DataStore.updateLastVideoId(this.guildId, video.id, video.snippet)
      }
    } catch (error) {
      console.error(`[YT-Checker] Guild ${this.guildId}: Error checking new videos:\n`.red, error.message)
    }
  }

  async _sendVideoNotification(video, notificationChannelId) {
    const { snippet, id: videoId } = video
    const decodedTitle = he.decode(snippet.title)
    const thumbnailUrl = snippet.thumbnails.maxres?.url || snippet.thumbnails.high?.url || snippet.thumbnails.medium?.url

    const embed = new EmbedBuilder()
      .setColor('#362834')
      .setTitle('🎬 Opublikowano nowy film!')
      .setDescription(`${decodedTitle}`)
      .setURL(`https://www.youtube.com/watch?v=${videoId}`)
      .setThumbnail(thumbnailUrl)
      .addFields({ name: 'Data', value: new Date(snippet.publishedAt).toLocaleString('pl-PL') })

    const channel = await this.client.channels.fetch(notificationChannelId)

    if (channel) {
      await channel.send({ embeds: [embed] })
    } else {
      console.error(`[YT-Checker] Guild ${this.guildId}: Notification channel not found!`.yellow)
    }
  }
}

module.exports = YTVideosMonitor
