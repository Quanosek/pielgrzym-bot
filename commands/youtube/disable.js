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
    delete newCounter[channelKey]
    if (counterType === 'views') delete newCounter.viewsHistory

    await GuildConfig.updateGuildConfig(guildId, {
      ytMonitoring: {
        ...currentConfig.ytMonitoring,
        counter: newCounter,
      },
    })

    return interaction.reply(`🔴 Licznik ${counterName} został wyłączony.`)
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
