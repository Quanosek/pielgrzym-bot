require('dotenv').config()
const { Client, GatewayIntentBits } = require('discord.js')

const colors = require('colors')
colors.enable()

const CommandsHandler = require('./handlers/commands.js')
const EventsHandler = require('./handlers/events.js')
const webServer = require('./services/web-server')
const { getModulesConfig } = require('./config')

console.info('Starting bot...'.cyan)

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

CommandsHandler(client)
EventsHandler(client)

async function start() {
  const { features } = getModulesConfig()
  console.info(
    `[Modules] Discord: ${features.discord ? 'enabled' : 'disabled'} | YouTube: ${features.youtube ? 'configured' : 'no-key'} | Web: ${features.web ? 'enabled' : 'disabled'} | Notion: ${features.notion ? 'configured' : 'inactive'}`
      .gray,
  )
  await webServer.startServer()
  await client.login(process.env.DISCORD_TOKEN)
}

start().catch(async (error) => {
  console.error('Bot startup failed:', error.message)
  process.exitCode = 1
  await webServer.stopServer()
  await client.destroy()
})
