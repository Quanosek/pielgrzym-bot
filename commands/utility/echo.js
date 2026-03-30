const { SlashCommandBuilder, ChannelType } = require('discord.js')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Stwórz własną wiadomość')
    .addStringOption((option) => option.setName('input').setDescription('Treść wiadomości').setMaxLength(2_000).setRequired(true))
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Kanał, do którego ma zostać wysłana wiadomość (Current channel)')
        .addChannelTypes(ChannelType.GuildText),
    )
    .addBooleanOption((option) => option.setName('ephemeral').setDescription('Czy wiadomość ma być widoczna tylko dla Ciebie (False)'))
    .addBooleanOption((option) => option.setName('reply').setDescription('Czy wiadomość ma się wyświetlić jako odpowiedź (True)')),

  async execute(interaction) {
    const input = interaction.options.getString('input')
    const channel = interaction.options.getChannel('channel')
    const ephemeral = interaction.options.getBoolean('ephemeral') ?? false
    const reply = interaction.options.getBoolean('reply') ?? true

    if (channel) {
      await channel.send(input)
      await interaction.reply({ content: `Wiadomość została wysłana do ${channel}!`, ephemeral: true })
    } else {
      if (reply) {
        await interaction.reply({ content: input, ephemeral })
      } else {
        await interaction.channel.send(input)
        await interaction.reply({ content: 'Wiadomość została wysłana!', ephemeral: true })
      }
    }
  },
}
