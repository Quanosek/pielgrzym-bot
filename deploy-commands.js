require('dotenv').config()
const fs = require('node:fs')
const path = require('node:path')
const { REST, Routes } = require('discord.js')

const colors = require('colors')
colors.enable()

const commands = []

const foldersPath = path.join(__dirname, 'commands')
const commandFolders = fs.readdirSync(foldersPath)

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder)
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'))

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file)
    const command = require(filePath)

    if (command.data && command.execute) {
      commands.push(command.data.toJSON())
    } else {
      console.warn(`The command at "${file}" is missing a required "data" or "execute" property.`.yellow)
    }
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN)

const deployCommands = async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`.cyan)

    // Reset Guild Commands
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: [] })
    console.log('-> Successfully deleted all guild commands.')

    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands })

    // // Reset Global Commands
    // await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] })
    // console.log('-> Successfully deleted all application commands.')

    // await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands })

    console.log(`Successfully reloaded all application (/) commands!`.cyan)
  } catch (error) {
    console.error(error)
  }
}

deployCommands()
