const { PermissionFlagsBits } = require('discord.js')

const { getYouTubeConfig } = require('../config/youtube')
const GuildConfig = require('../utils/guild-config')

class YTSubsMonitor {
  constructor(client, guildId) {
    this.client = client
    this.guildId = guildId
  }

  async updateSubscriberCount() {
    try {
      const guildConfig = await GuildConfig.getConfig(this.guildId)
      const subsChannelId = guildConfig?.ytMonitoring?.counter?.subsChannelId
      if (!subsChannelId) return

      const config = await getYouTubeConfig(this.guildId)
      if (!config) {
        console.error(`[YT-Checker] No YouTube config found for guild ${this.guildId}`.yellow)
        return
      }

      const { youtube, channelId } = config

      const channelResponse = await youtube.channels.list({
        part: 'snippet,statistics',
        id: channelId,
      })

      const item = channelResponse?.data?.items?.[0]
      if (!item?.statistics?.subscriberCount) return

      await GuildConfig.updateGuildConfig(this.guildId, {
        ytMonitoring: {
          ...guildConfig.ytMonitoring,
          youtubeChannel: {
            id: channelId,
            snippet: item.snippet,
            statistics: item.statistics,
          },
        },
      })

      const subs = item.statistics.subscriberCount

      const guild = this.client.guilds.cache.get(this.guildId)
      if (!guild) return

      const channel = await guild.channels.fetch(subsChannelId).catch(() => null)
      if (!channel) return

      const requiredPerms = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels]
      const permissions = channel.permissionsFor(guild.members.me)
      const missingPerms = requiredPerms.filter((perm) => !permissions.has(perm))
      if (missingPerms.length > 0) return

      const newName = `Subskrypcje: ${subs}`
      if (channel.name !== newName) await channel.setName(newName)
    } catch (error) {
      console.error(`[YT-Checker] Guild #${this.guildId}: Error updating subscriber count:\n`.red, error.message)
    }
  }
}

module.exports = YTSubsMonitor
