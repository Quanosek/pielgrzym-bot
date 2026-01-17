const { SlashCommandBuilder } = require('discord.js')

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),

  async execute(interaction) {
    // await interaction.reply('Pong!')
    // await interaction.reply({ content: 'Secret Pong!', flags: MessageFlags.Ephemeral })

    // await interaction.reply('Pong!')
    // await interaction.editReply('Pong again!')

    // await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    // await interaction.editReply('Pong!')

    // await interaction.reply('Pong!')
    // await interaction.followUp({ content: 'Pong again!', flags: MessageFlags.Ephemeral })

    const response = await interaction.reply({ content: 'Pong!', withResponse: true })
    console.log(response.resource.message)
    const message = await interaction.deleteReply()
    console.log(message)

    const modal = new ModalBuilder().setCustomId('myModal').setTitle('My Modal')
    const hobbiesInput = new TextInputBuilder()
      .setCustomId('hobbiesInput')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('card games, films, books, etc.')
    const hobbiesLabel = new LabelBuilder()
      .setLabel('What are some of your favorite hobbies?')
      .setDescription('Activities you like to participate in')
      .setTextInputComponent(hobbiesInput)
    const favoriteStarterSelect = new StringSelectMenuBuilder()
      .setCustomId('starter')
      .setPlaceholder('Make a selection!')
      .setRequired(true)
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Bulbasaur').setDescription('The dual-type Grass/Poison Seed Pokémon.').setValue('bulbasaur'),
        new StringSelectMenuOptionBuilder().setLabel('Charmander').setDescription('The Fire-type Lizard Pokémon.').setValue('charmander'),
        new StringSelectMenuOptionBuilder().setLabel('Squirtle').setDescription('The Water-type Tiny Turtle Pokémon.').setValue('squirtle'),
      )
    const favoriteStarterLabel = new LabelBuilder()
      .setLabel("What's your favorite Gen 1 Pokémon starter?")
      .setStringSelectMenuComponent(favoriteStarterSelect)
    const text = new TextDisplayBuilder().setContent('Text that could not fit in to a label or description\n-# Markdown can also be used')
    const pictureOfTheWeekUpload = new FileUploadBuilder().setCustomId('picture')
    const pictureOfTheWeekLabel = new LabelBuilder()
      .setLabel('Picture of the Week')
      .setDescription('The best pictures you have taken this week')
      .setFileUploadComponent(pictureOfTheWeekUpload)
    modal.addLabelComponents(hobbiesLabel, favoriteStarterLabel).addTextDisplayComponents(text).addLabelComponents(pictureOfTheWeekLabel)
    await interaction.showModal(modal)
  },
}
