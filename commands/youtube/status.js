const { EmbedBuilder, MessageFlags } = require('discord.js')

const GuildConfig = require('../../utils/guild-config')

module.exports = async (interaction) => {
  const guildId = interaction.guildId
  const config = await GuildConfig.getConfig(guildId)

  if (!config?.ytMonitoring?.enabled) {
    return await interaction.reply({
      content: '❌ Monitorowanie kanału YouTube nie zostało włączone.',
      flags: MessageFlags.Ephemeral,
    })
  }

  const { youtubeChannel, notificationChannelId, setupDate, counter } = config.ytMonitoring

  const counterFields = []
  if (counter?.subsChannelId) {
    counterFields.push({ name: 'Licznik subskrypcji', value: `<#${counter.subsChannelId}>`, inline: true })
  }
  if (counter?.viewsChannelId) {
    counterFields.push({ name: 'Licznik wyświetleń', value: `<#${counter.viewsChannelId}>`, inline: true })
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
        name: 'Kanał powiadomień',
        value: `<#${notificationChannelId}>`,
      },
      {
        name: 'Aktywne liczniki',
        value: counterFields.length > 0 ? counterFields.length.toString() : 'Brak',
      },
      ...counterFields,
      {
        name: 'Data rozpoczęcia monitorowania',
        value: `<t:${Math.floor(new Date(setupDate).getTime() / 1000)}:f>`,
      },
    )

  return await interaction.reply({ embeds: [embed] })
}
