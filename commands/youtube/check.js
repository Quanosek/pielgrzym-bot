const YTVideosMonitor = require('../../services/yt-videos-monitor')
const YTCommentsMonitor = require('../../services/yt-comments-monitor')
const YTSubsMonitor = require('../../services/yt-subs-monitor')

module.exports = async (interaction) => {
  const guildId = interaction.guildId
  const type = interaction.options.getString('type')

  if (type === 'videos') {
    await interaction.reply({ content: '🔍 Sprawdzam nowe filmy...', ephemeral: true })
    console.log('🎬 Checking for new videos on user demand'.gray)

    const ytVideosMonitor = new YTVideosMonitor(interaction.client, guildId)
    return await ytVideosMonitor.checkNewVideos()
  }

  if (type === 'comments') {
    await interaction.reply({ content: '💬 Sprawdzam nowe komentarze...', ephemeral: true })
    console.log('💬 Checking for new comments on user demand'.gray)

    const ytCommentsMonitor = new YTCommentsMonitor(interaction.client, guildId)
    return await ytCommentsMonitor.checkNewComments()
  }

  if (type === 'subs') {
    await interaction.reply({ content: '📊 Odświeżam liczbę subskrypcji...', ephemeral: true })
    console.log('📊 Updating subscriber count on user demand'.gray)

    const ytSubsMonitor = new YTSubsMonitor(interaction.client, guildId)
    return await ytSubsMonitor.updateSubscriberCount()
  }
}
