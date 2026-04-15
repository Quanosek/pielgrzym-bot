const { getYouTubeConfig } = require('../config/youtube')
const DataStore = require('../utils/yt-cache')

const MAX_VIDEOS_TO_CACHE = 100

class YTVideosCache {
  constructor(client, guildId) {
    this.client = client
    this.guildId = guildId
  }

  async refreshVideosCache() {
    try {
      const config = await getYouTubeConfig(this.guildId)
      if (!config) {
        console.error(`[YT-Checker] No YouTube config found for guild ${this.guildId}`.yellow)
        return
      }

      const { youtube, youtubeChannel } = config

      let allVideos = []
      let nextPageToken = null
      let pageCount = 0

      do {
        const videosResponse = await youtube.search.list({
          part: 'id,snippet',
          channelId: youtubeChannel.id,
          type: 'video',
          order: 'date',
          maxResults: 50,
          pageToken: nextPageToken,
        })

        const items = videosResponse.data.items || []
        if (items.length > 0) {
          allVideos.push(...items.map((item) => ({ id: item.id.videoId, snippet: item.snippet })))
        }

        pageCount++
        console.log(`[YT-Checker] Guild #${this.guildId}: Fetched page ${pageCount}: ${items.length} videos`.gray)

        if (allVideos.length >= MAX_VIDEOS_TO_CACHE) {
          allVideos = allVideos.slice(0, MAX_VIDEOS_TO_CACHE)
          break
        }

        nextPageToken = videosResponse.data.nextPageToken
      } while (nextPageToken)

      await DataStore.updateVideosCache(this.guildId, allVideos)

      if (allVideos.length > 0) {
        const data = await DataStore.getData(this.guildId)
        if (data.lastVideoId === null) {
          await DataStore.updateLastVideoId(this.guildId, allVideos[0].id, allVideos[0].snippet)
          console.log(`[YT-Checker] Guild #${this.guildId}: Set initial lastVideoId to ${allVideos[0].id}`.cyan)
        }
      }

      console.log(`[YT-Checker] Guild #${this.guildId}: Cache updated for ${allVideos.length} videos (${pageCount} pages)!`.cyan)
    } catch (error) {
      console.error(`[YT-Checker] Guild #${this.guildId}: Error refreshing videos cache:\n`.red, error.message)
    }
  }
}

module.exports = YTVideosCache
