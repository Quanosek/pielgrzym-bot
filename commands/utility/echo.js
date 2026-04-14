const { ChannelType, MessageFlags, SlashCommandBuilder } = require('discord.js')
const { BotPermissions: P } = require('../../utils/permissions')

module.exports = {
  permissions: [P.SEND_MESSAGES, P.READ_MESSAGE_HISTORY],
  data: new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Stwórz własną wiadomość')
    .addStringOption((option) => option.setName('input').setDescription('Treść wiadomości').setMaxLength(2_000).setRequired(true))
    .addChannelOption((option) =>
      option.setName('channel').setDescription('Kanał, do którego ma zostać wysłana wiadomość (Obecny kanał)').addChannelTypes(ChannelType.GuildText),
    )
    .addBooleanOption((option) => option.setName('reply').setDescription('Czy wiadomość ma się wyświetlić jako odpowiedź (True)'))
    .addBooleanOption((option) => option.setName('ephemeral').setDescription('Czy wiadomość ma być widoczna tylko dla Ciebie (False)')),

  async execute(interaction) {
    const input = interaction.options.getString('input')
    const channel = interaction.options.getChannel('channel')
    const reply = interaction.options.getBoolean('reply') ?? true
    const ephemeral = interaction.options.getBoolean('ephemeral') ?? false

    if (channel) {
      await channel.send(input)
      await interaction.reply({ content: `Wiadomość została wysłana do ${channel}!`, flags: MessageFlags.Ephemeral })
    } else {
      if (reply) {
        await interaction.reply({ content: input, flags: ephemeral ? MessageFlags.Ephemeral : 0 })
      } else {
        await interaction.channel.send(input)
        await interaction.reply({ content: 'Wiadomość została wysłana!', flags: MessageFlags.Ephemeral })
      }
    }
  },
}
