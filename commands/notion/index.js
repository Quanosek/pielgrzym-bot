const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js')
const notion = require('../../config/notion')
const GuildConfig = require('../../utils/guild-config')
const store = require('../../utils/notion-store')
const runGuildTask = require('../../utils/yt-task')
const publisher = require('../../services/notion-publisher')
const settings = require('./settings')
const auth = require('../../utils/notion-auth')
const oauth = require('../../services/notion-oauth')

function authorizationButtons(state, url, reviewed = false) {
  const row = new ActionRowBuilder()
  if (url) row.addComponents(new ButtonBuilder().setLabel('Autoryzuj w Notion').setStyle(ButtonStyle.Link).setURL(url))
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`notion-oauth:${state}`)
      .setLabel(reviewed ? 'Potwierdź przestrzeń roboczą' : 'Sprawdź autoryzację')
      .setStyle(ButtonStyle.Primary),
  )
  return [row]
}

function isAdministrator(interaction) {
  return (
    !!interaction.guildId && (interaction.user.id === process.env.OWNER_ID || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))
  )
}

async function reportError(interaction, error) {
  console.error(`[Notion] Guild #${interaction.guildId}: Configuration failed:`, error.message)
  const response = { content: `⚠️ ${notion.userError(error)}`, components: [], allowedMentions: { parse: [] } }
  if (interaction.deferred || interaction.replied) await interaction.editReply(response)
  else await interaction.reply({ ...response, flags: MessageFlags.Ephemeral })
}

module.exports = {
  permissions: [],
  data: new SlashCommandBuilder()
    .setName('notion')
    .setDescription('Zapisuj opublikowane filmy YouTube w tabeli Notion')
    .setDMPermission(false)
    .addSubcommand((command) => command.setName('connect').setDescription('Połącz własną przestrzeń roboczą Notion (tylko administrator)'))
    .addSubcommand((command) => command.setName('disconnect').setDescription('Usuń połączenie Notion tego serwera (tylko administrator)'))
    .addSubcommand((command) =>
      command
        .setName('enable')
        .setDescription('Połącz tabelę Notion i wybierz kolumny (tylko administrator)')
        .addStringOption((option) =>
          option.setName('source').setDescription('Link do oryginalnej bazy lub identyfikator źródła danych Notion').setRequired(true),
        ),
    )
    .addSubcommand((command) => command.setName('settings').setDescription('Przypisz kolumny tabeli Notion (tylko administrator)'))
    .addSubcommand((command) => command.setName('status').setDescription('Pokaż konfigurację i postęp zapisu filmów (tylko administrator)'))
    .addSubcommand((command) => command.setName('check').setDescription('Sprawdź połączenie i przetwórz oczekujące filmy (tylko administrator)'))
    .addSubcommand((command) => command.setName('disable').setDescription('Wstrzymaj zapis w Notion bez usuwania wpisów (tylko administrator)'))
    .addSubcommand((command) =>
      command
        .setName('retry')
        .setDescription('Ponów niepewny zapis po ręcznym sprawdzeniu tabeli (tylko administrator)')
        .addStringOption((option) => option.setName('video-id').setDescription('Identyfikator filmu YouTube z listy oczekujących').setRequired(true))
        .addBooleanOption((option) =>
          option.setName('confirmed').setDescription('Potwierdzam, że wpisu nie ma w Notion i nie trwa jego tworzenie').setRequired(true),
        ),
    ),

  async execute(interaction) {
    if (!isAdministrator(interaction)) {
      return interaction.reply({ content: '🛑 Tylko administrator serwera może konfigurować integrację Notion.', flags: MessageFlags.Ephemeral })
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    try {
      const command = interaction.options.getSubcommand()
      if (command === 'connect') {
        let authorization
        try {
          authorization = oauth.createAuthorization(interaction.guildId, interaction.user.id)
        } catch (error) {
          console.error('[Notion OAuth] Cannot begin authorization:', error.message)
          return interaction.editReply(
            '⚠️ Autoryzacja Notion nie jest dostępna. Opiekun bota musi skonfigurować publiczną integrację OAuth i działający adres powrotu HTTPS.',
          )
        }
        return interaction.editReply({
          content:
            'Połącz własną przestrzeń roboczą Notion, udostępnij oryginalną bazę i wróć do tego panelu. Następnie sprawdź i potwierdź wybraną przestrzeń roboczą. Link wygasa po 10 minutach — nie udostępniaj go innym osobom.',
          components: authorizationButtons(authorization.state, authorization.url),
        })
      }
      if (command === 'check') {
        const config = (await GuildConfig.getConfig(interaction.guildId))?.notionIntegration
        if (!config?.enabled) return interaction.editReply('⚠️ Dokończ konfigurację przez `/notion enable` lub `/notion settings`.')
        notion.validateFields(await notion.getSource(interaction.guildId, config.sourceId), config.fields)
        const result = await publisher.flushGuild(interaction.guildId)
        if (result.paused) {
          return interaction.editReply(
            '⏸️ Brakuje zgodnego połączenia Notion lub monitorowanie YouTube wskazuje inny kanał. Sprawdź `/notion status` i ponownie skonfiguruj połączenie.',
          )
        }
        return interaction.editReply({
          content: `✅ Sprawdzono połączenie. Zapisane wpisy w tej próbie: ${result.delivered}. Nieudane próby: ${result.failed}. Pozostałe wpisy przetwarza kolejka; sprawdź \`/notion status\`.`,
          allowedMentions: { parse: [] },
        })
      }

      await runGuildTask(`notion:${interaction.guildId}`, async () => {
        const guild = await GuildConfig.getConfig(interaction.guildId)
        const config = guild?.notionIntegration
        if (command === 'disconnect') {
          oauth.cancelGuild(interaction.guildId)
          await GuildConfig.updateGuildConfig(interaction.guildId, {
            notionIntegration: { ...config, enabled: false, revision: settings.newRevision() },
          })
          await runGuildTask(`notion-auth:${interaction.guildId}`, () => auth.saveConnection(interaction.guildId, null))
          return interaction.editReply(
            '🔌 Usunięto lokalne poświadczenia Notion tego serwera i wstrzymano zapis. Wpisy w Notion pozostały bez zmian. Uprawnienia aplikacji możesz dodatkowo cofnąć w Notion.',
          )
        }
        const connection = await auth.getConnection(interaction.guildId)
        if (command === 'status') {
          const state = await store.getGuild(interaction.guildId)
          const current = (entry) => entry.sourceId === config?.sourceId && entry.youtubeChannelId === config?.youtubeChannelId
          const pending = Object.values(state.pending)
          const currentPending = pending.filter(current)
          const completed = Object.keys(state.completed).filter((key) => key.startsWith(`${config?.sourceId}:`)).length
          const fields = Object.entries(config?.fields || {}).map(([role, field]) => {
            const label = { title: 'Tytuł', date: 'Data publikacji', url: 'Adres filmu', status: 'Status' }[role]
            return `${label}: ${field.name}${field.optionName ? ` → ${field.optionName}` : ''}`
          })
          const uncertain = currentPending.filter((job) => job.uncertain).map((job) => job.video.id)
          return interaction.editReply({
            content: [
              `**Notion: ${config?.enabled ? 'włączone' : 'wyłączone lub konfiguracja niedokończona'}**`,
              `Przestrzeń robocza: ${connection?.workspaceName || 'nie połączono — użyj /notion connect'}`,
              `Tabela: ${config?.sourceName || 'nie wybrano'}`,
              config?.enabled &&
              (!connection ||
                connection.workspaceId !== config.workspaceId ||
                !guild?.ytMonitoring?.enabled ||
                guild.ytMonitoring.youtubeChannel?.id !== config.youtubeChannelId)
                ? '⏸️ Zapis wstrzymany: niezgodne połączenie Notion lub monitorowany kanał YouTube.'
                : '',
              ...fields,
              `Zapisane lub już istniejące adresy filmów w tej tabeli: ${completed}`,
              `Oczekujące: ${currentPending.length}. Wstrzymane dla innych konfiguracji: ${pending.length - currentPending.length}.`,
              config?.historyPending ? 'Historia z lokalnej pamięci podręcznej czeka na dodanie do kolejki.' : '',
              currentPending.some((job) => job.attempts > 0)
                ? '⚠️ Część wpisów oczekuje po błędzie. Sprawdź uprawnienia i kolumny przez `/notion check`.'
                : '',
              uncertain.length
                ? `⚠️ Zapisy wymagające sprawdzenia tabeli: ${uncertain.slice(0, 10).join(', ')}. Jeśli wpisu rzeczywiście nie ma, użyj \`/notion retry\`.`
                : '',
            ]
              .filter(Boolean)
              .join('\n')
              .slice(0, 1950),
            allowedMentions: { parse: [] },
          })
        }
        if (command === 'disable') {
          if (config) {
            await GuildConfig.updateGuildConfig(interaction.guildId, {
              notionIntegration: { ...config, enabled: false, revision: settings.newRevision() },
            })
          }
          return interaction.editReply('⏸️ Zapis w Notion został wstrzymany. Istniejące wpisy i kolejka nie zostały usunięte.')
        }
        if (command === 'retry') {
          if (!config?.enabled) return interaction.editReply('⚠️ Najpierw dokończ konfigurację Notion.')
          if (!interaction.options.getBoolean('confirmed')) {
            return interaction.editReply('⚠️ Najpierw sprawdź w Notion, czy wpis już istnieje. Ponowienie bez sprawdzenia może utworzyć duplikat.')
          }
          const key = `${config.sourceId}:${interaction.options.getString('video-id')}`
          const state = await store.getGuild(interaction.guildId)
          if (!state.pending[key]) return interaction.editReply('⚠️ Nie znaleziono tego filmu w kolejce wybranej tabeli.')
          await store.updateGuild(interaction.guildId, (data) => {
            data.pending[key].uncertain = false
            data.pending[key].fields = config.fields
            data.pending[key].nextAttemptAt = 0
          })
          return interaction.editReply('✅ Odblokowano ponowienie. Kolejka przetworzy film automatycznie.')
        }
        if (!connection) return interaction.editReply('⚠️ Najpierw połącz własną przestrzeń roboczą przez `/notion connect`.')
        if (!guild?.ytMonitoring?.enabled || !guild.ytMonitoring.youtubeChannel?.id) {
          return interaction.editReply('⚠️ Najpierw włącz monitorowanie kanału YouTube przez `/youtube enable`.')
        }
        if (command === 'enable') {
          const sources = await notion.resolveSources(interaction.guildId, interaction.options.getString('source'))
          const next = { ...settings.newConfiguration(sources), workspaceId: connection.workspaceId }
          await GuildConfig.updateGuildConfig(interaction.guildId, { notionIntegration: next })
          return interaction.editReply(await settings.render(interaction.guildId, next))
        }
        if (!config?.sourceId) return interaction.editReply('⚠️ Najpierw wskaż tabelę przez `/notion enable`.')
        if (config.workspaceId !== connection.workspaceId)
          return interaction.editReply('⚠️ Połączono inną przestrzeń roboczą. Wybierz jej tabelę przez `/notion enable`.')
        const next = { ...config, enabled: false, step: 'title', revision: settings.newRevision() }
        await GuildConfig.updateGuildConfig(interaction.guildId, { notionIntegration: next })
        await interaction.editReply(await settings.render(interaction.guildId, next))
      })
    } catch (error) {
      await reportError(interaction, error)
    }
  },

  async handleComponent(interaction) {
    if (!isAdministrator(interaction)) {
      return interaction.reply({ content: '🛑 Tylko administrator serwera może zmieniać ustawienia Notion.', flags: MessageFlags.Ephemeral })
    }
    await interaction.deferUpdate()
    try {
      if (interaction.customId.startsWith('notion-oauth:')) {
        const state = interaction.customId.slice('notion-oauth:'.length)
        const result = await oauth.confirmAuthorization(state, interaction)
        return interaction.editReply({
          content: result.message,
          components: result.keepPanel ? authorizationButtons(state, null, result.reviewed) : [],
          allowedMentions: { parse: [] },
        })
      }
      await runGuildTask(`notion:${interaction.guildId}`, async () => {
        const guild = await GuildConfig.getConfig(interaction.guildId)
        const config = guild?.notionIntegration
        const [, revision, step, page] = interaction.customId.split(':')
        if (!config || config.revision !== revision || config.step !== step) {
          return interaction.editReply({ content: '⚠️ Ten panel jest nieaktualny. Otwórz ponownie `/notion settings`.', components: [] })
        }
        const connection = await auth.getConnection(interaction.guildId)
        if (!connection || connection.workspaceId !== config.workspaceId) {
          return interaction.editReply({
            content: '⚠️ Połączenie Notion zmieniło się. Użyj `/notion connect`, a następnie `/notion enable`.',
            components: [],
          })
        }
        if (interaction.isButton()) return interaction.editReply(await settings.render(interaction.guildId, config, Number(page)))
        const next = await settings.applySelection(interaction.guildId, config, interaction.values[0], guild.ytMonitoring)
        await GuildConfig.updateGuildConfig(interaction.guildId, { notionIntegration: next })
        await interaction.editReply(await settings.render(interaction.guildId, next))
      })
    } catch (error) {
      await reportError(interaction, error)
    }
  },
}
