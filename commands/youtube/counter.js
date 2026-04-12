const { PermissionFlagsBits } = require('discord.js')

const { permissionDisplayNames } = require('../../utils/permissions')
const YTSubsMonitor = require('../../services/yt-subs-monitor')
const GuildConfig = require('../../utils/guild-config')

const requiredPerms = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels]

module.exports = async (interaction) => {
  const guildId = interaction.guildId
  const type = interaction.options.getString('type')
  const voiceChannel = interaction.options.getChannel('channel')

  if (type === 'subs') {
    const botMember = interaction.guild.members.me
    const permissions = voiceChannel.permissionsFor(botMember)
    const missingPerms = requiredPerms.filter((perm) => !permissions.has(perm))

    if (missingPerms.length > 0) {
      const missingNames = missingPerms.map((perm) => `\`${permissionDisplayNames[perm] || perm}\``).join(', ')
      return interaction.reply({
        content: `🛑 Bot nie ma wystarczających uprawnień na kanale <#${voiceChannel.id}>:\n\n${missingNames}\n\nUstaw te uprawnienia ręcznie w ustawieniach kanału, a następnie spróbuj ponownie.`,
        ephemeral: true,
      })
    }

    const currentConfig = await GuildConfig.getConfig(guildId)

    await GuildConfig.updateGuildConfig(guildId, {
      ytMonitoring: {
        ...currentConfig.ytMonitoring,
        counter: {
          ...currentConfig.ytMonitoring?.counter,
          subsChannelId: voiceChannel.id,
        },
      },
    })

    console.log('📊 Updating subscriber count on user demand'.gray)
    const ytSubsMonitor = new YTSubsMonitor(interaction.client, guildId)
    await ytSubsMonitor.updateSubscriberCount()

    await interaction.reply(`✅ Ustawiono kanał <#${voiceChannel.id}> jako licznik subskrypcji.`)
  }
}
