const { youtube, channelId } = require('../config/youtube')
const DataStore = require('../utils/yt-cache')

const FETCH_ALL_VIDEOS = true // set to false to fetch only first 50 videos

class YTVideosCache {
  constructor(client) {
    this.client = client
  }

  async refreshVideosCache() {
    try {
      let allVideos = []
      let nextPageToken = null
      let pageCount = 0

      do {
        const videosResponse = await youtube.search.list({
          part: 'id,snippet',
          channelId,
          type: 'video',
          order: 'date',
          maxResults: 50, // max allowed by YouTube API
          pageToken: nextPageToken,
        })

        const items = videosResponse.data.items
        if (items && items.length > 0) {
          const videos = items.map((item) => ({
            id: item.id.videoId,
            snippet: item.snippet,
          }))
          allVideos.push(...videos)
        }

        nextPageToken = videosResponse.data.nextPageToken
        pageCount++

        console.log(`[YT-Checker] Fetched page ${pageCount}: ${items?.length || 0} videos`.gray)
      } while (nextPageToken && FETCH_ALL_VIDEOS)

      await DataStore.updateVideosCache(allVideos)
      console.log(`[YT-Checker] Cache updated for ${allVideos.length} videos (${pageCount} pages)!`.cyan)
    } catch (error) {
      console.error('[YT-Checker] Error refreshing videos cache:\n'.red, error.message)
    }
  }
}

module.exports = YTVideosCache
