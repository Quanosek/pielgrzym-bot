const { EmbedBuilder, SlashCommandBuilder } = require('discord.js')

module.exports = {
  data: new SlashCommandBuilder().setName('about').setDescription('Wyświetl informacje na temat bota Pielgrzym'),

  async execute(interaction) {
    const client = interaction.client

    const embed = new EmbedBuilder()
      .setColor('#9b582e')
      .setTitle('⚙️ Pielgrzym - Bot Discord')
      .setThumbnail(client.user.displayAvatarURL())
      .setDescription('Pielgrzym to bot Discord do zarządzania społecznością, automatyzacji i rozrywki.')
      .addFields(
        { name: 'Tag', value: client.user.tag },
        { name: 'ID bota', value: client.user.id },
        { name: 'Liczba serwerów', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Liczba użytkowników', value: `${client.users.cache.size}`, inline: true },
        { name: 'Data utworzenia', value: `<t:${Math.floor(client.user.createdTimestamp / 1000)}:F>` },
        {
          name: 'Zaproszenie',
          value: 'https://discord.com/oauth2/authorize?client_id=1467574765513609399&permissions=2147485729&integration_type=0&scope=bot',
        },
      )

    await interaction.reply({ embeds: [embed] })
  },
}
