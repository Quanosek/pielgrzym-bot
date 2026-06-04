const { EmbedBuilder } = require('discord.js')

const { youtube } = require('../../config/youtube')
const YTVideosCache = require('../../services/yt-videos-cache')
const GuildConfig = require('../../utils/guild-config')

module.exports = async (interaction) => {
  const guildId = interaction.guildId
  const config = await GuildConfig.getConfig(guildId)

  await interaction.deferReply()

  // Disable currently enabled monitoring if exists
  if (config?.ytMonitoring?.enabled) {
    await GuildConfig.disableMonitoring(guildId)
  }

  // Find YouTube channel by name
  const channelName = interaction.options.getString('channel-name')
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
    return await interaction.editReply({
      content: `❌ Nie znaleziono kanału YouTube o nazwie "${channelName}"! Upewnij się, że podana nazwa kanału jest poprawna.`,
    })
  }

  // Save new channel monitoring config
  const newVideosChannelId = interaction.channelId
  await GuildConfig.enableMonitoring({ guildId, newVideosChannelId, youtubeChannel })

  // Cache published channel latest videos data
  console.log('⬇️ Caching latest videos on user demand'.gray)
  const ytVideosCache = new YTVideosCache(interaction.client, guildId)
  await ytVideosCache.refreshVideosCache()

  // Return configured channel message
  const embed = new EmbedBuilder()
    .setColor('#9b582e')
    .setTitle('🔎 Monitorowanie kanału YouTube zostało włączone!')
    .setThumbnail(youtubeChannel.snippet.thumbnails.high.url)
    .setDescription('Teraz będziesz otrzymywać powiadomienia o nowych filmach i komentarzach z wybranego kanału.')
    .addFields({
      name: 'Nazwa kanału',
      value: `[${youtubeChannel.snippet.title}](https://www.youtube.com/channel/${youtubeChannel.id})`,
    })
    .setTimestamp()

  return await interaction.editReply({ embeds: [embed] })
}
