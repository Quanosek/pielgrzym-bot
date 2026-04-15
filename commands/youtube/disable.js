const { MessageFlags } = require('discord.js')
const GuildConfig = require('../../utils/guild-config')

module.exports = async (interaction) => {
  const guildId = interaction.guildId
  const config = await GuildConfig.getConfig(guildId)
  const counterType = interaction.options.getString('counter')

  // Disable specific counter
  if (counterType) {
    // Ensure counter is currently enabled
    const counters = config?.ytMonitoring?.counters
    const channelKey = `${counterType}ChannelId`

    let counterName
    if (counterType === 'subs') counterName = 'subskrypcji'
    if (counterType === 'views') counterName = 'wyświetleń'
    if (counterType === 'videos') counterName = 'filmów'

    if (!counters?.[channelKey]) {
      return interaction.reply({
        content: `⚠️ Licznik ${counterName} nie jest aktywny.`,
        flags: MessageFlags.Ephemeral,
      })
    }

    const channelId = counters[channelKey]

    // Filter out selected counter from config
    const newCounter = { ...counters }
    delete newCounter[channelKey]
    if (counterType === 'views') delete newCounter.viewsHistory

    await GuildConfig.updateGuildConfig(guildId, {
      ytMonitoring: {
        ...config?.ytMonitoring,
        counters: newCounter,
      },
    })

    await interaction.reply(`🔴 Licznik ${counterName} został wyłączony.`)

    // Reset voice channel name
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null)

    if (channel) {
      let defaultName
      if (counterType === 'subs') defaultName = 'Subskrypcje'
      if (counterType === 'views') defaultName = 'Wyświetlenia'
      if (counterType === 'videos') defaultName = 'Filmy'

      await channel.setName(defaultName).catch(() => null)
    }

    return
  }

  // Ensure monitoring is currently enabled
  if (!config?.ytMonitoring?.enabled) {
    return await interaction.reply({
      content: '⚠️ Monitoring kanału YouTube nie został włączony.',
      flags: MessageFlags.Ephemeral,
    })
  }

  // Disable entire monitoring
  await GuildConfig.disableMonitoring(guildId)

  return await interaction.reply({
    content: '🔴 Monitorowanie kanału YouTube zostało wyłączone.',
    flags: MessageFlags.Ephemeral,
  })
}
