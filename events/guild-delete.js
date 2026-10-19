const { Events } = require('discord.js')
const GuildConfig = require('../utils/guild-config')
const auth = require('../utils/notion-auth')
const oauth = require('../services/notion-oauth')
const runGuildTask = require('../utils/yt-task')

module.exports = {
  name: Events.GuildDelete,

  async execute(guild) {
    console.log(`Left a guild: "${guild.name}" (id: ${guild.id})`.gray)
    await runGuildTask(`notion:${guild.id}`, async () => {
      oauth.cancelGuild(guild.id)
      try {
        await runGuildTask(`notion-auth:${guild.id}`, () => auth.saveConnection(guild.id, null))
      } finally {
        await GuildConfig.deleteGuildConfig(guild.id)
      }
    })
  },
}
