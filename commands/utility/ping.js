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

		const response = await interaction.reply({ content: 'Pong!', withResponse: true });
		console.log(response.resource.message);

		const message = await interaction.deleteReply();
		console.log(message);
	},
};
