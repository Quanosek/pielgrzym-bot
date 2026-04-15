const { MessageFlags } = require('discord.js')
const GuildConfig = require('../../utils/guild-config')

const YTVideosMonitor = require('../../services/yt-videos-monitor')
const YTCommentsMonitor = require('../../services/yt-comments-monitor')

const YTSubsCounterMonitor = require('../../services/yt-subs-counter-monitor')
const YTViewsCounterMonitor = require('../../services/yt-views-counter-monitor')
const YTVideosCounterMonitor = require('../../services/yt-videos-counter-monitor')

module.exports = async (interaction) => {
  const guildId = interaction.guildId
  const config = await GuildConfig.getConfig(guildId)
  const type = interaction.options.getString('type')

  if (!config?.ytMonitoring?.enabled) {
    return await interaction.reply({
      content: '⚠️ Monitoring kanału YouTube nie został włączony.',
      flags: MessageFlags.Ephemeral,
    })
  }

  if (type === 'notifications-videos') {
    await interaction.reply({
      content: '🔍 Sprawdzam nowe filmy...',
      flags: MessageFlags.Ephemeral,
    })

    console.log('🎬 Checking for new videos on user demand'.gray)
    const monitor = new YTVideosMonitor(interaction.client, guildId)
    await monitor.checkNewVideos()
    return
  }

  if (type === 'notifications-activity') {
    await interaction.reply({
      content: '💬 Sprawdzam nowe komentarze...',
      flags: MessageFlags.Ephemeral,
    })

    console.log('💬 Checking for new comments on user demand'.gray)
    const monitor = new YTCommentsMonitor(interaction.client, guildId)
    await monitor.checkNewComments()
    return
  }

  const { counters } = config?.ytMonitoring || {}

  if (type === 'counter-subs') {
    if (!counters?.subsChannelId) {
      return interaction.reply({
        content: '⚠️ Licznik subskrypcji nie został włączony. Użyj `/youtube counter` aby go ustawić.',
        flags: MessageFlags.Ephemeral,
      })
    }

    await interaction.reply({
      content: '📊 Odświeżam liczbę subskrypcji...',
      flags: MessageFlags.Ephemeral,
    })

    console.log('📊 Updating subscriber count on user demand'.gray)
    const monitor = new YTSubsCounterMonitor(interaction.client, guildId)
    await monitor.updateSubscriberCount()
    return
  }

  if (type === 'counter-views') {
    if (!counters?.viewsChannelId) {
      return interaction.reply({
        content: '⚠️ Licznik wyświetleń nie został włączony. Użyj `/youtube counter` aby go ustawić.',
        flags: MessageFlags.Ephemeral,
      })
    }

    await interaction.reply({
      content: '📊 Odświeżam licznik wyświetleń...',
      flags: MessageFlags.Ephemeral,
    })

    console.log('📊 Updating views count on user demand'.gray)
    const monitor = new YTViewsCounterMonitor(interaction.client, guildId)
    await monitor.updateViewsCount()
    return
  }

  if (type === 'counter-videos') {
    if (!counters?.videosChannelId) {
      return interaction.reply({
        content: '⚠️ Licznik filmów nie został włączony. Użyj `/youtube counter` aby go ustawić.',
        flags: MessageFlags.Ephemeral,
      })
    }

    await interaction.reply({
      content: '📊 Odświeżam licznik filmów...',
      flags: MessageFlags.Ephemeral,
    })

    console.log('📊 Updating videos count on user demand'.gray)
    const monitor = new YTVideosCounterMonitor(interaction.client, guildId)
    await monitor.updateVideosCount()
    return
  }
}
