const { Events } = require('discord.js')

module.exports = {
  name: Events.ClientReady,
  once: true,

  execute(client) {
    console.log('Bot ' + `${client.user.tag}`.rainbow + ' is ready to use!')
  },
}
