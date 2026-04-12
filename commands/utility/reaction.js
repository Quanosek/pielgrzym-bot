const { SlashCommandBuilder } = require('discord.js')
const { BotPermissions: P } = require('../../utils/permissions')

module.exports = {
  permissions: [P.SEND_MESSAGES, P.ADD_REACTIONS, P.READ_MESSAGE_HISTORY],
  data: new SlashCommandBuilder()
    .setName('reaction')
    .setDescription('Zarządzanie reakcjami bota')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Dodaj reakcję do wiadomości')
        .addStringOption((option) =>
          option.setName('message-id').setDescription('ID wiadomości, na którą ma zostać dodana reakcja').setRequired(true),
        )
        .addStringOption((option) => option.setName('emoji').setDescription('Reakcja do dodania (emoji)').setRequired(true)),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Usuń reakcje bota z wiadomości')
        .addStringOption((option) =>
          option.setName('message-id').setDescription('ID wiadomości, z której mają zostać usunięte reakcje').setRequired(true),
        )
        .addStringOption((option) => option.setName('emoji').setDescription('Reakcja do usunięcia')),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand()
    const messageID = interaction.options.getString('message-id')
    const emoji = interaction.options.getString('emoji')

    if (subcommand === 'add') {
      try {
        const message = await interaction.channel.messages.fetch(messageID)
        await message.react(emoji)
        await interaction.reply({ content: `Dodano reakcję ${emoji} do wiadomości!`, ephemeral: true })
      } catch {
        await interaction.reply({
          content: 'Nie udało się dodać reakcji. Sprawdź, czy ID wiadomości jest poprawne i czy emoji jest prawidłowe.',
          ephemeral: true,
        })
      }
    }

    if (subcommand === 'remove') {
      try {
        const message = await interaction.channel.messages.fetch(messageID)
        const botId = interaction.client.user.id

        if (emoji) {
          const reaction = message.reactions.cache.find((r) => r.emoji.toString() === emoji)
          if (reaction && reaction.users.cache.has(botId)) {
            await reaction.users.remove(botId)
            await interaction.reply({ content: `Usunięto reakcję ${emoji} z wiadomości!`, ephemeral: true })
          } else {
            await interaction.reply({ content: 'Bot nie ma takiej reakcji na tej wiadomości.', ephemeral: true })
          }
        } else {
          const botReactions = message.reactions.cache.filter((r) => r.users.cache.has(botId))
          for (const reaction of botReactions.values()) {
            await reaction.users.remove(botId)
          }
          await interaction.reply({ content: 'Usunięto wszystkie reakcje bota z wiadomości!', ephemeral: true })
        }
      } catch {
        await interaction.reply({
          content: 'Nie udało się usunąć reakcji. Sprawdź, czy ID wiadomości jest poprawne.',
          ephemeral: true,
        })
      }
    }
  },
}
