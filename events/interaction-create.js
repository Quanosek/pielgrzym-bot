const { Events, MessageFlags } = require('discord.js')

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return

    const command = interaction.client.commands.get(interaction.commandName)
    if (!command) return

    try {
      await command.execute(interaction)
    } catch (error) {
      console.error(`Error executing command: "${interaction.commandName}":\n`.red + error)

      const message = {
        content: '⚠️ Nie udało się wykonać tej komendy!',
        flags: MessageFlags.Ephemeral,
      }

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(message)
      } else {
        await interaction.reply(message)
      }
    }
  },
}
