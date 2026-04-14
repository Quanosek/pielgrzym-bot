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
    }
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN)

const scope = process.argv[2]

const deployCommands = async () => {
  try {
    if (!scope) {
      console.log(`Started refreshing ${commands.length} application (/) commands (guild + global).`.cyan)

      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
        body: [],
      })
      console.log('-> Successfully deleted all guild commands.')
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
        body: commands,
      })

      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] })
      console.log('-> Successfully deleted all global commands.')
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands })

      console.log('Successfully reloaded all guild + global application (/) commands!'.cyan)
    } else {
      console.log(`Started refreshing ${commands.length} application (/) commands (${scope}).`.cyan)

      if (scope === 'global') {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] })
        console.log('-> Successfully deleted all global commands.')
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands })
      } else if (scope === 'guild') {
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: [] })
        console.log('-> Successfully deleted all guild commands.')
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands })
      } else {
        throw new Error(`Invalid scope "${scope}". Use "guild" or "global".`)
      }

      console.log(`Successfully reloaded all ${scope} application (/) commands!`.cyan)
    }
  } catch (error) {
    console.error(error)
  }
}

deployCommands()
