const { Events } = require('discord.js')

const GuildConfig = require('../utils/guild-config')

module.exports = {
  name: Events.GuildDelete,

  async execute(guild) {
    console.log(`Left a guild: "${guild.name}" (id: ${guild.id})`.gray)
    await GuildConfig.deleteGuildConfig(guild.id)
  },
}
