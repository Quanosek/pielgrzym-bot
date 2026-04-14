const { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js')
const { BotPermissions: P } = require('../../utils/permissions')

const check = require('./check')
const counter = require('./counter')
const disable = require('./disable')
const enable = require('./enable')
const status = require('./status')

module.exports = {
  permissions: [P.SEND_MESSAGES, P.EMBED_LINKS, P.MANAGE_CHANNELS, P.MANAGE_ROLES],
  data: new SlashCommandBuilder()
    .setName('youtube')
    .setDescription('Zarządzanie monitorowaniem kanału YouTube')

    .addSubcommand((subcommand) =>
      subcommand
        .setName('check')
        .setDescription('Sprawdź nowe treści na żądanie')
        .addStringOption((option) =>
          option.setName('type').setDescription('Typ treści do sprawdzenia').setRequired(true).addChoices(
            {
              name: 'Filmy',
              value: 'videos',
            },
            {
              name: 'Komentarze',
              value: 'comments',
            },
            {
              name: 'Subskrypcje',
              value: 'subs',
            },
            {
              name: 'Wyświetlenia',
              value: 'views',
            },
          ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('counter')
        .setDescription('Ustaw licznik na kanale głosowym')
        .addStringOption((option) =>
          option.setName('type').setDescription('Rodzaj licznika').setRequired(true).addChoices(
            {
              name: 'Subskrypcje',
              value: 'subs',
            },
            {
              name: 'Wyświetlenia',
              value: 'views',
            },
          ),
        )
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Kanał głosowy do wyświetlania licznika')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildVoice),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('disable')
        .setDescription('Wyłącz monitorowanie kanału YouTube')
        .addStringOption((option) =>
          option.setName('counter').setDescription('Dezaktywuj wybrany licznik').addChoices(
            {
              name: 'Subskrypcje',
              value: 'subs',
            },
            {
              name: 'Wyświetlenia',
              value: 'views',
            },
          ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('enable')
        .setDescription('Włącz monitorowanie kanału YouTube')
        .addStringOption((option) => option.setName('channel-name').setDescription('Nazwa kanału YouTube').setRequired(true)),
    )
    .addSubcommand((subcommand) => subcommand.setName('status').setDescription('Pokaż status monitorowania kanału YouTube')),

  async execute(interaction) {
    const isBotOwner = interaction.user.id === process.env.OWNER_ID
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)

    if (!isBotOwner && !isAdmin) {
      return interaction.reply({
        content: '🛑 Tylko administrator serwera może używać komend `/youtube`.',
        flags: MessageFlags.Ephemeral,
      })
    }

    const subcommand = interaction.options.getSubcommand()

    if (subcommand === 'check') await check(interaction)
    if (subcommand === 'counter') await counter(interaction)
    if (subcommand === 'disable') await disable(interaction)
    if (subcommand === 'enable') await enable(interaction)
    if (subcommand === 'status') await status(interaction)
  },
}
