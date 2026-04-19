const { ChannelSelectMenuBuilder, ChannelType, ContainerBuilder, MessageFlags, resolveColor } = require('discord.js')
const GuildConfig = require('../../utils/guild-config')

const SETTINGS_CUSTOM_ID_PREFIX = 'youtube-settings'

const SETTINGS_CHANNELS = [
  {
    id: 'notifications-videos',
    title: 'Powiadomienia nowych filmów:',
    sectionName: 'powiadomienia o nowych filmach',
    group: 'notifications',
    key: 'newVideosChannelId',
    channelType: ChannelType.GuildText,
    placeholder: 'Wybierz kanał tekstowy',
  },
  {
    id: 'notifications-activity',
    title: 'Powiadomienia nowych komentarzy:',
    sectionName: 'powiadomienia o aktywności',
    group: 'notifications',
    key: 'activityChannelId',
    channelType: ChannelType.GuildText,
    placeholder: 'Wybierz kanał tekstowy',
  },
  {
    id: 'counter-subs',
    title: 'Licznik subskrypcji:',
    sectionName: 'licznik subskrypcji',
    group: 'counters',
    key: 'subsChannelId',
    channelType: ChannelType.GuildVoice,
    placeholder: 'Wybierz kanał głosowy',
  },
  {
    id: 'counter-views',
    title: 'Licznik wyświetleń:',
    sectionName: 'licznik wyświetleń',
    group: 'counters',
    key: 'viewsChannelId',
    channelType: ChannelType.GuildVoice,
    placeholder: 'Wybierz kanał głosowy',
  },
  {
    id: 'counter-videos',
    title: 'Licznik filmów:',
    sectionName: 'licznik filmów',
    group: 'counters',
    key: 'videosChannelId',
    channelType: ChannelType.GuildVoice,
    placeholder: 'Wybierz kanał głosowy',
  },
]

const SETTINGS_CHANNELS_MAP = Object.fromEntries(SETTINGS_CHANNELS.map((setting) => [setting.id, setting]))

const handleSettingsChannelSelect = async (interaction, selected) => {
  if (!selected?.customId?.startsWith(`${SETTINGS_CUSTOM_ID_PREFIX}:`)) return false

  const settingId = selected.customId.slice(`${SETTINGS_CUSTOM_ID_PREFIX}:`.length)
  const setting = SETTINGS_CHANNELS_MAP[settingId]
  if (!setting) return false

  const selectedChannelId = selected.selectedValue
  if (!selectedChannelId) {
    await interaction.reply({
      content: '⚠️ Nie wybrano kanału do zapisania.',
      flags: MessageFlags.Ephemeral,
    })
    return true
  }

  try {
    const guildId = interaction.guildId
    const config = await GuildConfig.getConfig(guildId)
    const ytMonitoring = config?.ytMonitoring || {}
    const updatedYtMonitoring = {
      ...ytMonitoring,
      [setting.group]: {
        ...ytMonitoring?.[setting.group],
        [setting.key]: selectedChannelId,
      },
    }

    await GuildConfig.updateGuildConfig(guildId, {
      ytMonitoring: updatedYtMonitoring,
    })

    await interaction.deferUpdate()

    const selectedChannel = interaction.guild.channels.cache.get(selectedChannelId)
    const selectedLabel = selectedChannel ? `<#${selectedChannelId}>` : `ID: ${selectedChannelId}`

    if (interaction.channel) {
      await interaction.channel.send({
        content: `✅ Ustawiono kanał ${selectedLabel} jako ${setting.sectionName}.`,
      })
    }
  } catch (error) {
    console.error('Error updating YouTube settings from channel select menu:\n'.red + error)

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        content: '⚠️ Nie udało się zapisać zmian ustawień YouTube.',
        flags: MessageFlags.Ephemeral,
      })
    } else {
      await interaction.reply({
        content: '⚠️ Nie udało się zapisać zmian ustawień YouTube.',
        flags: MessageFlags.Ephemeral,
      })
    }
  }

  return true
}

module.exports = async (interaction) => {
  const guildId = interaction.guildId
  const config = await GuildConfig.getConfig(guildId)
  const ytMonitoring = config?.ytMonitoring || {}

  const container = new ContainerBuilder()
    .setAccentColor(resolveColor('#ff0033'))
    .addTextDisplayComponents((textDisplay) => textDisplay.setContent('⚙️ **Ustawienia monitoringu kanału Youtube**'))

  for (const setting of SETTINGS_CHANNELS) {
    const defaultChannelId = ytMonitoring?.[setting.group]?.[setting.key]

    container
      .addTextDisplayComponents((textDisplay) => textDisplay.setContent(setting.title))
      .addActionRowComponents((actionRow) =>
        actionRow.setComponents(
          new ChannelSelectMenuBuilder()
            .setChannelTypes(setting.channelType)
            .setCustomId(`${SETTINGS_CUSTOM_ID_PREFIX}:${setting.id}`)
            .setDefaultChannels(defaultChannelId ? [defaultChannelId] : [])
            .setPlaceholder(setting.placeholder),
        ),
      )
  }

  const channelSelectHandlers = interaction.client?.interactionHandlers?.channelSelectHandlers
  if (Array.isArray(channelSelectHandlers) && !channelSelectHandlers.includes(handleSettingsChannelSelect)) {
    channelSelectHandlers.push(handleSettingsChannelSelect)
  }

  await interaction.reply({
    components: [container],
    flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
  })
}
