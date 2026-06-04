const fs = require('node:fs').promises
const path = require('node:path')

const DATA_FILE = path.join(__dirname, '../data/yt-cache.min.json')
const EMPTY_GUILD_CACHE = {
  seenComments: [],
  videosCache: [],
  videosMeta: {},
}

class DataStore {
  static _normalizeGuildData(guildData = {}) {
    const meta = guildData.videosMeta
    return {
      seenComments: Array.isArray(guildData.seenComments) ? guildData.seenComments : [],
      videosCache: Array.isArray(guildData.videosCache) ? guildData.videosCache : [],
      videosMeta: meta !== null && typeof meta === 'object' && !Array.isArray(meta) ? meta : {},
    }
  }

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
      const guildData = allData[guildId] || EMPTY_GUILD_CACHE
      return {
        ...EMPTY_GUILD_CACHE,
        ...this._normalizeGuildData(guildData),
      }
    }

    return allData
  }

  static async getVideosCache(guildId) {
    const data = await this.getData(guildId)
    return data.videosCache || []
  }

  static async updateGuildData(guildId, updates) {
    const allData = await this.getData()

    if (!allData[guildId]) {
      allData[guildId] = { ...EMPTY_GUILD_CACHE }
    }

    const currentData = this._normalizeGuildData(allData[guildId])

    allData[guildId] = {
      ...currentData,
      ...this._normalizeGuildData({
        ...currentData,
        ...updates,
      }),
    }

    await this._saveData(allData)
  }

  static async updateVideosCache(guildId, videos) {
    await this.updateGuildData(guildId, {
      videosCache: videos,
    })
  }

  static async getVideosMeta(guildId) {
    const data = await this.getData(guildId)
    return data.videosMeta || {}
  }

  static async updateVideosMeta(guildId, metaUpdates) {
    const allData = await this.getData()
    if (!allData[guildId]) allData[guildId] = { ...EMPTY_GUILD_CACHE }
    const current = this._normalizeGuildData(allData[guildId])

    allData[guildId] = {
      ...current,
      videosMeta: {
        ...current.videosMeta,
        ...Object.fromEntries(
          Object.entries(metaUpdates).map(([videoId, update]) => [videoId, { ...(current.videosMeta[videoId] || {}), ...update }]),
        ),
      },
    }

    await this._saveData(allData)
  }

  static async addSeenComment(guildId, commentId) {
    const guildData = await this.getData(guildId)
    if (guildData.seenComments.includes(commentId)) return

    await this.updateGuildData(guildId, {
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
