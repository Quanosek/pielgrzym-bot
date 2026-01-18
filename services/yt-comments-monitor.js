const he = require('he')
const moment = require('moment')
const { EmbedBuilder } = require('discord.js')

const { youtube, channelId, notificationChannelId, setupDate } = require('../config/youtube')
const DataStore = require('../utils/yt-cache')

class YTCommentsMonitor {
  constructor(client) {
    this.client = client
  }

  async checkNewComments() {
    try {
      const { videos } = await DataStore.getVideosCache()

      if (!videos || videos.length === 0) return

      for (const video of videos) {
        await this._checkCommentsForVideo(video.id, video.snippet.title)
      }
    } catch (error) {
      console.error('[YT-Checker] Error checking comments:\n'.red, error.message)
    }
  }

  async _checkCommentsForVideo(videoId, videoTitle) {
    try {
      const commentsResponse = await youtube.commentThreads.list({
        part: 'snippet',
        videoId,
        order: 'time',
        maxResults: 100, // max allowed by YouTube API
      })

      const items = commentsResponse.data.items
      if (!items || items.length === 0) return

      const data = await DataStore.getData()

      for (const item of items) {
        const commentId = item.id
        const comment = item.snippet.topLevelComment.snippet

        if (!data.seenComments.includes(commentId) && moment(comment.publishedAt).isSameOrAfter(moment(setupDate))) {
          await this._sendCommentNotification(commentId, comment, videoId, videoTitle)
          await DataStore.addSeenComment(commentId)
        }
      }
    } catch (error) {
      if (error.code === 403 && error.message.includes('disabled comments')) return
      console.error(`[YT-Checker] Error checking comments for ${videoId}:\n`.red, error.message)
    }
  }

  async _sendCommentNotification(commentId, comment, videoId, videoTitle) {
    const decodedText = he
      .decode(comment.textDisplay)
      .replace(/<a[^>]*>(.*?)<\/a>/gi, '$1')
      .replace(/(<br\s*\/?>\s*)+/gi, '; ')

    const EMBED_DESCRIPTION_LIMIT = 4096 - 5 // max discord embed description length
    const commentText = decodedText.length > EMBED_DESCRIPTION_LIMIT ? decodedText.substring(0, EMBED_DESCRIPTION_LIMIT) + '...' : decodedText

    const isChannelAuthor = comment.authorChannelId && comment.authorChannelId.value === channelId

    const embed = new EmbedBuilder()
      .setColor(isChannelAuthor ? '#ff0033' : '#eaaa6a')
      .setAuthor({
        name: comment.authorDisplayName,
        iconURL: comment.authorProfileImageUrl,
      })
      .setTitle('💬 Pojawił się nowy komentarz!')
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
      console.error('[YT-Checker] Notification channel not found!'.yellow)
    }
  }
}

module.exports = YTCommentsMonitor
