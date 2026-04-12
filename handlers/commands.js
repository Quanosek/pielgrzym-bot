const fs = require('node:fs')
const path = require('node:path')
const { Collection } = require('discord.js')

module.exports = (client) => {
  client.commands = new Collection()

  const foldersPath = path.join(__dirname, '../commands')
  const commandFolders = fs.readdirSync(foldersPath)

  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder)
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'))

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file)
      const command = require(filePath)

      if (!command.data || !command.execute) continue

      try {
        client.commands.set(command.data.name, command)
      } catch (error) {
        console.error(`Error loading a command "${file}":\n`.red + error)
      }
    }
  }
}
