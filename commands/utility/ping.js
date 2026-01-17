const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	// cooldown: 5,
	data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),

	async execute(interaction) {
		// await interaction.reply('Pong!');
		// await interaction.reply({ content: 'Secret Pong!', flags: MessageFlags.Ephemeral });

		// await interaction.reply('Pong!');
		// // do something that requires time (database queries, api requests, ...)
		// await interaction.editReply('Pong again!');

		// await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		// // you can do things that take time here (database queries, api requests, ...) that you need for the initial response
		// // you can take up to 15 minutes, then the interaction token becomes invalid!
		// await interaction.editReply('Pong!');

		// await interaction.reply('Pong!');
		// await interaction.followUp({ content: 'Pong again!', flags: MessageFlags.Ephemeral });

		// const response = await interaction.reply({ content: 'Pong!', withResponse: true });
		// console.log(response.resource.message);
		// const message = await interaction.deleteReply();
		// console.log(message);

		const modal = new ModalBuilder().setCustomId('myModal').setTitle('My Modal');
		const hobbiesInput = new TextInputBuilder()
			.setCustomId('hobbiesInput')
			// Short means a single line of text.
			.setStyle(TextInputStyle.Short)
			// Placeholder text displayed inside the text input box
			.setPlaceholder('card games, films, books, etc.');
		const hobbiesLabel = new LabelBuilder()
			// The label is a large header text that identifies the interactive component for the user.
			.setLabel('What are some of your favorite hobbies?')
			// The description is an additional optional subtext that aids the label.
			.setDescription('Activities you like to participate in')
			// Set text input as the component of the label
			.setTextInputComponent(hobbiesInput);
		const favoriteStarterSelect = new StringSelectMenuBuilder()
			.setCustomId('starter')
			.setPlaceholder('Make a selection!')
			// Modal only property on select menus to prevent submission, defaults to true
			.setRequired(true)
			.addOptions(
				// String select menu options
				new StringSelectMenuOptionBuilder()
					// Label displayed to user
					.setLabel('Bulbasaur')
					// Description of option
					.setDescription('The dual-type Grass/Poison Seed Pokémon.')
					// Value returned to you in modal submission
					.setValue('bulbasaur'),
				new StringSelectMenuOptionBuilder().setLabel('Charmander').setDescription('The Fire-type Lizard Pokémon.').setValue('charmander'),
				new StringSelectMenuOptionBuilder().setLabel('Squirtle').setDescription('The Water-type Tiny Turtle Pokémon.').setValue('squirtle'),
			);
		const favoriteStarterLabel = new LabelBuilder()
			.setLabel("What's your favorite Gen 1 Pokémon starter?")
			// Set string select menu as component of the label
			.setStringSelectMenuComponent(favoriteStarterSelect);
		const text = new TextDisplayBuilder().setContent('Text that could not fit in to a label or description\n-# Markdown can also be used');
		const pictureOfTheWeekUpload = new FileUploadBuilder().setCustomId('picture');
		const pictureOfTheWeekLabel = new LabelBuilder()
			.setLabel('Picture of the Week')
			.setDescription('The best pictures you have taken this week')
			// Set file upload as component of the label
			.setFileUploadComponent(pictureOfTheWeekUpload);
		// Add label to the modal
		modal.addLabelComponents(hobbiesLabel, favoriteStarterLabel).addTextDisplayComponents(text).addLabelComponents(pictureOfTheWeekLabel);
		// Show modal to the user
		await interaction.showModal(modal);
	},
};
