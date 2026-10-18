const pendingTasks = new Map()

async function runGuildTask(guildId, operation) {
  const previous = pendingTasks.get(guildId) || Promise.resolve()
  const pending = previous.catch(() => {}).then(operation)
  pendingTasks.set(guildId, pending)
  try {
    return await pending
  } finally {
    if (pendingTasks.get(guildId) === pending) pendingTasks.delete(guildId)
  }
}

module.exports = runGuildTask
