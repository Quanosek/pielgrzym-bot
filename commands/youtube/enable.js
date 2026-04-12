const { EmbedBuilder } = require('discord.js')

const { youtube } = require('../../config/youtube')
const YTVideosCache = require('../../services/yt-videos-cache')
const GuildConfig = require('../../utils/guild-config')

module.exports = async (interaction) => {
  const guildId = interaction.guildId
  const currentConfig = await GuildConfig.getConfig(guildId)

  if (currentConfig?.ytMonitoring?.enabled) {
    return await interaction.reply({
      content: '⚠️ Monitoring kanału YouTube został już włączony!',
      ephemeral: true,
    })
  }

  const channelName = interaction.options.getString('channel-name')

  if (!channelName) {
    return await interaction.reply({
      content: '❌ Podaj nazwę kanału YouTube podczas włączania monitorowania.',
      ephemeral: true,
    })
  }

  const cleanName = channelName.replace(/^@/, '')
  const searches = [
    { part: 'id,snippet,statistics', forHandle: cleanName },
    { part: 'id,snippet,statistics', forUsername: cleanName },
  ]

  let youtubeChannel = null
  for (const params of searches) {
    const response = await youtube.channels.list(params).catch(() => null)

    if (response?.data?.items?.[0]) {
      const item = response.data.items[0]
      youtubeChannel = {
        id: item.id,
        snippet: item.snippet,
        statistics: item.statistics,
      }
      break
    }
  }

  if (!youtubeChannel) {
    return await interaction.reply({
      content: `❌ Nie znaleziono kanału YouTube o nazwie "${channelName}". Upewnij się, że podałeś poprawną nazwę (handle lub username).`,
      ephemeral: true,
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

  return await interaction.reply({ embeds: [embed] })
}
