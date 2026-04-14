const { MessageFlags } = require('discord.js')
const GuildConfig = require('../../utils/guild-config')

module.exports = async (interaction) => {
  const guildId = interaction.guildId
  const currentConfig = await GuildConfig.getConfig(guildId)
  const counterType = interaction.options.getString('counter')

  // Disable specific counter
  if (counterType) {
    const counter = currentConfig?.ytMonitoring?.counter
    const channelKey = counterType === 'subs' ? 'subsChannelId' : 'viewsChannelId'
    const counterName = counterType === 'subs' ? 'subskrypcji' : 'wyświetleń'

    if (!counter?.[channelKey]) {
      return interaction.reply({
        content: `⚠️ Licznik ${counterName} nie jest aktywny.`,
        flags: MessageFlags.Ephemeral,
      })
    }

    const newCounter = { ...counter }
    const channelId = counter[channelKey]
    delete newCounter[channelKey]
    if (counterType === 'views') delete newCounter.viewsHistory

    await GuildConfig.updateGuildConfig(guildId, {
      ytMonitoring: {
        ...currentConfig.ytMonitoring,
        counter: newCounter,
      },
    })

    await interaction.reply(`🔴 Licznik ${counterName} został wyłączony.`)

    const guild = interaction.guild
    const channel = await guild.channels.fetch(channelId).catch(() => null)
    if (channel) {
      const resetName = counterType === 'subs' ? 'Subskrypcje' : 'Wyświetlenia'
      await channel.setName(resetName).catch(() => null)
    }

    return
  }

  // Disable entire monitoring
  if (!currentConfig?.ytMonitoring?.enabled) {
    return await interaction.reply({
      content: '⚠️ Monitoring kanału YouTube nie jest włączony.',
      flags: MessageFlags.Ephemeral,
    })
  }

  await GuildConfig.disableMonitoring(guildId)

  return await interaction.reply({
    content: '🔴 Monitorowanie kanału YouTube zostało wyłączone.',
    flags: MessageFlags.Ephemeral,
  })
}
