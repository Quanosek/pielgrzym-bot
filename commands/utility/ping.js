const { SlashCommandBuilder } = require('discord.js')
const { BotPermissions: P } = require('../../utils/permissions')

module.exports = {
  permissions: [P.SEND_MESSAGES],
  data: new SlashCommandBuilder().setName('ping').setDescription('Sprawdź czas odpowiedzi bota'),

  async execute(interaction) {
    const { resource } = await interaction.reply({ content: 'Pong! ...', withResponse: true })
    const latency = resource.message.createdTimestamp - interaction.createdTimestamp
    await interaction.editReply(`Pong! 🏓 Czas odpowiedzi: \`${latency} ms\``)
  },
}
