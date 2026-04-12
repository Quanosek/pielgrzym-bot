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
  [BotPermissions.MANAGE_GUILD]: 'Manage Guild',
  [BotPermissions.MANAGE_ROLES]: 'Manage Roles',
  [BotPermissions.MANAGE_CHANNELS]: 'Manage Channels',
  [BotPermissions.CREATE_INSTANT_INVITE]: 'Create Instant Invite',
  [BotPermissions.VIEW_CHANNEL]: 'View Channel',

  [BotPermissions.SEND_MESSAGES]: 'Send Messages',
  [BotPermissions.EMBED_LINKS]: 'Embed Links',
  [BotPermissions.READ_MESSAGE_HISTORY]: 'Read Message History',
  [BotPermissions.ADD_REACTIONS]: 'Add Reactions',

  [BotPermissions.CONNECT]: 'Connect',
})

module.exports = { BotPermissions, permissionDisplayNames }
