const { EmbedBuilder, MessageFlags } = require('discord.js')
const GuildConfig = require('../../utils/guild-config')

module.exports = async (interaction) => {
  const guildId = interaction.guildId
  const config = await GuildConfig.getConfig(guildId)

  if (!config?.ytMonitoring?.enabled) {
    return await interaction.reply({
      content: '⚠️ Monitoring kanału YouTube nie został włączony.',
      flags: MessageFlags.Ephemeral,
    })
  }

  const { counters, notifications, setupDate, youtubeChannel } = config?.ytMonitoring || {}

  const notificationsFields = []
  if (notifications?.newVideosChannelId) {
    notificationsFields.push({ name: 'Powiadomienia nowych filmów', value: `<#${notifications.newVideosChannelId}>`, inline: true })
  }
  if (notifications?.activityChannelId) {
    notificationsFields.push({ name: 'Powiadomienia nowych komentarzy', value: `<#${notifications.activityChannelId}>`, inline: true })
  }

  const countersFields = []
  if (counters?.subsChannelId) {
    countersFields.push({ name: 'Licznik subskrypcji', value: `<#${counters.subsChannelId}>`, inline: true })
  }
  if (counters?.viewsChannelId) {
    countersFields.push({ name: 'Licznik wyświetleń', value: `<#${counters.viewsChannelId}>`, inline: true })
  }
  if (counters?.videosChannelId) {
    countersFields.push({ name: 'Licznik filmów', value: `<#${counters.videosChannelId}>`, inline: true })
  }

  const embed = new EmbedBuilder()
    .setColor('#ff0033')
    .setTitle('🔎 Status monitorowania kanału YouTube')
    .setThumbnail(youtubeChannel.snippet.thumbnails.high.url)
    .addFields(
      {
        name: 'Nazwa kanału',
        value: `[${youtubeChannel.snippet.title}](https://www.youtube.com/channel/${youtubeChannel.id})`,
      },
      {
        name: 'Aktywne kanały powiadomień',
        value: `\`${notificationsFields.length}\` / \`2\``,
      },
      ...notificationsFields,
      {
        name: 'Aktywne liczniki',
        value: `\`${countersFields.length}\` / \`3\``,
      },
      ...countersFields,
      {
        name: 'Data rozpoczęcia monitorowania',
        value: `<t:${Math.floor(new Date(setupDate).getTime() / 1000)}:f>`,
      },
    )

  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false
  return await interaction.reply({ embeds: [embed], flags: ephemeral ? MessageFlags.Ephemeral : 0 })
}
