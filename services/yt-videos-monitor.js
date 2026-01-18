const he = require('he')
const { EmbedBuilder } = require('discord.js')

const { notificationChannelId } = require('../config/youtube')
const DataStore = require('../utils/yt-cache')

class YTVideosMonitor {
  constructor(client) {
    this.client = client
  }

  async checkNewVideos() {
    try {
      const { videos } = await DataStore.getVideosCache()

      if (!videos || videos.length === 0) return

      const latestVideo = videos[0]
      const data = await DataStore.getData()

      if (data.lastVideoId === null) {
        await DataStore.updateLastVideoId(latestVideo.id, latestVideo.snippet)
        return
      }

      if (latestVideo.id !== data.lastVideoId) {
        await this._sendVideoNotification(latestVideo)
        await DataStore.updateLastVideoId(latestVideo.id, latestVideo.snippet)
      }
    } catch (error) {
      console.error('[YT-Checker] Error checking new videos:\n'.red, error.message)
    }
  }

  async _sendVideoNotification(video) {
    const snippet = video.snippet
    const decodedTitle = he.decode(snippet.title)
    const videoId = video.id

    const embed = new EmbedBuilder()
      .setColor('#362834')
      .setTitle('🎬 Opublikowano nowy film!')
      .setDescription(`${decodedTitle}`)
      .setURL(`https://www.youtube.com/watch?v=${videoId}`)
      .setThumbnail(snippet.thumbnails.high.url)
      .addFields({ name: 'Data', value: new Date(snippet.publishedAt).toLocaleString('pl-PL') })

    const channel = await this.client.channels.fetch(notificationChannelId)

    if (channel) {
      await channel.send({ embeds: [embed] })
    } else {
      console.error('[YT-Checker] Notification channel not found!'.yellow)
    }
  }
}

module.exports = YTVideosMonitor
