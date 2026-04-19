const { EmbedBuilder, PermissionFlagsBits } = require('discord.js')
const he = require('he')

const { getYouTubeConfig } = require('../config/youtube')
const { formatNumber } = require('../utils/format-number')
const GuildConfig = require('../utils/guild-config')
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
        await this._incrementVideosCounter()
        this._scheduleOneHourSummary(video, notificationChannelId)
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

  async _incrementVideosCounter() {
    try {
      const guildConfig = await GuildConfig.getConfig(this.guildId)
      const currentVideoCount = Number(guildConfig?.ytMonitoring?.youtubeChannel?.statistics?.videoCount)
      const nextVideoCount = Number.isFinite(currentVideoCount) ? currentVideoCount + 1 : null

      if (nextVideoCount !== null) {
        await GuildConfig.updateGuildConfig(this.guildId, {
          ytMonitoring: {
            ...guildConfig?.ytMonitoring,
            youtubeChannel: {
              ...guildConfig?.ytMonitoring?.youtubeChannel,
              statistics: {
                ...guildConfig?.ytMonitoring?.youtubeChannel?.statistics,
                videoCount: String(nextVideoCount),
              },
            },
          },
        })
      }

      const videosChannelId = guildConfig?.ytMonitoring?.counters?.videosChannelId
      if (!videosChannelId || nextVideoCount === null) return

      const guild = this.client.guilds.cache.get(this.guildId)
      if (!guild) return

      const channel = await guild.channels.fetch(videosChannelId).catch(() => null)
      if (!channel) return

      const requiredPerms = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels]
      const permissions = channel.permissionsFor(guild.members.me)
      const missingPerms = requiredPerms.filter((perm) => !permissions.has(perm))
      if (missingPerms.length > 0) return

      const newName = `Filmy: ${formatNumber(nextVideoCount, { style: 'spaced' })}`
      await channel.setName(newName).catch((err) => {
        console.error(`[YT-Checker] Guild #${this.guildId}: Failed to rename videos counter channel:\n`.red, err.message)
      })
    } catch (error) {
      console.error(`[YT-Checker] Guild #${this.guildId}: Error incrementing videos counter:\n`.red, error.message)
    }
  }

  _scheduleOneHourSummary(video, notificationChannelId) {
    const publishedAt = new Date(video.snippet?.publishedAt).getTime()
    if (!Number.isFinite(publishedAt)) return

    const targetTime = publishedAt + 60 * 60 * 1000
    const delay = Math.max(0, targetTime - Date.now())

    setTimeout(() => {
      void this._sendOneHourSummary(video.id, notificationChannelId)
    }, delay)
  }

  async _sendOneHourSummary(videoId, notificationChannelId) {
    try {
      const config = await getYouTubeConfig(this.guildId)
      if (!config) return

      const { youtube } = config
      const videoResponse = await youtube.videos.list({
        part: 'snippet,statistics',
        id: videoId,
      })

      const videoItem = videoResponse?.data?.items?.[0]
      if (!videoItem) return

      const views = Number(videoItem?.statistics?.viewCount || 0)
      const likesRaw = videoItem?.statistics?.likeCount
      const likes = Number(likesRaw || 0)

      const decodedTitle = he.decode(videoItem?.snippet?.title || 'Nowy film')
      const thumbnailUrl =
        videoItem?.snippet?.thumbnails?.maxres?.url || videoItem?.snippet?.thumbnails?.high?.url || videoItem?.snippet?.thumbnails?.medium?.url

      const summaryEmbed = new EmbedBuilder()
        .setColor('#ff0033')
        .setTitle('⏰ Statystyki 1h po publikacji')
        .setURL(`https://www.youtube.com/watch?v=${videoId}`)
        .setDescription(`[${decodedTitle}](https://www.youtube.com/watch?v=${videoId})`)
        .setThumbnail(thumbnailUrl)
        .addFields(
          {
            name: '👁️ Wyświetlenia',
            value: formatNumber(views, { style: 'compact' }),
            inline: true,
          },
          {
            name: '💬 Komentarze',
            value: formatNumber(videoItem?.statistics?.commentCount || 0, { style: 'compact' }),
            inline: true,
          },
          {
            name: '👍 Łapki w górę',
            value: likesRaw ? formatNumber(likes, { style: 'compact' }) : 'Ukryte przez autora',
            inline: true,
          },
        )
        .setTimestamp()

      const guild = this.client.guilds.cache.get(this.guildId)
      if (!guild) return

      const channel = await guild.channels.fetch(notificationChannelId).catch(() => null)
      if (!channel) return

      await channel.send({ embeds: [summaryEmbed] })
    } catch (error) {
      console.error(`[YT-Checker] Guild #${this.guildId}: Error sending published video statistics summary:\n`.red, error.message)
    }
  }
}

module.exports = YTVideosMonitor
