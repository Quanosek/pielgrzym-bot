const { EmbedBuilder, PermissionFlagsBits } = require('discord.js')
const he = require('he')

const { getYouTubeConfig, getUploadsPlaylistId } = require('../config/youtube')
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

      const { youtube, notifications, setupDate, youtubeChannel } = config
      const setupDateMs = this._resolveSetupDateMs(setupDate)
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

      const uploadsPlaylistId = getUploadsPlaylistId(youtubeChannel.id)
      if (!uploadsPlaylistId) {
        console.error(`[YT-Checker] Guild #${this.guildId}: Could not derive uploads playlist for channel ${youtubeChannel.id}`.yellow)
        return
      }

      // fetch latest uploads page
      const videosResponse = await youtube.playlistItems.list({
        part: 'snippet,contentDetails',
        playlistId: uploadsPlaylistId,
        maxResults: 50,
      })

      const items = videosResponse.data.items || []
      if (items.length === 0) return

      // fast lookup for dedup
      const cachedVideoIds = new Set(cachedVideos.map((v) => v.id))
      const fetchedVideos = items.map((item) => {
        const videoPublishedAt = item.contentDetails.videoPublishedAt || item.snippet.publishedAt
        return {
          id: item.contentDetails.videoId,
          snippet: {
            ...item.snippet,
            publishedAt: videoPublishedAt,
          },
        }
      })

      // skip already-cached or pre-setup videos
      const newVideos = fetchedVideos.filter((video) => {
        const publishedAtMs = new Date(video.snippet.publishedAt).getTime()
        const isAfterSetup = !Number.isFinite(publishedAtMs) || setupDateMs <= 0 || publishedAtMs >= setupDateMs
        return isAfterSetup && !cachedVideoIds.has(video.id)
      })

      if (newVideos.length === 0) return

      // oldest first
      for (const video of newVideos.reverse()) {
        await this._sendNotification(video, notificationChannelId, youtubeChannel)
        await this._incrementVideosCounter()
        this._scheduleStatsSummary(video, notificationChannelId)
      }

      // prepend new, dedupe existing
      const newVideoIds = new Set(newVideos.map((video) => video.id))
      const mergedCache = [...newVideos, ...cachedVideos.filter((video) => !newVideoIds.has(video.id))]
      await DataStore.updateVideosCache(this.guildId, mergedCache)
    } catch (error) {
      console.error(`[YT-Checker] Guild #${this.guildId}: Error checking new videos:\n`.red, error.message)
    }
  }

  async _sendNotification(video, notificationChannelId, youtubeChannel) {
    const { snippet, id: videoId } = video
    const thumbnailUrl = this._getThumbnailUrl(snippet)
    const decodedTitle = he.decode(snippet.title)
    const formattedTimestamp = this._formatDiscordTimestamp(snippet.publishedAt)

    const embed = new EmbedBuilder()
      .setColor('#ecb172')
      .setAuthor({
        name: youtubeChannel.snippet.title,
        iconURL: youtubeChannel.snippet.thumbnails.medium.url,
      })
      .setTitle('Opublikowano nowy film! 🎬')
      .setURL(`https://www.youtube.com/watch?v=${videoId}`)
      .setThumbnail(thumbnailUrl)
      .setDescription(decodedTitle)
      .addFields({ name: 'Data dodania', value: formattedTimestamp })

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

  _scheduleStatsSummary(video, notificationChannelId) {
    const publishedAt = new Date(video.snippet?.publishedAt).getTime()
    if (!Number.isFinite(publishedAt)) return

    // delay to 45 min after publish
    const targetTime = publishedAt + 45 * 60 * 1000
    const delay = Math.max(0, targetTime - Date.now())

    setTimeout(() => {
      void this._sendStatsSummary(video.id, publishedAt, notificationChannelId)
    }, delay)
  }

  _formatElapsed(ms) {
    const totalMinutes = Math.floor(ms / 60000)
    const days = Math.floor(totalMinutes / 1440)
    const hours = Math.floor((totalMinutes % 1440) / 60)
    const minutes = totalMinutes % 60

    if (days > 0) {
      return [`${days}d`, hours > 0 ? `${hours}h` : null, minutes > 0 ? `${minutes}min` : null].filter(Boolean).join(' ')
    }

    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`
    }

    return `${Math.max(1, totalMinutes)}min`
  }

  _resolveSetupDateMs(setupDate) {
    const numeric = Number(setupDate)
    if (Number.isFinite(numeric) && numeric > 0) return numeric

    const parsed = new Date(setupDate).getTime()
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }

  async _sendStatsSummary(videoId, publishedAt, notificationChannelId) {
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

      const snippet = videoItem?.snippet || {}
      const decodedTitle = he.decode(snippet?.title || 'Nowy film')
      const thumbnailUrl = this._getThumbnailUrl(snippet)

      const views = Number(videoItem?.statistics?.viewCount || 0)
      const comments = Number(videoItem?.statistics?.commentCount || 0)
      const likesRaw = videoItem?.statistics?.likeCount
      const likes = Number(likesRaw || 0)

      const elapsedLabel = this._formatElapsed(Date.now() - publishedAt)

      const summaryEmbed = new EmbedBuilder()
        .setColor('#ff0033')
        .setTitle(`⏰ Statystyki ${elapsedLabel} po publikacji`)
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
            value: formatNumber(comments, { style: 'compact' }),
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

  _formatDiscordTimestamp(dateInput) {
    const timestampMs = new Date(dateInput).getTime()
    if (!Number.isFinite(timestampMs)) return 'Brak daty'
    const timestampSeconds = Math.floor(timestampMs / 1000)
    return `<t:${timestampSeconds}:F> • <t:${timestampSeconds}:R>`
  }

  _getThumbnailUrl(snippet) {
    return snippet?.thumbnails?.medium?.url || snippet?.thumbnails?.high?.url || snippet?.thumbnails?.default?.url
  }
}

module.exports = YTVideosMonitor
