const { MessageFlags } = require('discord.js')
const GuildConfig = require('../../utils/guild-config')

const YTVideosMonitor = require('../../services/yt-videos-monitor')
const YTCommentsMonitor = require('../../services/yt-comments-monitor')
const YTSubsMonitor = require('../../services/yt-subs-monitor')
const YTViewsMonitor = require('../../services/yt-views-monitor')

module.exports = async (interaction) => {
  const guildId = interaction.guildId
  const type = interaction.options.getString('type')

  if (type === 'videos') {
    await interaction.reply({
      content: '🔍 Sprawdzam nowe filmy...',
      flags: MessageFlags.Ephemeral,
    })

    console.log('🎬 Checking for new videos on user demand'.gray)

    const ytVideosMonitor = new YTVideosMonitor(interaction.client, guildId)
    return await ytVideosMonitor.checkNewVideos()
  }

  if (type === 'comments') {
    await interaction.reply({
      content: '💬 Sprawdzam nowe komentarze...',
      flags: MessageFlags.Ephemeral,
    })

    console.log('💬 Checking for new comments on user demand'.gray)

    const ytCommentsMonitor = new YTCommentsMonitor(interaction.client, guildId)
    return await ytCommentsMonitor.checkNewComments()
  }

  if (type === 'subs') {
    const config = await GuildConfig.getConfig(guildId)
    if (!config?.ytMonitoring?.counter?.subsChannelId) {
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

    const ytSubsMonitor = new YTSubsMonitor(interaction.client, guildId)
    return await ytSubsMonitor.updateSubscriberCount()
  }

  if (type === 'views') {
    const config = await GuildConfig.getConfig(guildId)
    if (!config?.ytMonitoring?.counter?.viewsChannelId) {
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

    const ytViewsMonitor = new YTViewsMonitor(interaction.client, guildId)
    return await ytViewsMonitor.updateViewsCount()
  }
}
