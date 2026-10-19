const fs = require('node:fs/promises')
const path = require('node:path')

const DATA_FILE = path.join(__dirname, '../data/notion-cache.min.json')
let queue = Promise.resolve()

function validateState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('Invalid Notion guild delivery state')
  for (const key of ['pending', 'completed']) {
    if (!state[key] || typeof state[key] !== 'object' || Array.isArray(state[key])) throw new Error(`Invalid Notion ${key} state`)
  }
  return state
}

async function getData() {
  try {
    const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'))
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid Notion delivery store')
    return data
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return {}
  }
}

async function updateGuild(guildId, operation) {
  const pending = queue.then(async () => {
    const data = await getData()
    const state = validateState(data[guildId] ?? { pending: {}, completed: {} })
    if (operation(state) === false) return state
    data[guildId] = state
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
    const temporaryFile = `${DATA_FILE}.${process.pid}.tmp`
    await fs.writeFile(temporaryFile, JSON.stringify(data))
    await fs.rename(temporaryFile, DATA_FILE)
    return state
  })
  queue = pending.catch(() => {})
  return pending
}

async function getGuild(guildId) {
  const data = await getData()
  return validateState(data[guildId] ?? { pending: {}, completed: {} })
}

module.exports = { getGuild, updateGuild }
