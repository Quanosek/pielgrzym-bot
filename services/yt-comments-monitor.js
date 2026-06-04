const { EmbedBuilder } = require('discord.js')
const he = require('he')

const { getYouTubeConfig } = require('../config/youtube')
const DataStore = require('../utils/yt-cache')

const EMBED_DESCRIPTION_LIMIT = 4096 - 5
const MAX_TRACKED_COMMENT_IDS = 10000
const FULL_SCAN_MAX_VIDEOS = 100 // active window: top N by index
const FULL_SCAN_AGE_DAYS = 60 // active window: max age in days
const FULL_SCAN_AGE_MS = FULL_SCAN_AGE_DAYS * 24 * 60 * 60 * 1000

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

      const { youtube, notifications, setupDate, youtubeChannel } = config
      const setupDateMs = this._resolveSetupDateMs(setupDate)
      const notificationChannelId = notifications?.activityChannelId

      if (!notificationChannelId) {
        console.error(`[YT-Checker] Guild #${this.guildId}: Missing activityChannelId in config`.yellow)
        return
      }

      const cachedVideos = await DataStore.getVideosCache(this.guildId)
      if (cachedVideos.length === 0) {
        console.log(`[YT-Checker] Guild #${this.guildId}: No cached videos, skipping comments check`.yellow)
        return
      }

      const data = await DataStore.getData(this.guildId)
      const seenLocally = new Set(data.seenComments || [])

      const allNewItems = []
      const unavailableVideoIds = new Set()
      const now = Date.now()

      // active window: recent ≤60d or top 100
      const activeVideos = cachedVideos.filter((v, i) => {
        const publishedAt = new Date(v.snippet?.publishedAt).getTime()
        return (Number.isFinite(publishedAt) && now - publishedAt <= FULL_SCAN_AGE_MS) || i < FULL_SCAN_MAX_VIDEOS
      })

      for (const video of activeVideos) {
        const { newItems, unavailable } = await this._scanVideoComments(youtube, video, seenLocally, setupDateMs)
        allNewItems.push(...newItems)
        if (unavailable) unavailableVideoIds.add(video.id)
      }

      if (unavailableVideoIds.size > 0) {
        const filteredCache = cachedVideos.filter((video) => !unavailableVideoIds.has(video.id))
        await DataStore.updateVideosCache(this.guildId, filteredCache)
      }

      await DataStore.updateGuildData(this.guildId, {
        seenComments: [...seenLocally].slice(0, MAX_TRACKED_COMMENT_IDS),
      })

      if (allNewItems.length === 0) return

      // oldest first
      allNewItems.sort((a, b) => new Date(a.comment.publishedAt) - new Date(b.comment.publishedAt))

      for (const item of allNewItems) {
        await this._sendNotification(item, youtubeChannel.id, notificationChannelId)
      }
    } catch (error) {
      console.error(`[YT-Checker] Guild #${this.guildId}: Error checking comments:\n`.red, error.message)
    }
  }

  async checkOldVideosDiagnostic() {
    try {
      const config = await getYouTubeConfig(this.guildId)
      if (!config) return

      const { youtube, notifications, setupDate, youtubeChannel } = config
      const setupDateMs = this._resolveSetupDateMs(setupDate)
      const notificationChannelId = notifications?.activityChannelId
      if (!notificationChannelId) return

      const cachedVideos = await DataStore.getVideosCache(this.guildId)
      if (cachedVideos.length === 0) return

      const data = await DataStore.getData(this.guildId)
      const seenLocally = new Set(data.seenComments || [])

      // fast lookup set for active window ids
      const now = Date.now()
      const activeVideoIds = new Set(
        cachedVideos
          .filter((v, i) => {
            const publishedAt = new Date(v.snippet?.publishedAt).getTime()
            return (Number.isFinite(publishedAt) && now - publishedAt <= FULL_SCAN_AGE_MS) || i < FULL_SCAN_MAX_VIDEOS
          })
          .map((v) => v.id),
      )

      // outside active window
      const oldVideos = cachedVideos.filter((v) => !activeVideoIds.has(v.id))

      if (oldVideos.length === 0) {
        console.log(`[YT-Checker] Guild #${this.guildId}: No old videos to diagnose`.gray)
        return
      }

      console.log(`[YT-Checker] Guild #${this.guildId}: Diagnosing ${oldVideos.length} old video(s)`.gray)

      // phase 1: batch stats
      const statsMap = await this._batchFetchStatistics(youtube, oldVideos)
      const videosMeta = await DataStore.getVideosMeta(this.guildId)

      // phase 2: determine which videos need a full scan
      const videosNeedingScan = []

      for (const video of oldVideos) {
        const meta = videosMeta[video.id]
        const currentCount = statsMap[video.id]

        // skip unavailable (deleted/private/comments disabled)
        if (currentCount === null || currentCount === undefined) continue

        // count changed or no baseline
        if (!meta || currentCount !== meta.commentCount) {
          videosNeedingScan.push(video)
          continue
        }

        // latest id shifted (same count but rotated)
        if (meta.lastCommentId) {
          try {
            const quickResp = await youtube.commentThreads.list({
              part: 'id',
              videoId: video.id,
              order: 'time',
              maxResults: 1,
            })
            const latestId = quickResp.data.items?.[0]?.id
            if (latestId && latestId !== meta.lastCommentId) {
              videosNeedingScan.push(video)
            }
          } catch {
            // ignore (comments disabled after last scan)
          }
        }
      }

      if (videosNeedingScan.length === 0) {
        console.log(`[YT-Checker] Guild #${this.guildId}: No changes detected in old videos`.gray)
        return
      }

      console.log(`[YT-Checker] Guild #${this.guildId}: ${videosNeedingScan.length} old video(s) changed, running full scan`.gray)

      // phase 3: full scan changed videos
      const allNewItems = []
      const metaUpdates = {}
      const unavailableVideoIds = new Set()

      for (const video of videosNeedingScan) {
        const { newItems, latestCommentId, unavailable } = await this._scanVideoComments(youtube, video, seenLocally, setupDateMs)
        allNewItems.push(...newItems)
        if (unavailable) {
          unavailableVideoIds.add(video.id)
          continue
        }
        metaUpdates[video.id] = {
          commentCount: statsMap[video.id],
          ...(latestCommentId ? { lastCommentId: latestCommentId } : {}),
        }
      }

      if (unavailableVideoIds.size > 0) {
        const filteredCache = cachedVideos.filter((video) => !unavailableVideoIds.has(video.id))
        await DataStore.updateVideosCache(this.guildId, filteredCache)
      }

      // persist seen comments and video meta
      await DataStore.updateGuildData(this.guildId, {
        seenComments: [...seenLocally].slice(0, MAX_TRACKED_COMMENT_IDS),
      })

      if (Object.keys(metaUpdates).length > 0) {
        await DataStore.updateVideosMeta(this.guildId, metaUpdates)
      }

      if (allNewItems.length === 0) return

      // phase 4: send chronologically (oldest first)
      allNewItems.sort((a, b) => new Date(a.comment.publishedAt) - new Date(b.comment.publishedAt))

      for (const item of allNewItems) {
        await this._sendNotification(item, youtubeChannel.id, notificationChannelId)
      }
    } catch (error) {
      console.error(`[YT-Checker] Guild #${this.guildId}: Error in old videos diagnostic:\n`.red, error.message)
    }
  }

  async _scanVideoComments(youtube, video, seenLocally, setupDateMs) {
    const videoId = video.id
    const videoTitle = video.snippet.title
    const newItems = []
    let latestCommentId = null

    // baseline for early-exit
    const seenAtStart = new Set(seenLocally)

    let pageToken
    let pageCount = 0

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

        // track newest comment id (first item on first page)
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
            // mark even if pre-setup — enables early-exit on next run
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

        // all further pages already processed
        if (lastTopLevelId && seenAtStart.has(lastTopLevelId)) break

        pageToken = commentsResponse.data.nextPageToken
        pageCount++
      } while (pageToken && pageCount < 10)
    } catch (error) {
      if (error.code === 403 && error.message.includes('disabled comments')) return { newItems, latestCommentId, unavailable: false }

      if (this._isVideoUnavailableError(error)) {
        return { newItems, latestCommentId, unavailable: true }
      }

      console.error(`[YT-Checker] Guild #${this.guildId}: Error checking comments for video id=${videoId}:\n`.red, error.message)
    }

    return { newItems, latestCommentId, unavailable: false }
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

        // missing from response = deleted/private
        for (const video of chunk) {
          if (!(video.id in statsMap)) statsMap[video.id] = null
        }
      } catch (error) {
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
      console.error(`[YT-Checker] Guild #${this.guildId}: Error fetching replies for ${parentId}:\n`.red, error.message)
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
