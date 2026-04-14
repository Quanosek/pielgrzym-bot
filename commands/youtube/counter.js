const { MessageFlags, PermissionFlagsBits } = require('discord.js')

const YTSubsMonitor = require('../../services/yt-subs-monitor')
const YTViewsMonitor = require('../../services/yt-views-monitor')

const { permissionDisplayNames } = require('../../utils/permissions')
const GuildConfig = require('../../utils/guild-config')

const requiredPerms = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels]

module.exports = async (interaction) => {
  const guildId = interaction.guildId
  const type = interaction.options.getString('type')
  const voiceChannel = interaction.options.getChannel('channel')

  const botMember = interaction.guild.members.me
  const permissions = voiceChannel.permissionsFor(botMember)
  const missingPerms = requiredPerms.filter((perm) => !permissions.has(perm))

  if (missingPerms.length > 0) {
    const missingNames = missingPerms.map((perm) => `\`${permissionDisplayNames[perm] || perm}\``).join(', ')
    return interaction.reply({
      content: `🛑 Bot nie ma wystarczających uprawnień na kanale <#${voiceChannel.id}>:\n\n${missingNames}\n\nUstaw te uprawnienia ręcznie w ustawieniach kanału i spróbuj ponownie.`,
      flags: MessageFlags.Ephemeral,
    })
  }

  const currentConfig = await GuildConfig.getConfig(guildId)

  if (type === 'subs') {
    await GuildConfig.updateGuildConfig(guildId, {
      ytMonitoring: {
        ...currentConfig.ytMonitoring,
        counter: {
          ...currentConfig.ytMonitoring?.counter,
          subsChannelId: voiceChannel.id,
        },
      },
    })

    await interaction.reply(`✅ Ustawiono kanał <#${voiceChannel.id}> jako licznik subskrypcji.`)

    console.log('📊 Updating subscriber count on user demand'.gray)
    const ytSubsMonitor = new YTSubsMonitor(interaction.client, guildId)
    await ytSubsMonitor.updateSubscriberCount()
  }

  if (type === 'views') {
    await GuildConfig.updateGuildConfig(guildId, {
      ytMonitoring: {
        ...currentConfig.ytMonitoring,
        counter: {
          ...currentConfig.ytMonitoring?.counter,
          viewsChannelId: voiceChannel.id,
        },
      },
    })

    await interaction.reply(`✅ Ustawiono kanał <#${voiceChannel.id}> jako licznik wyświetleń.`)

    console.log('📊 Updating views count on user demand'.gray)
    const ytViewsMonitor = new YTViewsMonitor(interaction.client, guildId)
    await ytViewsMonitor.updateViewsCount()
  }
}
