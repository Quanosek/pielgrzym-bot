require('dotenv').config()
const { Client, GatewayIntentBits } = require('discord.js')

const colors = require('colors')
colors.enable()

const CommandsHandler = require('./handlers/commands.js')
const EventsHandler = require('./handlers/events.js')

console.info('Starting bot...'.cyan)

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

CommandsHandler(client)
EventsHandler(client)

client.login(process.env.DISCORD_TOKEN)
