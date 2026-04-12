const fs = require('node:fs')
const path = require('node:path')
const { SlashCommandBuilder } = require('discord.js')
const { BotPermissions: P } = require('../../utils/permissions')

function findCommandPath(commandName) {
  const foldersPath = path.join(__dirname, '../')
  const commandFolders = fs.readdirSync(foldersPath)

  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder)
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'))

    for (const file of commandFiles) {
      if (file === `${commandName}.js`) {
        return path.join(commandsPath, file)
      }
    }
  }

  return null
}

module.exports = {
  permissions: [P.SEND_MESSAGES],
  data: new SlashCommandBuilder()
    .setName('reload')
    .setDescription('Odśwież komendy bota (tylko właściciel)')
    .addStringOption((option) => option.setName('command').setDescription('Wybierz komendę do przeładowania')),

  async execute(interaction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return await interaction.reply({
        content: '🛑 Tylko właściciel bota może używać tej komendy.',
        ephemeral: true,
      })
    }

    const commandInput = interaction.options.getString('command')

    if (!commandInput) {
      let reloadedCount = 0
      let errors = []

      for (const [name, cmd] of interaction.client.commands) {
        try {
          const commandPath = findCommandPath(cmd.data.name)

          if (!commandPath) {
            throw new Error('Command file not found')
          }

          delete require.cache[require.resolve(commandPath)]
          const newCommand = require(commandPath)
          interaction.client.commands.set(newCommand.data.name, newCommand)
          reloadedCount++
        } catch (error) {
          errors.push(`${name}: ${error.message}`)
          console.error(`Error reloading ${name}:`, error)
        }
      }

      if (errors.length > 0) {
        return await interaction.reply(
          `✅ Przeładowano pomyślnie ${reloadedCount} komend.\n❌ Błędy przy ${errors.length}:\n${errors.slice(0, 5).join('\n')}`,
        )
      }

      return await interaction.reply(`✅ Przeładowano pomyślnie wszystkie komendy (${reloadedCount})!`)
    }

    const commandName = commandInput.replace(/^\s+|\s+$/g, '').toLowerCase()
    const command = interaction.client.commands.get(commandName)

    if (!command) {
      return await interaction.reply({
        content: `❌ Nie znaleziono komendy \`${commandName}\`.`,
        ephemeral: true,
      })
    }

    const commandPath = findCommandPath(command.data.name)

    if (!commandPath) {
      return await interaction.reply({
        content: `❌ Nie znaleziono pliku komendy \`${commandName}\`.`,
        ephemeral: true,
      })
    }

    delete require.cache[require.resolve(commandPath)]

    try {
      const newCommand = require(commandPath)
      interaction.client.commands.set(newCommand.data.name, newCommand)
      await interaction.reply(`✅ Komenda \`${newCommand.data.name}\` została pomyślnie przeładowana!`)
    } catch (error) {
      console.error(error)
      await interaction.reply(`❌ Wystąpił błąd podczas przeładowania komendy \`${command.data.name}\`:\n\`${error.message}\``)
    }
  },
}
