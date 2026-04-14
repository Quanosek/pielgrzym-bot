const { EmbedBuilder, SlashCommandBuilder } = require('discord.js')
const { BotPermissions: P } = require('../../utils/permissions')

module.exports = {
  permissions: [P.SEND_MESSAGES, P.EMBED_LINKS, P.CREATE_INSTANT_INVITE, P.MANAGE_GUILD],
  data: new SlashCommandBuilder().setName('support').setDescription('Wesprzyj twórcę bota, by mógł dalej go rozwijać i utrzymywać'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor('#9b582e')
      .setTitle('💖 Wesprzyj twórcę bota!')
      .setDescription(
        'Jeśli chcesz wesprzeć twórcę bota, możesz to zrobić poprzez darowiznę. Każda pomoc jest mile widziana i pozwala na dalszy rozwój i utrzymanie bota.',
      )
      .addFields(
        {
          name: 'Repozytorium GitHub',
          value: '[Kliknij tutaj, aby odwiedzić repozytorium GitHub z kodem źródłowym bota](https://github.com/Quanosek/pielgrzym-bot)',
        },
        {
          name: 'Postaw kawę',
          value: '[Kliknij tutaj, aby postawić kawę dla twórcy bota](https://buycoffee.to/kubaklalo/)',
        },
      )
      .setFooter({ iconURL: 'https://github.com/Quanosek.png', text: '@quanosek' })

    await interaction.reply({ embeds: [embed] })
  },
}
