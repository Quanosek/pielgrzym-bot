const { EmbedBuilder, Events, MessageFlags } = require('discord.js')
const { permissionDisplayNames } = require('../utils/permissions')

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    if (interaction.isChannelSelectMenu()) {
      const selected = interaction.client.interactionHandlers.channelSelect(interaction)

      if (!selected) return

      const channelSelectHandlers = interaction.client.interactionHandlers?.channelSelectHandlers || []

      for (const handleChannelSelect of channelSelectHandlers) {
        const handled = await handleChannelSelect(interaction, selected)
        if (handled) return
      }

      return
    }

    if (!interaction.isChatInputCommand()) return

    const command = interaction.client.commands.get(interaction.commandName)
    if (!command) return

    if (command.permissions?.length) {
      const botMember = await interaction.guild.members.fetchMe()
      const botPermissions = botMember.permissionsIn(interaction.channel)
      const missing = command.permissions.filter((perm) => !botPermissions.has(perm))

      if (missing.length) {
        const missingNames = missing.map((perm) => `\`${permissionDisplayNames[perm] || perm}\``)

        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('⛔ Brak wymaganych uprawnień')
          .setDescription(
            `Bot nie posiada wymaganych uprawnień do wykonania tej komendy:\n\n${missingNames.join(', ')}\n\nZwróć się z tym do administratora serwera.`,
          )

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
        return
      }
    }

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
