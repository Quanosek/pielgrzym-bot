const GuildConfig = require('../../utils/guild-config')

module.exports = async (interaction) => {
  const guildId = interaction.guildId
  const currentConfig = await GuildConfig.getConfig(guildId)

  if (!currentConfig?.ytMonitoring?.enabled) {
    return await interaction.reply({
      content: '⚠️ Monitoring kanału YouTube nie jest włączony.',
      ephemeral: true,
    })
  }

  await GuildConfig.disableMonitoring(guildId)

  return await interaction.reply({
    content: '❌ Monitorowanie kanału YouTube zostało wyłączone.',
    ephemeral: true,
  })
}
