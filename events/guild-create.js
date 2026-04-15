const { Events } = require('discord.js')
const GuildConfig = require('../utils/guild-config')

module.exports = {
  name: Events.GuildCreate,

  async execute(guild) {
    console.log(`Joined a new guild: "${guild.name}" (id: ${guild.id})`.gray)
    await GuildConfig.initializeGuildConfig(guild)
  },
}
