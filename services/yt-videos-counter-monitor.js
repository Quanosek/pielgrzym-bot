const { PermissionFlagsBits } = require('discord.js')

const { formatNumber } = require('../utils/format-number')
const GuildConfig = require('../utils/guild-config')

class YTVideosCounterMonitor {
  constructor(client, guildId) {
    this.client = client
    this.guildId = guildId
  }

  async updateVideosCount() {
    try {
      const guildConfig = await GuildConfig.getConfig(this.guildId)
      const videosChannelId = guildConfig?.ytMonitoring?.counters?.videosChannelId
      if (!videosChannelId) return

      const videos = Number(guildConfig?.ytMonitoring?.youtubeChannel?.statistics?.videoCount)
      if (!Number.isFinite(videos)) {
        console.error(`[YT-Checker] Guild #${this.guildId}: Missing cached YouTube videoCount in config`.yellow)
        return
      }

      const guild = this.client.guilds.cache.get(this.guildId)
      if (!guild) return

      const channel = await guild.channels.fetch(videosChannelId).catch(() => null)
      if (!channel) {
        console.log(`[YT-Checker] Guild #${this.guildId}: Videos counter channel no longer exists, disabling`.yellow)
        await this._disableCounter(guildConfig)
        return
      }

      const requiredPerms = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels]
      const permissions = channel.permissionsFor(guild.members.me)
      const missingPerms = requiredPerms.filter((perm) => !permissions.has(perm))
      if (missingPerms.length > 0) {
        console.log(`[YT-Checker] Guild #${this.guildId}: Bot lost permissions on videos counter channel, disabling`.yellow)
        await this._disableCounter(guildConfig)
        return
      }

      const newName = `Filmy: ${formatNumber(videos, { style: 'spaced' })}`
      await channel.setName(newName).catch((err) => {
        console.error(`[YT-Checker] Guild #${this.guildId}: Failed to rename voice channel:\n`.red, err.message)
      })
    } catch (error) {
      console.error(`[YT-Checker] Guild #${this.guildId}: Error updating videos count:\n`.red, error.message)
    }
  }

  async _disableCounter(guildConfig) {
    const newCounter = { ...guildConfig?.ytMonitoring?.counters }
    delete newCounter.videosChannelId

    await GuildConfig.updateGuildConfig(this.guildId, {
      ytMonitoring: {
        ...guildConfig?.ytMonitoring,
        counters: newCounter,
      },
    })
  }
}

module.exports = YTVideosCounterMonitor
