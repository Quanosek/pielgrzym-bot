const { MessageFlags, PermissionFlagsBits } = require('discord.js')

const YTSubsCounterMonitor = require('../../services/yt-subs-counter-monitor')
const YTViewsCounterMonitor = require('../../services/yt-views-counter-monitor')
const YTVideosCounterMonitor = require('../../services/yt-videos-counter-monitor')

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

  const config = await GuildConfig.getConfig(guildId)

  if (type === 'subs') {
    await GuildConfig.updateGuildConfig(guildId, {
      ytMonitoring: {
        ...config?.ytMonitoring,
        counters: {
          ...config?.ytMonitoring?.counters,
          subsChannelId: voiceChannel.id,
        },
      },
    })

    await interaction.reply(`✅ Ustawiono kanał <#${voiceChannel.id}> jako licznik subskrypcji.`)

    console.log('📊 Updating subscriber count on user demand'.gray)
    const monitor = new YTSubsCounterMonitor(interaction.client, guildId)
    await monitor.updateSubscriberCount()
  }

  if (type === 'views') {
    await GuildConfig.updateGuildConfig(guildId, {
      ytMonitoring: {
        ...config?.ytMonitoring,
        counters: {
          ...config?.ytMonitoring?.counters,
          viewsChannelId: voiceChannel.id,
        },
      },
    })

    await interaction.reply(`✅ Ustawiono kanał <#${voiceChannel.id}> jako licznik wyświetleń.`)

    console.log('📊 Updating views count on user demand'.gray)
    const monitor = new YTViewsCounterMonitor(interaction.client, guildId)
    await monitor.updateViewsCount()
  }

  if (type === 'videos') {
    await GuildConfig.updateGuildConfig(guildId, {
      ytMonitoring: {
        ...config?.ytMonitoring,
        counters: {
          ...config?.ytMonitoring?.counters,
          videosChannelId: voiceChannel.id,
        },
      },
    })

    await interaction.reply(`✅ Ustawiono kanał <#${voiceChannel.id}> jako licznik filmów.`)

    console.log('📊 Updating videos count on user demand'.gray)
    const monitor = new YTVideosCounterMonitor(interaction.client, guildId)
    await monitor.updateVideosCount()
  }
}
