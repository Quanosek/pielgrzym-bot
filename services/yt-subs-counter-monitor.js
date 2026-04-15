const { PermissionFlagsBits } = require('discord.js')

const { getYouTubeConfig } = require('../config/youtube')
const { formatNumber } = require('../utils/format-number')
const GuildConfig = require('../utils/guild-config')

class YTSubsCounterMonitor {
  constructor(client, guildId) {
    this.client = client
    this.guildId = guildId
  }

  async updateSubscriberCount() {
    try {
      const guildConfig = await GuildConfig.getConfig(this.guildId)
      const subsChannelId = guildConfig?.ytMonitoring?.counters?.subsChannelId
      if (!subsChannelId) return

      const config = await getYouTubeConfig(this.guildId)
      if (!config) {
        console.error(`[YT-Checker] No YouTube config found for guild ${this.guildId}`.yellow)
        return
      }

      const { youtube, youtubeChannel } = config

      const channelResponse = await youtube.channels.list({
        part: 'snippet,statistics',
        id: youtubeChannel.id,
      })

      const item = channelResponse?.data?.items?.[0]
      if (!item?.statistics?.subscriberCount) return

      await GuildConfig.updateGuildConfig(this.guildId, {
        ytMonitoring: {
          ...guildConfig?.ytMonitoring,
          youtubeChannel: {
            id: youtubeChannel.id,
            snippet: item.snippet,
            statistics: item.statistics,
          },
        },
      })

      const subs = item.statistics.subscriberCount

      const guild = this.client.guilds.cache.get(this.guildId)
      if (!guild) return

      const channel = await guild.channels.fetch(subsChannelId).catch(() => null)
      if (!channel) {
        console.log(`[YT-Checker] Guild #${this.guildId}: Subs counter channel no longer exists, disabling`.yellow)
        await this._disableCounter(guildConfig)
        return
      }

      const requiredPerms = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels]
      const permissions = channel.permissionsFor(guild.members.me)
      const missingPerms = requiredPerms.filter((perm) => !permissions.has(perm))
      if (missingPerms.length > 0) {
        console.log(`[YT-Checker] Guild #${this.guildId}: Bot lost permissions on subs counter channel, disabling`.yellow)
        await this._disableCounter(guildConfig)
        return
      }

      const newName = `Subskrypcje: ${formatNumber(Number(subs))}`
      await channel.setName(newName).catch((err) => {
        console.error(`[YT-Checker] Guild #${this.guildId}: Failed to rename voice channel:\n`.red, err.message)
      })
    } catch (error) {
      console.error(`[YT-Checker] Guild #${this.guildId}: Error updating subscriber count:\n`.red, error.message)
    }
  }

  async _disableCounter(guildConfig) {
    const newCounter = { ...guildConfig?.ytMonitoring?.counters }
    delete newCounter.subsChannelId

    await GuildConfig.updateGuildConfig(this.guildId, {
      ytMonitoring: {
        ...guildConfig?.ytMonitoring,
        counters: newCounter,
      },
    })
  }
}

module.exports = YTSubsCounterMonitor
