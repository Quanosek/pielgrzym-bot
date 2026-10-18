const { EmbedBuilder } = require('discord.js')
const he = require('he')

const { getYouTubeConfig, isQuotaError } = require('../config/youtube')
const DataStore = require('../utils/yt-cache')
const runGuildTask = require('../utils/yt-task')

const EMBED_DESCRIPTION_LIMIT = 4096 - 5
const MAX_TRACKED_COMMENT_IDS = 10000
const FULL_SCAN_MAX_VIDEOS = 100 // Include the latest videos regardless of age
const FULL_SCAN_AGE_DAYS = 60 // Include all videos within this age limit
const FULL_SCAN_AGE_MS = FULL_SCAN_AGE_DAYS * 24 * 60 * 60 * 1000

class YTCommentsMonitor {
  constructor(client, guildId) {
    this.client = client
    this.guildId = guildId
  }

  async checkNewComments() {
    return runGuildTask(this.guildId, () => this._checkNewComments())
  }

  async _checkNewComments() {
    try {
      const config = await getYouTubeConfig(this.guildId)
      if (!config) {
        console.error(`[YT-Checker] No YouTube config found for guild ${this.guildId}`.yellow)
        return
      }

      const { youtube, notifications, setupDate, youtubeChannel } = config
      const setupDateMs = this._resolveSetupDateMs(setupDate)
      const notificationChannelId = notifications?.activityChannelId

      if (!notificationChannelId) {
        console.error(`[YT-Checker] Guild #${this.guildId}: Missing activityChannelId in config`.yellow)
        return
      }

      const data = await DataStore.getData(this.guildId)
      const cachedVideos = data.videosCache
      if (cachedVideos.length === 0) {
        console.log(`[YT-Checker] Guild #${this.guildId}: No cached videos, skipping comments check`.yellow)
        return
      }

      const seenLocally = new Set(data.seenComments || [])
      const seenAtStart = new Set(seenLocally)

      const allNewItems = []
      const unavailableVideoIds = new Set()
      const now = Date.now()

      // Include videos from the last 60 days or the latest 100 uploads
      const activeVideos = cachedVideos.filter((v, i) => {
        const publishedAt = new Date(v.snippet?.publishedAt).getTime()
        return (Number.isFinite(publishedAt) && now - publishedAt <= FULL_SCAN_AGE_MS) || i < FULL_SCAN_MAX_VIDEOS
      })

      for (const video of activeVideos) {
        const { newItems, unavailable } = await this._scanVideoComments(youtube, video, seenLocally, setupDateMs, seenAtStart)
        allNewItems.push(...newItems)
        if (unavailable) unavailableVideoIds.add(video.id)
      }

      if (unavailableVideoIds.size > 0) {
        const filteredCache = cachedVideos.filter((video) => !unavailableVideoIds.has(video.id))
        await DataStore.updateVideosCache(this.guildId, filteredCache)
      }

      await DataStore.updateGuildData(this.guildId, {
        seenComments: [...seenLocally].slice(-MAX_TRACKED_COMMENT_IDS),
      })

      if (allNewItems.length === 0) return

      // Send the oldest comments first
      allNewItems.sort((a, b) => new Date(a.comment.publishedAt) - new Date(b.comment.publishedAt))

      for (const item of allNewItems) {
        await this._sendNotification(item, youtubeChannel.id, notificationChannelId)
      }
    } catch (error) {
      console.error(`[YT-Checker] Guild #${this.guildId}: Error checking comments:\n`.red, error.message)
    }
  }

  async checkOldVideosDiagnostic() {
    return runGuildTask(this.guildId, () => this._checkOldVideosDiagnostic())
  }

  async _checkOldVideosDiagnostic() {
    try {
      const config = await getYouTubeConfig(this.guildId)
      if (!config) return

      const { youtube, notifications, setupDate, youtubeChannel } = config
      const setupDateMs = this._resolveSetupDateMs(setupDate)
      const notificationChannelId = notifications?.activityChannelId
      if (!notificationChannelId) return

      const data = await DataStore.getData(this.guildId)
      const cachedVideos = data.videosCache
      if (cachedVideos.length === 0) return

      const seenLocally = new Set(data.seenComments || [])
      const seenAtStart = new Set(seenLocally)

      // Index active video IDs for quick lookup
      const now = Date.now()
      const activeVideoIds = new Set(
        cachedVideos
          .filter((v, i) => {
            const publishedAt = new Date(v.snippet?.publishedAt).getTime()
            return (Number.isFinite(publishedAt) && now - publishedAt <= FULL_SCAN_AGE_MS) || i < FULL_SCAN_MAX_VIDEOS
          })
          .map((v) => v.id),
      )

      // Select videos outside the active window
      const oldVideos = cachedVideos.filter((v) => !activeVideoIds.has(v.id))

      if (oldVideos.length === 0) {
        console.log(`[YT-Checker] Guild #${this.guildId}: No old videos to diagnose`.gray)
        return
      }

      console.log(`[YT-Checker] Guild #${this.guildId}: Diagnosing ${oldVideos.length} old video(s)`.gray)

      // Fetch statistics in batches
      const statsMap = await this._batchFetchStatistics(youtube, oldVideos)
      const videosMeta = data.videosMeta

      // Identify videos that need a full scan
      const videosNeedingScan = []

      for (const video of oldVideos) {
        const meta = videosMeta[video.id]
        const currentCount = statsMap[video.id]

        // Skip videos with unavailable comment counts
        if (currentCount === null || currentCount === undefined) continue

        // Scan videos with changed counts or no baseline
        if (!meta || currentCount !== meta.commentCount) {
          videosNeedingScan.push(video)
          continue
        }

        // Detect a changed latest comment when the count stays the same
        if (meta.lastCommentId) {
          try {
            const quickResp = await youtube.commentThreads.list({
              part: 'snippet',
              videoId: video.id,
              order: 'time',
              maxResults: 1,
            })
            const latestId = quickResp.data.items?.[0]?.snippet?.topLevelComment?.id
            if (latestId && latestId !== meta.lastCommentId) {
              videosNeedingScan.push(video)
            }
          } catch (error) {
            if (isQuotaError(error)) throw error
            if (!error.errors?.some(({ reason }) => reason === 'commentsDisabled')) {
              console.error(`[YT-Checker] Guild #${this.guildId}: Error checking latest comment for ${video.id}:`, error.message)
            }
          }
        }
      }

      if (videosNeedingScan.length === 0) {
        console.log(`[YT-Checker] Guild #${this.guildId}: No changes detected in old videos`.gray)
        return
      }

      console.log(`[YT-Checker] Guild #${this.guildId}: ${videosNeedingScan.length} old video(s) changed, running full scan`.gray)

      // Scan videos with changed comments
      const allNewItems = []
      const metaUpdates = {}
      const unavailableVideoIds = new Set()

      for (const video of videosNeedingScan) {
        const { newItems, latestCommentId, unavailable, complete } = await this._scanVideoComments(
          youtube,
          video,
          seenLocally,
          setupDateMs,
          seenAtStart,
        )
        allNewItems.push(...newItems)
        if (unavailable) {
          unavailableVideoIds.add(video.id)
          continue
        }
        if (!complete) continue
        metaUpdates[video.id] = {
          commentCount: statsMap[video.id],
          ...(latestCommentId ? { lastCommentId: latestCommentId } : {}),
        }
      }

      if (unavailableVideoIds.size > 0) {
        const filteredCache = cachedVideos.filter((video) => !unavailableVideoIds.has(video.id))
        await DataStore.updateVideosCache(this.guildId, filteredCache)
      }

      // Save seen comment IDs and video metadata
      await DataStore.updateGuildData(this.guildId, {
        seenComments: [...seenLocally].slice(-MAX_TRACKED_COMMENT_IDS),
      })

      if (Object.keys(metaUpdates).length > 0) {
        await DataStore.updateVideosMeta(this.guildId, metaUpdates)
      }

      if (allNewItems.length === 0) return

      // Send notifications from oldest to newest
      allNewItems.sort((a, b) => new Date(a.comment.publishedAt) - new Date(b.comment.publishedAt))

      for (const item of allNewItems) {
        await this._sendNotification(item, youtubeChannel.id, notificationChannelId)
      }
    } catch (error) {
      console.error(`[YT-Checker] Guild #${this.guildId}: Error in old videos diagnostic:\n`.red, error.message)
    }
  }

  async _scanVideoComments(youtube, video, seenLocally, setupDateMs, seenAtStart) {
    const videoId = video.id
    const videoTitle = video.snippet.title
    const newItems = []
    let latestCommentId = null

    let pageToken
    let pageCount = 0
    let reachedBaseline = false

    try {
      do {
        const commentsResponse = await youtube.commentThreads.list({
          part: 'snippet,replies',
          videoId,
          order: 'time',
          maxResults: 100,
          pageToken,
        })

        const items = commentsResponse.data.items || []
        let lastTopLevelId = null

        // Record the newest top-level comment ID from the first page
        if (pageCount === 0 && items.length > 0) {
          latestCommentId = items[0].snippet.topLevelComment.id
        }

        for (const item of items) {
          const topLevel = item.snippet.topLevelComment
          const topLevelId = topLevel.id
          const topLevelSnippet = topLevel.snippet
          const totalReplies = Number(item.snippet.totalReplyCount || 0)
          lastTopLevelId = topLevelId

          if (!seenLocally.has(topLevelId)) {
            // Remember older comments so the next scan can stop early
            seenLocally.add(topLevelId)

            if (this._isOnOrAfterSetupDate(topLevelSnippet.publishedAt, setupDateMs)) {
              newItems.push({
                kind: 'top-level',
                commentId: topLevelId,
                comment: topLevelSnippet,
                videoId,
                videoTitle,
              })
            }
          }

          if (totalReplies > 0) {
            let replies = item.replies?.comments || []
            if (totalReplies > replies.length) {
              replies = await this._fetchAllReplies(youtube, topLevelId)
            }

            for (const reply of replies) {
              const replyId = reply.id
              if (!this._isOnOrAfterSetupDate(reply.snippet?.publishedAt, setupDateMs) || seenLocally.has(replyId)) continue

              newItems.push({
                kind: 'reply',
                commentId: replyId,
                comment: reply.snippet,
                videoId,
                videoTitle,
                parentCommentId: topLevelId,
                parentAuthor: topLevelSnippet.authorDisplayName,
                parentText: topLevelSnippet.textDisplay,
              })
              seenLocally.add(replyId)
            }
          }
        }

        // Stop when the page reaches previously seen comments
        if (lastTopLevelId && seenAtStart.has(lastTopLevelId)) {
          reachedBaseline = true
          break
        }

        pageToken = commentsResponse.data.nextPageToken
        pageCount++
      } while (pageToken && pageCount < 10)
    } catch (error) {
      if (isQuotaError(error)) throw error
      if (error.code === 403 && error.message.includes('disabled comments')) return { newItems, latestCommentId, unavailable: false }

      if (this._isVideoUnavailableError(error)) {
        return { newItems, latestCommentId, unavailable: true }
      }

      console.error(`[YT-Checker] Guild #${this.guildId}: Error checking comments for video id=${videoId}:\n`.red, error.message)
      return { newItems, latestCommentId, unavailable: false, complete: false }
    }

    return { newItems, latestCommentId, unavailable: false, complete: reachedBaseline || !pageToken }
  }

  _isVideoUnavailableError(error) {
    const code = Number(error?.code)
    const message = String(error?.message || '').toLowerCase()
    const reason = String(error?.errors?.[0]?.reason || '').toLowerCase()

    if (code === 404) return true
    if (reason === 'videonotfound') return true

    return message.includes('videoid') && message.includes('could not be found')
  }

  async _batchFetchStatistics(youtube, videos) {
    const statsMap = {}

    for (let i = 0; i < videos.length; i += 50) {
      const chunk = videos.slice(i, i + 50)
      const ids = chunk.map((v) => v.id).join(',')

      try {
        const resp = await youtube.videos.list({ part: 'statistics', id: ids })

        for (const item of resp.data.items || []) {
          const cc = item.statistics?.commentCount
          statsMap[item.id] = cc !== undefined ? Number(cc) : null
        }

        // Treat missing videos as unavailable
        for (const video of chunk) {
          if (!(video.id in statsMap)) statsMap[video.id] = null
        }
      } catch (error) {
        if (isQuotaError(error)) throw error
        console.error(`[YT-Checker] Guild #${this.guildId}: Error fetching statistics batch:\n`.red, error.message)
      }
    }

    return statsMap
  }

  async _fetchAllReplies(youtube, parentId) {
    const allReplies = []
    let pageToken
    let pageCount = 0

    try {
      do {
        const response = await youtube.comments.list({
          part: 'snippet',
          parentId,
          maxResults: 100,
          pageToken,
        })
        allReplies.push(...(response.data.items || []))
        pageToken = response.data.nextPageToken
        pageCount++
      } while (pageToken && pageCount < 10)
    } catch (error) {
      if (isQuotaError(error)) throw error
      console.error(`[YT-Checker] Guild #${this.guildId}: Error fetching replies for ${parentId}:\n`.red, error.message)
      throw error
    }

    return allReplies
  }

  _isOnOrAfterSetupDate(publishedAt, setupDateMs) {
    const publishedAtMs = new Date(publishedAt).getTime()
    if (!Number.isFinite(publishedAtMs) || !Number.isFinite(setupDateMs) || setupDateMs <= 0) return true
    return publishedAtMs >= setupDateMs
  }

  _resolveSetupDateMs(setupDate) {
    const numeric = Number(setupDate)
    if (Number.isFinite(numeric) && numeric > 0) return numeric

    const parsed = new Date(setupDate).getTime()
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }

  async _sendNotification(item, channelId, notificationChannelId) {
    const { kind, comment, videoId, videoTitle, commentId } = item
    const isReply = kind === 'reply'

    const isChannelAuthor = comment.authorChannelId && comment.authorChannelId.value === channelId

    const color = isChannelAuthor ? '#ff0132' : isReply ? '#cd9379' : '#ecb172'
    const title = isReply ? 'Dodano nową odpowiedź na komentarz! ↩️' : 'Dodano nowy komentarz! 💬'

    const commentText = this._formatCommentText(comment.textDisplay)
    const formattedTimestamp = this._formatDiscordTimestamp(comment.publishedAt)

    const fields = []

    if (isReply) {
      const parentPreviewRaw = this._formatCommentText(item.parentText || '')
      const parentPreview = parentPreviewRaw.length > 200 ? parentPreviewRaw.substring(0, 200) + '...' : parentPreviewRaw

      fields.push({
        name: `Odpowiedź na komentarz: ${item.parentAuthor}`,
        value: parentPreview ? `> ${parentPreview}` : '*(brak treści)*',
      })
    }

    fields.push({ name: 'Film', value: `[${videoTitle}](https://www.youtube.com/watch?v=${videoId})` })
    fields.push({ name: 'Data dodania', value: formattedTimestamp })

    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: comment.authorDisplayName,
        iconURL: comment.authorProfileImageUrl,
      })
      .setTitle(title)
      .setURL(`https://www.youtube.com/watch?v=${videoId}&lc=${commentId}`)
      .setDescription(`"${commentText}"`)
      .addFields(fields)

    const guild = this.client.guilds.cache.get(this.guildId)
    if (!guild) return

    const channel = await guild.channels.fetch(notificationChannelId).catch(() => null)
    if (!channel) {
      console.error(`[YT-Checker] Guild #${this.guildId}: Notification channel not found!`.yellow)
      return
    }

    await channel.send({ embeds: [embed] })
  }

  _formatCommentText(textDisplay) {
    const decoded = he
      .decode(textDisplay || '')
      .replace(/<a[^>]*>(.*?)<\/a>/gi, '$1')
      .replace(/(<br\s*\/?>\s*)+/gi, '; ')
    return decoded.length > EMBED_DESCRIPTION_LIMIT ? decoded.substring(0, EMBED_DESCRIPTION_LIMIT) + '...' : decoded
  }

  _formatDiscordTimestamp(dateInput) {
    const timestampMs = new Date(dateInput).getTime()
    if (!Number.isFinite(timestampMs)) return 'Brak daty'
    const timestampSeconds = Math.floor(timestampMs / 1000)
    return `<t:${timestampSeconds}:F> • <t:${timestampSeconds}:R>`
  }
}

module.exports = YTCommentsMonitor
