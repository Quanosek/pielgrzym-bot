const { Events, MessageFlags } = require('discord.js')

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return

    const command = interaction.client.commands.get(interaction.commandName)

    if (!command) {
      console.error(`No "${interaction.commandName}" command was found!`.red)
      return
    }

    try {
      // // Check bot permissions
      // const channelPermissions = interaction.channel.permissionsFor(interaction.guild.members.me)

      // if (!channelPermissions.has('SendMessages')) {
      //   throw new Error('Bot does not have permission to send messages in this channel!')
      // }

      // Execute the command
      await command.execute(interaction)
    } catch (error) {
      console.error(`Error executing command: "${interaction.commandName}":\n`.red + error)

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'There was an error while executing this command!',
          flags: MessageFlags.Ephemeral,
        })
      } else {
        await interaction.reply({
          content: 'There was an error while executing this command!',
          flags: MessageFlags.Ephemeral,
        })
      }
    }
  },
}
