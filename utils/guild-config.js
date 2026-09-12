const fs = require('node:fs').promises
const path = require('node:path')

const CONFIG_FILE = path.join(__dirname, '../data/guild-config.min.json')

class GuildConfig {
  static _writeQueue = Promise.resolve()

  static async _ensureConfigFile() {
    try {
      await fs.access(CONFIG_FILE)
    } catch {
      await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true })
      await fs.writeFile(CONFIG_FILE, JSON.stringify({}))
    }
  }

  static async _saveConfig(config) {
    await this._ensureConfigFile()
    const tempFile = `${CONFIG_FILE}.${process.pid}.tmp`
    await fs.writeFile(tempFile, JSON.stringify(config))
    await fs.rename(tempFile, CONFIG_FILE)
  }

  static _enqueueWrite(operation) {
    const queuedOperation = this._writeQueue.catch(() => {}).then(operation)
    this._writeQueue = queuedOperation.catch(() => {})
    return queuedOperation
  }

  static async getConfig(guildId = null) {
    await this._ensureConfigFile()
    const data = await fs.readFile(CONFIG_FILE, 'utf-8')
    const config = JSON.parse(data)

    if (guildId) return config[guildId] || null
    return config
  }

  static async initializeGuildConfig(guild) {
    await this._enqueueWrite(async () => {
      const config = await this.getConfig()

      if (!config[guild.id]) {
        config[guild.id] = {
          guildName: guild.name,
          ownerId: guild.ownerId,
          ownerName: guild.ownerId ? (await guild.client.users.fetch(guild.ownerId)).tag : 'Unknown',
        }

        await this._saveConfig(config)
      }
    })
  }

  static async deleteGuildConfig(guildId) {
    await this._enqueueWrite(async () => {
      const config = await this.getConfig()
      delete config[guildId]
      await this._saveConfig(config)
    })
  }

  static async updateGuildConfig(guildId, settings) {
    await this._enqueueWrite(async () => {
      const config = await this.getConfig()

      config[guildId] = {
        ...config[guildId],
        ...settings,
      }

      await this._saveConfig(config)
    })
  }

  static async enableMonitoring({ guildId, newVideosChannelId, youtubeChannel }) {
    const setupDate = Date.now()

    await this.updateGuildConfig(guildId, {
      ytMonitoring: {
        enabled: true,
        setupDate,
        notifications: {
          newVideosChannelId,
          activityChannelId: newVideosChannelId,
        },
        youtubeChannel,
      },
    })
  }

  static async disableMonitoring(guildId) {
    await this.updateGuildConfig(guildId, {
      ytMonitoring: { enabled: false },
    })

    const DataStore = require('./yt-cache')
    await DataStore.clearGuildCache(guildId)
  }
}

module.exports = GuildConfig
