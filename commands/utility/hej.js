const { SlashCommandBuilder } = require('discord.js')
const { BotPermissions: P } = require('../../utils/permissions')

module.exports = {
  permissions: [P.SEND_MESSAGES],
  data: new SlashCommandBuilder().setName('hej').setDescription('Przywitaj się z botem'),

  async execute(interaction) {
    await interaction.reply('Hej! 👋')
  },
}
