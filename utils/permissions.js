const { PermissionFlagsBits } = require('discord.js')

const BotPermissions = Object.freeze({
  MANAGE_GUILD: PermissionFlagsBits.ManageGuild,
  MANAGE_ROLES: PermissionFlagsBits.ManageRoles,
  MANAGE_CHANNELS: PermissionFlagsBits.ManageChannels,
  CREATE_INSTANT_INVITE: PermissionFlagsBits.CreateInstantInvite,
  VIEW_CHANNEL: PermissionFlagsBits.ViewChannel,

  SEND_MESSAGES: PermissionFlagsBits.SendMessages,
  EMBED_LINKS: PermissionFlagsBits.EmbedLinks,
  READ_MESSAGE_HISTORY: PermissionFlagsBits.ReadMessageHistory,
  ADD_REACTIONS: PermissionFlagsBits.AddReactions,

  CONNECT: PermissionFlagsBits.Connect,
})

const permissionDisplayNames = Object.freeze({
  [BotPermissions.MANAGE_GUILD]: 'Zarządzanie serwerem',
  [BotPermissions.MANAGE_ROLES]: 'Zarządzanie rolami',
  [BotPermissions.MANAGE_CHANNELS]: 'Zarządzanie kanałami',
  [BotPermissions.CREATE_INSTANT_INVITE]: 'Tworzenie zaproszeń',
  [BotPermissions.VIEW_CHANNEL]: 'Wyświetlanie kanałów',

  [BotPermissions.SEND_MESSAGES]: 'Wysyłanie wiadomości',
  [BotPermissions.EMBED_LINKS]: 'Zamieszczanie linków',
  [BotPermissions.READ_MESSAGE_HISTORY]: 'Czytanie historii wiadomości',
  [BotPermissions.ADD_REACTIONS]: 'Dodawanie reakcji',

  [BotPermissions.CONNECT]: 'Łączenie',
})

module.exports = { BotPermissions, permissionDisplayNames }
