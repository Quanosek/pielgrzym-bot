const { SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('echo')
		.setDescription('Replies with your input!')
		.addStringOption((option) =>
			option
				.setName('input')
				.setDescription('The input to echo back')
				// .setRequired(true)
				// Ensure the text will fit in an embed description, if the user chooses that option
				.setMaxLength(2_000),
		)
		.addChannelOption((option) =>
			option
				.setName('channel')
				.setDescription('The channel to echo into')
				// Ensure the user can only select a TextChannel for output
				.addChannelTypes(ChannelType.GuildText),
		)
		// .addChannelOption((option) => option.setName('channel').setDescription('The channel to echo into'));
		.addBooleanOption((option) => option.setName('ephemeral').setDescription('Whether or not the echo should be ephemeral')),

	async execute(interaction) {
		const input = interaction.options.getString('input') || 'No input provided';
		const channel = interaction.options.getChannel('channel');
		const ephemeral = interaction.options.getBoolean('ephemeral') ?? false;

		if (channel) {
			await channel.send(input);
			await interaction.reply({ content: `Message sent to ${channel}!`, ephemeral: true });
		} else {
			await interaction.reply({ content: input, ephemeral });
		}
	},
};
