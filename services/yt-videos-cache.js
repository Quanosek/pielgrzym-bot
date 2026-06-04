const { getYouTubeConfig, getUploadsPlaylistId } = require('../config/youtube')
const DataStore = require('../utils/yt-cache')

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

      const uploadsPlaylistId = getUploadsPlaylistId(youtubeChannel.id)
      if (!uploadsPlaylistId) {
        console.error(`[YT-Checker] Guild #${this.guildId}: Could not derive uploads playlist for channel ${youtubeChannel.id}`.yellow)
        return
      }

      let allVideos = []
      let nextPageToken = null
      let pageCount = 0

      // paginate all uploads playlist pages
      do {
        const videosResponse = await youtube.playlistItems.list({
          part: 'snippet,contentDetails',
          playlistId: uploadsPlaylistId,
          maxResults: 50,
          pageToken: nextPageToken,
        })

        const items = videosResponse.data.items || []
        if (items.length > 0) {
          allVideos.push(
            ...items.map((item) => ({
              id: item.contentDetails.videoId,
              snippet: {
                ...item.snippet,
                publishedAt: item.contentDetails.videoPublishedAt || item.snippet.publishedAt,
              },
            })),
          )
        }

        pageCount++
        console.log(`[YT-Checker] Guild #${this.guildId}: Fetched page ${pageCount}: ${items.length} videos`.gray)

        nextPageToken = videosResponse.data.nextPageToken
      } while (nextPageToken)

      await DataStore.updateVideosCache(this.guildId, allVideos)

      console.log(`[YT-Checker] Guild #${this.guildId}: Cache updated for ${allVideos.length} videos (${pageCount} pages)!`.cyan)
    } catch (error) {
      console.error(`[YT-Checker] Guild #${this.guildId}: Error refreshing videos cache:\n`.red, error.message)
    }
  }
}

module.exports = YTVideosCache
