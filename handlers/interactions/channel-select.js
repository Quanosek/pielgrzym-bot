module.exports = (interaction) => {
  if (!interaction.isChannelSelectMenu()) return null

  return {
    customId: interaction.customId,
    values: interaction.values || [],
    selectedValue: interaction.values?.[0] || null,
  }
}
