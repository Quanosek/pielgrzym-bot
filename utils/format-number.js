function _formatSpaced(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function _formatCompact(value) {
  function decimals(unitValue) {
    if (unitValue < 10) return 2
    if (unitValue < 100) return 1
    return 0
  }

  if (value >= 1_000_000_000) {
    const billions = value / 1_000_000_000
    return billions.toFixed(decimals(billions)).replace('.', ',') + ' mld.'
  }

  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return millions.toFixed(decimals(millions)).replace('.', ',') + ' mln.'
  }

  if (value >= 1_000) {
    const thousands = value / 1_000
    return thousands.toFixed(decimals(thousands)).replace('.', ',') + ' tys.'
  }

  return String(value)
}

function formatNumber(value, options) {
  const style = options?.style

  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return String(value)

  if (style === 'spaced') return _formatSpaced(numericValue)
  if (style === 'compact') return _formatCompact(numericValue)
  return String(numericValue)
}

module.exports = { formatNumber }
