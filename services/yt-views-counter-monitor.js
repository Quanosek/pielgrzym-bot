const { PermissionFlagsBits } = require('discord.js')

const { formatNumber } = require('../utils/format-number')
const GuildConfig = require('../utils/guild-config')

class YTViewsCounterMonitor {
  constructor(client, guildId) {
    this.client = client
    this.guildId = guildId
  }

  _calculateViews(history, todayViewCount) {
    if (history.length >= 2) {
      const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date))
      const oldest = sorted[0]
      const newest = sorted[sorted.length - 1]

      const daysDiff = Math.max(1, Math.round((new Date(newest.date) - new Date(oldest.date)) / (1000 * 60 * 60 * 24)))

      if (daysDiff >= 365) {
        const targetDate = new Date()
        targetDate.setDate(targetDate.getDate() - 365)
        const target = targetDate.toISOString().slice(0, 10)
        const baseline = sorted.find((entry) => entry.date >= target) || oldest
        return Math.max(0, todayViewCount - baseline.count)
      }

      if (daysDiff >= 30) {
        const viewsDiff = newest.count - oldest.count
        const dailyAvg = viewsDiff / daysDiff
        return Math.max(0, Math.round(dailyAvg * 365))
      }
    }

    return todayViewCount
  }

  async updateViewsCount() {
    try {
      const guildConfig = await GuildConfig.getConfig(this.guildId)
      const viewsChannelId = guildConfig?.ytMonitoring?.counters?.viewsChannelId
      if (!viewsChannelId) return

      const todayViewCount = Number(guildConfig?.ytMonitoring?.youtubeChannel?.statistics?.viewCount)
      if (!Number.isFinite(todayViewCount)) {
        console.error(`[YT-Checker] Guild #${this.guildId}: Missing cached YouTube viewCount in config`.yellow)
        return
      }

      const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

      const history = guildConfig?.ytMonitoring?.counters?.viewsHistory || []
      const existingIndex = history.findIndex((entry) => entry.date === today)

      if (existingIndex >= 0) {
        history[existingIndex].count = todayViewCount
      } else {
        history.push({ date: today, count: todayViewCount })
      }

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 366)
      const cutoff = cutoffDate.toISOString().slice(0, 10)

      const trimmedHistory = history.filter((entry) => entry.date >= cutoff)

      await GuildConfig.updateGuildConfig(this.guildId, {
        ytMonitoring: {
          ...guildConfig?.ytMonitoring,
          counters: {
            ...guildConfig?.ytMonitoring?.counters,
            viewsHistory: trimmedHistory,
          },
        },
      })

      const views = this._calculateViews(trimmedHistory, todayViewCount)

      const guild = this.client.guilds.cache.get(this.guildId)
      if (!guild) return

      const channel = await guild.channels.fetch(viewsChannelId).catch(() => null)
      if (!channel) {
        console.log(`[YT-Checker] Guild #${this.guildId}: Views counter channel no longer exists, disabling`.yellow)
        await this._disableCounter(guildConfig)
        return
      }

      const requiredPerms = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels]
      const permissions = channel.permissionsFor(guild.members.me)
      const missingPerms = requiredPerms.filter((perm) => !permissions.has(perm))
      if (missingPerms.length > 0) {
        console.log(`[YT-Checker] Guild #${this.guildId}: Bot lost permissions on views counter channel, disabling`.yellow)
        await this._disableCounter(guildConfig)
        return
      }

      const newName = `Wyświetlenia: ${formatNumber(views, { style: 'compact' })}`
      await channel.setName(newName).catch((err) => {
        console.error(`[YT-Checker] Guild #${this.guildId}: Failed to rename voice channel:\n`.red, err.message)
      })
    } catch (error) {
      console.error(`[YT-Checker] Guild #${this.guildId}: Error updating views count:\n`.red, error.message)
    }
  }

  async _disableCounter(guildConfig) {
    const newCounter = { ...guildConfig?.ytMonitoring?.counters }
    delete newCounter.viewsChannelId
    delete newCounter.viewsHistory

    await GuildConfig.updateGuildConfig(this.guildId, {
      ytMonitoring: {
        ...guildConfig?.ytMonitoring,
        counters: newCounter,
      },
    })
  }
}

module.exports = YTViewsCounterMonitor
