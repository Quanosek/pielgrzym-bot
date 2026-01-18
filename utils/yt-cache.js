const fs = require('node:fs').promises
const path = require('node:path')

const DATA_FILE = path.join(__dirname, '../data/yt-cache.min.json')

class DataStore {
  static async _ensureDataFile() {
    try {
      await fs.access(DATA_FILE)
    } catch {
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })

      await fs.writeFile(
        DATA_FILE,
        JSON.stringify({
          lastVideoId: null,
          seenComments: [],
          videosCache: [],
          videosCacheTimestamp: null,
        }),
      )
    }
  }

  static async _saveData(data) {
    await this._ensureDataFile()
    await fs.writeFile(DATA_FILE, JSON.stringify(data))
  }

  static async getData() {
    await this._ensureDataFile()
    const data = await fs.readFile(DATA_FILE, 'utf-8')
    return JSON.parse(data)
  }

  static async updateVideosCache(videos) {
    const data = await this.getData()
    data.videosCache = videos
    data.videosCacheTimestamp = Date.now()
    await this._saveData(data)
  }

  static async getVideosCache() {
    const data = await this.getData()
    return {
      videos: data.videosCache || [],
      timestamp: data.videosCacheTimestamp,
    }
  }

  static async updateLastVideoId(videoId, videoSnippet) {
    const data = await this.getData()
    data.lastVideoId = videoId

    const newVideo = {
      id: videoId,
      snippet: videoSnippet,
    }

    data.videosCache = [newVideo, ...data.videosCache]

    await this._saveData(data)
  }

  static async addSeenComment(commentId) {
    const data = await this.getData()

    if (!data.seenComments.includes(commentId)) {
      data.seenComments.push(commentId)
      await this._saveData(data)
    }
  }
}

module.exports = DataStore
