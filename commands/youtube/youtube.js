const { EmbedBuilder, MessageFlags, SlashCommandBuilder } = require('discord.js')

const { youtube } = require('../../config/youtube')
const GuildConfig = require('../../utils/guild-config')

const YTVideosCache = require('../../services/yt-videos-cache')
const YTVideosMonitor = require('../../services/yt-videos-monitor')
const YTCommentsMonitor = require('../../services/yt-comments-monitor')

async function resolveYouTubeChannelId(channelName) {
  const cleanName = channelName.replace(/^@/, '')

  const searches = [
    { part: 'id,snippet', forHandle: cleanName },
    { part: 'id,snippet', forUsername: cleanName },
  ]

  for (const params of searches) {
    const response = await youtube.channels.list(params).catch(() => null)

    if (response?.data?.items?.[0]) {
      const item = response.data.items[0]
      return { id: item.id, snippet: item.snippet }
    }
  }

  return null
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('youtube')
    .setDescription('Zarządzanie monitorowaniem kanału YouTube')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setup')
        .setDescription('Włącz/wyłącz monitorowanie kanału YouTube')
        .addBooleanOption((option) => option.setName('enable').setDescription('Włącz/wyłącz monitorowanie').setRequired(true))
        .addStringOption((option) => option.setName('channel-name').setDescription('Nazwa kanału YouTube')),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('check')
        .setDescription('Sprawdź nowe treści od razu')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Typ treści do sprawdzenia')
            .setRequired(true)
            .addChoices({ name: 'Videos', value: 'videos' }, { name: 'Comments', value: 'comments' }),
        ),
    )
    .addSubcommand((subcommand) => subcommand.setName('info').setDescription('Pokaż informacje o monitorowaniu kanału YouTube')),

  async execute(interaction) {
    const guildId = interaction.guildId

    if (interaction.user.id !== process.env.OWNER_ID) {
      return await interaction.reply({
        content: '🛑 Tylko właściciel bota może używać tej komendy.',
        flags: MessageFlags.Ephemeral,
      })
    }

    const subcommand = interaction.options.getSubcommand()

    if (subcommand === 'setup') {
      const enable = interaction.options.getBoolean('enable')

      if (enable) {
        const currentConfig = await GuildConfig.getConfig(guildId)

        if (currentConfig?.ytMonitoring?.enabled) {
          return await interaction.reply({
            content: '⚠️ Monitoring kanału YouTube jest już włączony!',
            flags: MessageFlags.Ephemeral,
          })
        }

        const channelName = interaction.options.getString('channel-name')

        if (!channelName) {
          return await interaction.reply({
            content: '❌ Podaj nazwę kanału YouTube podczas włączania monitorowania.',
            flags: MessageFlags.Ephemeral,
          })
        }

        const youtubeChannel = await resolveYouTubeChannelId(channelName)

        if (!youtubeChannel) {
          return await interaction.reply({
            content: `❌ Nie znaleziono kanału YouTube o nazwie "${channelName}". Upewnij się, że podałeś poprawną nazwę (handle lub username).`,
            flags: MessageFlags.Ephemeral,
          })
        }

        const notificationChannelId = interaction.channelId

        await GuildConfig.enableMonitoring({ guildId, notificationChannelId, youtubeChannel })

        console.log('🔄 Refreshing videos cache on user demand'.gray)
        const ytVideosCache = new YTVideosCache(interaction.client, guildId)
        await ytVideosCache.refreshVideosCache()

        const embed = new EmbedBuilder()
          .setColor('#ff0033')
          .setTitle('Monitorowanie kanału YouTube zostało włączone!')
          .setThumbnail(youtubeChannel.snippet.thumbnails.high.url)
          .setDescription('Teraz będziesz otrzymywać powiadomienia o nowych filmach i komentarzach z wybranego kanału')
          .addFields({
            name: 'Nazwa kanału',
            value: `[${youtubeChannel.snippet.title}](https://www.youtube.com/channel/${youtubeChannel.id})`,
          })

        await interaction.reply({ embeds: [embed] })
      } else {
        await GuildConfig.disableMonitoring(guildId)
        return await interaction.reply('Monitorowanie kanału YouTube zostało wyłączone.')
      }
    } else if (subcommand === 'check') {
      const type = interaction.options.getString('type')

      if (type === 'videos') {
        await interaction.reply({
          content: '🔍 Sprawdzam nowe filmy',
          flags: MessageFlags.Ephemeral,
        })

        console.log('🎬 Checking for new videos on user demand'.gray)
        const ytVideosMonitor = new YTVideosMonitor(interaction.client, guildId)
        await ytVideosMonitor.checkNewVideos()
      } else if (type === 'comments') {
        await interaction.reply({
          content: '💬 Sprawdzam nowe komentarze',
          flags: MessageFlags.Ephemeral,
        })

        console.log('💬 Checking for new comments on user demand'.gray)
        const ytCommentsMonitor = new YTCommentsMonitor(interaction.client, guildId)
        await ytCommentsMonitor.checkNewComments()
      }
    } else if (subcommand === 'info') {
      const config = await GuildConfig.getConfig(guildId)

      if (!config?.ytMonitoring?.enabled) {
        return await interaction.reply('❌ Monitorowanie kanału YouTube nie jest włączone na tym serwerze.')
      }

      const { notificationChannelId, setupDate, youtubeChannel } = config.ytMonitoring

      const embed = new EmbedBuilder()
        .setColor('#ff0033')
        .setTitle('Informacje o monitorowaniu kanału YouTube')
        .setThumbnail(youtubeChannel.snippet.thumbnails.high.url)
        .addFields(
          {
            name: 'Nazwa kanału',
            value: `[${youtubeChannel.snippet.title}](https://www.youtube.com/channel/${youtubeChannel.id})`,
          },
          { name: 'Kanał powiadomień', value: `<#${notificationChannelId}>` },
          {
            name: 'Data rozpoczęcia monitorowania',
            value: new Date(setupDate).toLocaleString('pl-PL'),
          },
        )

      await interaction.reply({ embeds: [embed] })
    }
  },
}
