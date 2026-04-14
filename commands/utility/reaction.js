const { MessageFlags, SlashCommandBuilder } = require('discord.js')
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
          option.setName('message-id').setDescription('ID wiadomości, do której ma zostać dodana reakcja').setRequired(true),
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
        .addStringOption((option) => option.setName('emoji').setDescription('Reakcja do usunięcia (emoji)')),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand()
    const rawID = interaction.options.getString('message-id')
    const messageID = rawID.includes('-') ? rawID.split('-').pop() : rawID

    if (!/^\d+$/.test(messageID)) {
      return await interaction.reply({ content: 'Podane ID wiadomości jest nieprawidłowe!', flags: MessageFlags.Ephemeral })
    }

    const emoji = interaction.options.getString('emoji')

    if (subcommand === 'add') {
      try {
        const message = await interaction.channel.messages.fetch(messageID)
        await message.react(emoji)

        await interaction.reply({
          content: `Dodano reakcję ${emoji} do podanej wiadomości!`,
          flags: MessageFlags.Ephemeral,
        })
      } catch {
        await interaction.reply({
          content: 'Nie udało się dodać reakcji! Sprawdź, czy podane emoji jest ogólnodostępne.',
          flags: MessageFlags.Ephemeral,
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
          }

          await interaction.reply({
            content: `Usunięto reakcję ${emoji} z podanej wiadomości!`,
            flags: MessageFlags.Ephemeral,
          })
        } else {
          const botReactions = message.reactions.cache.filter((r) => r.users.cache.has(botId))
          for (const reaction of botReactions.values()) {
            await reaction.users.remove(botId)
          }

          await interaction.reply({
            content: 'Usunięto wszystkie reakcje bota z podanej wiadomości!',
            flags: MessageFlags.Ephemeral,
          })
        }
      } catch {
        await interaction.reply({
          content: 'Nie udało się usunąć reakcji! Sprawdź, czy podane ID wiadomości jest poprawne.',
          flags: MessageFlags.Ephemeral,
        })
      }
    }
  },
}
