const { EmbedBuilder } = require('discord.js')
const he = require('he')
const moment = require('moment')

const { getYouTubeConfig } = require('../config/youtube')
const DataStore = require('../utils/yt-cache')

class YTCommentsMonitor {
  constructor(client, guildId) {
    this.client = client
    this.guildId = guildId
  }

  async checkNewComments() {
    try {
      const config = await getYouTubeConfig(this.guildId)
      if (!config) {
        console.error(`[YT-Checker] No YouTube config found for guild ${this.guildId}`.yellow)
        return
      }

      const { youtube, channelId, notificationChannelId, setupDate } = config

      const cachedVideos = await DataStore.getVideosCache(this.guildId)
      if (cachedVideos.length === 0) {
        console.log(`[YT-Checker] Guild #${this.guildId}: No cached videos, skipping comments check`.yellow)
        return
      }

      let data = await DataStore.getData(this.guildId)
      if (!data.lastCommentsCheck) data.lastCommentsCheck = {}

      const now = Date.now()

      const newestVideos = cachedVideos.slice(0, 100)
      const olderVideosSorted = cachedVideos
        .slice(100)
        .map((video) => ({
          ...video,
          lastCheck: data.lastCommentsCheck[video.id] || 0,
        }))
        .sort((a, b) => a.lastCheck - b.lastCheck)
      const olderVideos = olderVideosSorted.slice(0, Math.ceil(olderVideosSorted.length / 48) || 1)

      const videosToCheck = [...newestVideos, ...olderVideos]
      const allNewComments = []

      for (const video of videosToCheck) {
        const newComments = await this._getNewCommentsForVideo(video.id, video.snippet.title, setupDate, youtube)
        allNewComments.push(...newComments)
        data.lastCommentsCheck[video.id] = now
      }

      await DataStore._updateGuildData(this.guildId, { lastCommentsCheck: data.lastCommentsCheck })

      allNewComments.sort((a, b) => new Date(a.comment.publishedAt) - new Date(b.comment.publishedAt))

      for (const { commentId, comment, videoId, videoTitle } of allNewComments) {
        await this._sendNotification(commentId, comment, videoId, videoTitle, channelId, notificationChannelId)
        await DataStore.addSeenComment(this.guildId, commentId)
      }
    } catch (error) {
      console.error(`[YT-Checker] Guild #${this.guildId}: Error checking comments:\n`.red, error.message)
    }
  }

  async _getNewCommentsForVideo(videoId, videoTitle, setupDate, youtube) {
    try {
      const commentsResponse = await youtube.commentThreads.list({
        part: 'snippet',
        videoId,
        order: 'time',
        maxResults: 100, // max allowed by YouTube API
      })

      const items = commentsResponse.data.items || []
      if (items.length === 0) return []

      const data = await DataStore.getData(this.guildId)
      const newComments = []

      for (const item of items) {
        const commentId = item.id
        const comment = item.snippet.topLevelComment.snippet

        if (data.seenComments.includes(commentId)) continue

        if (moment(comment.publishedAt).isBefore(moment(setupDate))) {
          await DataStore.addSeenComment(this.guildId, commentId)
          continue
        }

        newComments.push({
          commentId,
          comment,
          videoId,
          videoTitle,
        })
      }

      return newComments
    } catch (error) {
      if (error.code === 403 && error.message.includes('disabled comments')) return []
      console.error(`[YT-Checker] Guild #${this.guildId}: Error checking comments for video id=${videoId}:\n`.red, error.message)
      return []
    }
  }

  async _sendNotification(commentId, comment, videoId, videoTitle, channelId, notificationChannelId) {
    const decodedText = he
      .decode(comment.textDisplay)
      .replace(/<a[^>]*>(.*?)<\/a>/gi, '$1')
      .replace(/(<br\s*\/?>\s*)+/gi, '; ')

    const EMBED_DESCRIPTION_LIMIT = 4096 - 5
    const commentText = decodedText.length > EMBED_DESCRIPTION_LIMIT ? decodedText.substring(0, EMBED_DESCRIPTION_LIMIT) + '...' : decodedText

    const isChannelAuthor = comment.authorChannelId && comment.authorChannelId.value === channelId

    const embed = new EmbedBuilder()
      .setColor(isChannelAuthor ? '#ff0033' : '#eaaa6a')
      .setAuthor({
        name: comment.authorDisplayName,
        iconURL: comment.authorProfileImageUrl,
      })
      .setTitle('Pojawił się nowy komentarz! 💬')
      .setURL(`https://www.youtube.com/watch?v=${videoId}&lc=${commentId}`)
      .setDescription(`"${commentText}"`)
      .addFields(
        { name: 'Film', value: `[${videoTitle}](https://www.youtube.com/watch?v=${videoId})` },
        { name: 'Data', value: new Date(comment.publishedAt).toLocaleString('pl-PL') },
      )

    const channel = await this.client.channels.fetch(notificationChannelId)

    if (channel) {
      await channel.send({ embeds: [embed] })
    } else {
      console.error(`[YT-Checker] Guild #${this.guildId}: Notification channel not found!`.yellow)
    }
  }
}

module.exports = YTCommentsMonitor
