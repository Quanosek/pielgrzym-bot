const { EmbedBuilder, SlashCommandBuilder } = require('discord.js')

module.exports = {
  data: new SlashCommandBuilder().setName('invite').setDescription('Stwórz zaproszenie do tego serwera, które nigdy nie wygasa'),

  async execute(interaction) {
    // Define guild infinite invite URL
    let inviteUrl
    if (interaction.guild.vanityURLCode) {
      inviteUrl = `https://discord.gg/${interaction.guild.vanityURLCode}`
    } else {
      const invites = await interaction.guild.invites.fetch()
      const botInvite = invites.find((inv) => inv.inviterId === interaction.client.user.id && inv.maxAge === 0)

      if (botInvite) {
        inviteUrl = botInvite.url
      } else {
        const channel = interaction.guild.systemChannel || interaction.channel
        const newInvite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: true })
        inviteUrl = newInvite.url
      }
    }

    const embed = new EmbedBuilder().setColor('#9b582e').setTitle('✉️ Zaproszenie na serwer').setDescription(inviteUrl)
    await interaction.reply({ embeds: [embed] })
  },
}
