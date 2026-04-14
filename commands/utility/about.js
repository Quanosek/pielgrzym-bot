const { EmbedBuilder, SlashCommandBuilder } = require('discord.js')
const { BotPermissions: P } = require('../../utils/permissions')

module.exports = {
  permissions: [P.SEND_MESSAGES, P.EMBED_LINKS],
  data: new SlashCommandBuilder().setName('about').setDescription('Wyświetl informacje na temat bota Pielgrzym'),

  async execute(interaction) {
    const client = interaction.client

    const embed = new EmbedBuilder()
      .setColor('#9b582e')
      .setTitle('⚙️ Pielgrzym - Bot Discord')
      .setThumbnail(client.user.displayAvatarURL())
      .setDescription(
        'Pielgrzym to dedykowany bot Discord dla potrzeb społeczności i zarządzania serwerem. Stworzony z myślą o prostym monitoringu wybranych kanałów YouTube bezpośrednio z poziomu serwera Discord.',
      )
      .addFields(
        { name: 'Tag', value: client.user.tag },
        { name: 'ID bota', value: client.user.id },
        { name: 'Liczba serwerów', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Liczba użytkowników', value: `${client.users.cache.size}`, inline: true },
        { name: 'Data utworzenia', value: `<t:${Math.floor(client.user.createdTimestamp / 1000)}:F>` },
        {
          name: 'Zaproszenie',
          value: 'https://discord.com/oauth2/authorize?client_id=1467574765513609399&permissions=2417052785&integration_type=0&scope=bot',
        },
      )

    await interaction.reply({ embeds: [embed] })
  },
}
