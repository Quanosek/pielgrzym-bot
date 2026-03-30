const { ChannelType, EmbedBuilder, SlashCommandBuilder } = require('discord.js')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('Wyświetl informacje Discord')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('user')
        .setDescription('Informacje o użytkowniku')
        .addUserOption((option) => option.setName('target').setDescription('Nazwa użytkownika (@)')),
    )
    .addSubcommand((subcommand) => subcommand.setName('server').setDescription('Informacje o serwerze')),

  async execute(interaction) {
    if (interaction.options.getSubcommand() === 'user') {
      const user = interaction.options.getUser('target') ?? interaction.user

      // Get guild member information
      let member
      try {
        member = await interaction.guild.members.fetch(user.id)
      } catch {
        member = null
      }

      const embed = new EmbedBuilder()
        .setColor('#9b582e')
        .setTitle(`ℹ️ Informacje o ${user.bot ? 'bocie' : 'użytkowniku'}`)
        .setThumbnail(user.displayAvatarURL())

      if (user.globalName) {
        embed.addFields({ name: 'Wyświetlana nazwa', value: user.globalName })
      }

      if (user.bot) {
        embed.addFields({ name: 'Tag', value: `${user.tag}` }, { name: 'ID', value: user.id })
      } else {
        embed.addFields({ name: 'Nazwa użytkownika', value: user.username }, { name: 'ID', value: user.id })
        if (user.primaryGuild?.tag) embed.addFields({ name: 'Tag konta', value: `${user.primaryGuild.tag}` })
      }

      if (member.roles.cache.size > 1) {
        const roles = member.roles.cache
          .filter((role) => role.id !== interaction.guild.id) // ignore @everyone
          .map((role) => `<@&${role.id}>`)
          .join(', ')

        embed.addFields({ name: 'Role', value: roles })
      }

      embed.addFields(
        { name: 'Data utworzenia', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>` },
        { name: 'Data dołączenia na serwer', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` },
      )

      await interaction.reply({ embeds: [embed] })
    } else if (interaction.options.getSubcommand() === 'server') {
      const channelCount = interaction.guild.channels.cache.filter((c) => c.type !== ChannelType.GuildCategory).size
      const roleCount = interaction.guild.roles.cache.filter((r) => r.id !== interaction.guild.id).size

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

      const embed = new EmbedBuilder()
        .setColor('#9b582e')
        .setTitle('ℹ️ Informacje o serwerze')
        .setThumbnail(interaction.guild.iconURL())
        .addFields(
          { name: 'Nazwa', value: interaction.guild.name },
          { name: 'ID', value: interaction.guild.id },
          { name: 'Liczba członków', value: `${interaction.guild.memberCount}`, inline: true },
          { name: 'Liczba kanałów', value: `${channelCount}`, inline: true },
          { name: 'Liczba ról', value: `${roleCount}`, inline: true },
          { name: 'Właściciel', value: `<@${interaction.guild.ownerId}>` },
          { name: 'Data utworzenia', value: `<t:${Math.floor(interaction.guild.createdTimestamp / 1000)}:F>` },
          { name: 'Zaproszenie', value: inviteUrl },
        )

      await interaction.reply({ embeds: [embed] })
    }
  },
}
