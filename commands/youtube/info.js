const { EmbedBuilder } = require('discord.js')

const GuildConfig = require('../../utils/guild-config')

module.exports = async (interaction) => {
  const guildId = interaction.guildId
  const config = await GuildConfig.getConfig(guildId)

  if (!config?.ytMonitoring?.enabled) {
    return await interaction.reply({
      content: '❌ Monitorowanie kanału YouTube nie zostało włączone.',
      ephemeral: true,
    })
  }

  const { youtubeChannel, notificationChannelId, setupDate } = config.ytMonitoring

  const embed = new EmbedBuilder()
    .setColor('#ff0033')
    .setTitle('Informacje o monitorowaniu kanału YouTube')
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
        name: 'Data rozpoczęcia monitorowania',
        value: new Date(setupDate).toLocaleString('pl-PL'),
      },
    )

  return await interaction.reply({ embeds: [embed] })
}
