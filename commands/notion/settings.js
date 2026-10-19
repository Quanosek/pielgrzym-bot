const { randomBytes } = require('node:crypto')
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js')
const notion = require('../../config/notion')

const newRevision = () => randomBytes(6).toString('hex')
const roles = {
  source: { label: 'tabelę', description: 'Wybierz źródło danych, do którego mają trafiać wpisy.' },
  title: { label: 'kolumnę tytułu', description: 'Która kolumna ma otrzymywać tytuł filmu?', type: 'title' },
  date: {
    label: 'kolumnę daty publikacji',
    description: 'Która kolumna daty steruje kalendarzem? Zapiszemy datę i godzinę publikacji.',
    type: 'date',
  },
  url: { label: 'kolumnę adresu filmu', description: 'Która kolumna typu URL ma otrzymywać adres YouTube?', type: 'url' },
  status: { label: 'kolumnę statusu', description: 'Czy ustawiać status opublikowanego filmu? Wybierz kolumnę lub pomiń ten krok.' },
  value: { label: 'wartość statusu', description: 'Która istniejąca wartość oznacza opublikowany film?' },
}

function newConfiguration(sources) {
  return sources.length === 1
    ? { enabled: false, sourceId: sources[0].id, sourceName: sources[0].name, fields: {}, step: 'title', revision: newRevision() }
    : { enabled: false, sources, fields: {}, step: 'source', revision: newRevision() }
}

async function choices(guildId, config) {
  if (config.step === 'source') return config.sources.map((source) => ({ label: source.name, value: source.id }))
  const source = await notion.getSource(guildId, config.sourceId)
  const properties = Object.values(source.properties)
  if (config.step === 'value') {
    const field = properties.find((property) => property.id === config.fields.status?.id)
    if (!field || !['status', 'select'].includes(field.type)) throw new Error('Configured Notion status property is no longer available')
    return field[field.type].options.map((option) => ({ label: option.name, value: option.id }))
  }
  const options = properties
    .filter((property) => (config.step === 'status' ? ['status', 'select'].includes(property.type) : property.type === roles[config.step].type))
    .map((property) => ({ label: property.name, value: property.id }))
  if (config.step === 'status') options.unshift({ label: 'Bez ustawiania statusu', value: '__skip__' })
  return options
}

async function render(guildId, config, page = 0) {
  if (config.enabled) {
    return {
      content:
        '✅ Zakończono konfigurację Notion. Bot uzupełni tabelę filmami zapisanymi w lokalnym cache od uruchomienia monitorowania YouTube, a potem będzie dodawał nowe publikacje. Postęp: `/notion status`.',
      components: [],
      allowedMentions: { parse: [] },
    }
  }
  const options = await choices(guildId, config)
  if (!options.length) {
    return {
      content: `⚠️ Brak zgodnej kolumny lub wartości dla kroku „${roles[config.step].label}”. Dodaj ją w oryginalnej bazie Notion i otwórz ponownie \`/notion settings\`.`,
      components: [],
      allowedMentions: { parse: [] },
    }
  }
  const pages = Math.ceil(options.length / 25)
  const currentPage = Math.max(0, Math.min(pages - 1, Number.isSafeInteger(page) ? page : 0))
  const customId = `notion:${config.revision}:${config.step}`
  const select = new StringSelectMenuBuilder()
    .setCustomId(`${customId}:${currentPage}`)
    .setPlaceholder(`Wybierz ${roles[config.step].label}`)
    .addOptions(
      options.slice(currentPage * 25, (currentPage + 1) * 25).map((option) => ({ ...option, label: option.label.slice(0, 100) || option.value })),
    )
  const components = [new ActionRowBuilder().addComponents(select)]
  if (pages > 1) {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${customId}:${currentPage - 1}`)
          .setLabel('Poprzednia strona')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId(`${customId}:${currentPage + 1}`)
          .setLabel('Następna strona')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === pages - 1),
      ),
    )
  }
  return {
    content: `**Konfiguracja Notion${config.sourceName ? ` — ${config.sourceName.slice(0, 150)}` : ''}**\n${roles[config.step].description}\nStrona ${currentPage + 1}/${pages}. Zapis pozostaje wstrzymany do zakończenia konfiguracji.`,
    components,
    allowedMentions: { parse: [] },
  }
}

async function applySelection(guildId, config, value, youtubeConfig) {
  const available = await choices(guildId, config)
  if (!available.some((option) => option.value === value)) throw new Error('Selected Notion property or option is unavailable')
  const next = { ...config, fields: { ...config.fields }, revision: newRevision() }
  if (config.step === 'source') {
    const selected = config.sources.find((source) => source.id === value)
    next.sourceId = selected.id
    next.sourceName = selected.name
    delete next.sources
    next.step = 'title'
    return next
  }
  const source = await notion.getSource(guildId, config.sourceId)
  if (config.step === 'status' && value === '__skip__') {
    delete next.fields.status
    next.step = 'complete'
  } else if (config.step === 'value') {
    const property = Object.values(source.properties).find((entry) => entry.id === config.fields.status.id)
    const option = property[property.type].options.find((entry) => entry.id === value)
    next.fields.status = { ...next.fields.status, optionId: option.id, optionName: option.name }
    next.step = 'complete'
  } else {
    const property = Object.values(source.properties).find((entry) => entry.id === value)
    next.fields[config.step] = { id: property.id, name: property.name, type: property.type }
    next.step = { title: 'date', date: 'url', url: 'status', status: 'value' }[config.step]
  }
  if (next.step === 'complete') {
    notion.validateFields(source, next.fields)
    const setupDate = youtubeConfig?.setupDate
    const numericDate = Number(setupDate)
    const startedAt = Number.isFinite(numericDate) && numericDate > 0 ? numericDate : new Date(setupDate).getTime()
    if (!youtubeConfig?.enabled || !youtubeConfig.youtubeChannel?.id || !Number.isFinite(startedAt) || startedAt <= 0) {
      throw new Error('YouTube monitoring must be enabled with a valid setup date')
    }
    next.enabled = true
    next.youtubeChannelId = youtubeConfig.youtubeChannel.id
    next.monitoringStartedAt = startedAt
    next.historyPending = true
  }
  return next
}

module.exports = { newRevision, newConfiguration, render, applySelection }
