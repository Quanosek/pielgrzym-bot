const fs = require('node:fs').promises
const path = require('node:path')

const DATA_FILE = path.join(__dirname, '../data/yt-cache.min.json')

class DataStore {
  static async _ensureDataFile() {
    try {
      await fs.access(DATA_FILE)
    } catch {
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
      await fs.writeFile(DATA_FILE, JSON.stringify({}))
    }
  }

  static async _saveData(data) {
    await this._ensureDataFile()
    await fs.writeFile(DATA_FILE, JSON.stringify(data))
  }

  static async getData(guildId = null) {
    await this._ensureDataFile()
    const data = await fs.readFile(DATA_FILE, 'utf-8')
    const allData = JSON.parse(data)

    if (guildId) {
      return (
        allData[guildId] || {
          lastVideoId: null,
          seenComments: [],
          videosCache: [],
        }
      )
    }

    return allData
  }

  static async getVideosCache(guildId) {
    const data = await this.getData(guildId)
    return data.videosCache || []
  }

  static async _updateGuildData(guildId, updates) {
    const allData = await this.getData()

    if (!allData[guildId]) {
      allData[guildId] = {
        lastVideoId: null,
        seenComments: [],
        videosCache: [],
      }
    }

    allData[guildId] = {
      ...allData[guildId],
      ...updates,
    }

    await this._saveData(allData)
  }

  static async updateVideosCache(guildId, videos) {
    await this._updateGuildData(guildId, {
      videosCache: videos,
    })
  }

  static async updateLastVideoId(guildId, videoId, videoSnippet) {
    const guildData = await this.getData(guildId)
    const videoExists = guildData.videosCache.some((video) => video.id === videoId)

    await this._updateGuildData(guildId, {
      lastVideoId: videoId,
      videosCache: videoExists ? guildData.videosCache : [{ id: videoId, snippet: videoSnippet }, ...guildData.videosCache],
    })
  }

  static async addSeenComment(guildId, commentId) {
    const guildData = await this.getData(guildId)
    if (guildData.seenComments.includes(commentId)) return

    await this._updateGuildData(guildId, {
      seenComments: [...guildData.seenComments, commentId],
    })
  }

  static async clearGuildCache(guildId) {
    const allData = await this.getData()
    delete allData[guildId]
    await this._saveData(allData)
  }
}

module.exports = DataStore
