const { ChannelSelectMenuBuilder, ChannelType, ContainerBuilder, MessageFlags, resolveColor } = require('discord.js')
const GuildConfig = require('../../utils/guild-config')

module.exports = async (interaction) => {
  const guildId = interaction.guildId
  const config = await GuildConfig.getConfig(guildId)

  const { counters, notifications } = config?.ytMonitoring || {}

  const textChannelSelect = ({ id, defaultChannel }) =>
    new ChannelSelectMenuBuilder()
      .setChannelTypes(ChannelType.GuildText)
      .setCustomId(id)
      .setDefaultChannels(defaultChannel ?? [])
      .setPlaceholder('Wybierz kanał tekstowy')

  const voiceChannelSelect = ({ id, defaultChannel }) =>
    new ChannelSelectMenuBuilder()
      .setChannelTypes(ChannelType.GuildVoice)
      .setCustomId(id)
      .setDefaultChannels(defaultChannel ?? [])
      .setPlaceholder('Wybierz kanał głosowy')

  const container = new ContainerBuilder()
    .setAccentColor(resolveColor('#ff0033'))
    .addTextDisplayComponents((textDisplay) => textDisplay.setContent('⚙️ **Ustawienia monitoringu kanału Youtube**'))

    .addTextDisplayComponents((textDisplay) => textDisplay.setContent('Powiadomienia nowych filmów:'))
    .addActionRowComponents((actionRow) =>
      actionRow.setComponents(
        textChannelSelect({
          id: 'notifications-videos',
          defaultChannel: notifications?.newVideosChannelId,
        }),
      ),
    )
    .addTextDisplayComponents((textDisplay) => textDisplay.setContent('Powiadomienia nowych komentarzy:'))
    .addActionRowComponents((actionRow) =>
      actionRow.setComponents(
        textChannelSelect({
          id: 'notifications-activity',
          defaultChannel: notifications?.activityChannelId,
        }),
      ),
    )

    .addTextDisplayComponents((textDisplay) => textDisplay.setContent('Licznik subskrypcji:'))
    .addActionRowComponents((actionRow) =>
      actionRow.setComponents(
        voiceChannelSelect({
          id: 'counter-subs',
          defaultChannel: counters?.subsChannelId,
        }),
      ),
    )

    .addTextDisplayComponents((textDisplay) => textDisplay.setContent('Licznik wyświetleń:'))
    .addActionRowComponents((actionRow) =>
      actionRow.setComponents(
        voiceChannelSelect({
          id: 'counter-views',
          defaultChannel: counters?.viewsChannelId,
        }),
      ),
    )

    .addTextDisplayComponents((textDisplay) => textDisplay.setContent('Licznik filmów:'))
    .addActionRowComponents((actionRow) =>
      actionRow.setComponents(
        voiceChannelSelect({
          id: 'counter-videos',
          defaultChannel: counters?.videosChannelId,
        }),
      ),
    )

  await interaction.reply({
    components: [container],
    flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
  })
}
