function _decimals(unitValue) {
  if (unitValue < 10) return 2
  if (unitValue < 100) return 1
  return 0
}

function formatNumber(value) {
  if (value >= 1_000_000_000) {
    const billions = value / 1_000_000_000
    return billions.toFixed(_decimals(billions)).replace('.', ',') + ' mld.'
  }

  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return millions.toFixed(_decimals(millions)).replace('.', ',') + ' mln.'
  }

  if (value >= 1_000) {
    const thousands = value / 1_000
    return thousands.toFixed(_decimals(thousands)).replace('.', ',') + ' tys.'
  }

  return String(value)
}

module.exports = { formatNumber }
