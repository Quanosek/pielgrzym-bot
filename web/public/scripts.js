function attachCopyButtons() {
  if (!navigator.clipboard) return
  for (const block of document.querySelectorAll('.prose .code-block')) {
    if (block.querySelector('.copy-btn')) continue
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'copy-btn'
    button.textContent = 'Kopiuj'
    button.setAttribute('aria-label', 'Skopiuj zawartość bloku kodu')
    button.addEventListener('click', async () => {
      const source = block.querySelector('pre code')
      try {
        await navigator.clipboard.writeText(source.textContent.trimEnd())
        button.textContent = 'Skopiowano'
        button.classList.add('copied')
      } catch {
        button.textContent = 'Błąd'
      }
      setTimeout(() => {
        button.textContent = 'Kopiuj'
        button.classList.remove('copied')
      }, 1800)
    })
    block.querySelector('.code-block-toolbar').appendChild(button)
  }
}

let refreshSidebar = () => {}

function attachSidebarTracking() {
  let links = []
  let headings = []
  let selected
  let pending = false
  let progress
  let progressAnimation
  let progressTarget = -1

  function updateProgress(activeIndex, positions, threshold) {
    if (!progress || !links.length) return
    const height = progress.offsetHeight
    if (!height) return
    const origin = progress.getBoundingClientRect().top
    const center = (index) => {
      const bounds = links[index].getBoundingClientRect()
      return bounds.top + bounds.height / 2 - origin
    }
    const clamp = (value) => Math.max(0, Math.min(1, value))
    let filled
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      filled = height
    } else if (activeIndex < 0) {
      const distance = window.scrollY + positions[0] - threshold
      filled = center(0) * clamp(window.scrollY / Math.max(1, distance))
    } else {
      const start = center(activeIndex)
      const last = activeIndex === links.length - 1
      const end = last ? height : center(activeIndex + 1)
      const distance = last
        ? document.documentElement.scrollHeight - window.innerHeight - window.scrollY - positions[activeIndex] + threshold
        : positions[activeIndex + 1] - positions[activeIndex]
      filled = start + (end - start) * clamp((threshold - positions[activeIndex]) / Math.max(1, distance))
    }
    const target = clamp(filled / height)
    if (Math.abs(target - progressTarget) < 0.0001) return
    const keyframes = [{ transform: `scaleY(${target})` }]
    if (progressAnimation) progressAnimation.effect.setKeyframes(keyframes)
    else progressAnimation = progress.animate(keyframes, { duration: 0, fill: 'forwards' })
    progressTarget = target
  }

  function reveal(link) {
    const container = link?.closest('.sidebar-scrollable')
    if (!container) return
    const bounds = container.getBoundingClientRect()
    const item = link.getBoundingClientRect()
    if (item.top < bounds.top + 12) container.scrollTop += item.top - bounds.top - 12
    else if (item.bottom > bounds.bottom - 12) container.scrollTop += item.bottom - bounds.bottom + 12
  }

  function update() {
    pending = false
    let activeIndex = -1
    const topbar = document.querySelector('.channel-topbar')
    const scrollMargin = headings.length ? Number.parseFloat(getComputedStyle(headings[0]).scrollMarginTop) || 0 : 0
    const threshold = Math.max(scrollMargin, topbar?.getBoundingClientRect().bottom || 0) + 8
    const positions = headings.map((heading) => heading.getBoundingClientRect().top)
    for (let index = 0; index < headings.length; index++) {
      if (positions[index] <= threshold) activeIndex = index
    }
    if (headings.length && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) activeIndex = headings.length - 1
    links.forEach((link, index) => {
      const active = index === activeIndex
      link.classList.toggle('active', active)
      if (active) link.setAttribute('aria-current', 'location')
      else link.removeAttribute('aria-current')
    })
    updateProgress(activeIndex, positions, threshold)
    const current = links[activeIndex] || document.querySelector('.channel-link.active')
    if (current !== selected) {
      selected = current
      reveal(current)
    }
  }

  function schedule() {
    if (pending) return
    pending = true
    requestAnimationFrame(update)
  }

  refreshSidebar = () => {
    const channel = document.querySelector('.channel-link.active')
    document.querySelectorAll('.channel-link').forEach((link) => {
      if (link === channel) link.setAttribute('aria-current', 'page')
      else link.removeAttribute('aria-current')
    })
    links = [...(channel?.closest('.channel-group').querySelectorAll('.thread-link') || [])].filter((link) =>
      document.getElementById(new URL(link.href).hash.slice(1)),
    )
    headings = links.map((link) => document.getElementById(new URL(link.href).hash.slice(1)))
    const nextProgress = channel?.closest('.channel-group').querySelector('.thread-progress')
    if (nextProgress !== progress) {
      progressAnimation?.cancel()
      progressAnimation = undefined
      progress = nextProgress
      progressTarget = -1
    }
    selected = undefined
    schedule()
  }

  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule)
  window.addEventListener('hashchange', refreshSidebar)
  window.addEventListener(
    'load',
    () => {
      if (location.hash) scrollToHash(location.hash.slice(1))
      refreshSidebar()
    },
    { once: true },
  )
  refreshSidebar()
}

function scrollToHash(hash) {
  if (!hash) {
    window.scrollTo({ top: 0, behavior: 'instant' })
    return
  }
  const target = document.getElementById(hash)
  if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' })
  else window.scrollTo({ top: 0, behavior: 'instant' })
}

function attachSoftNavigation() {
  if (!window.fetch || !window.DOMParser) return

  const INTERNAL_SKIP_PREFIXES = ['/assets/', '/images/', '/healthz', '/notion/oauth/']

  function isInternalLink(anchor) {
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return false
    const href = anchor.getAttribute('href') || ''
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return false
    const url = new URL(anchor.href, location.href)
    if (url.origin !== location.origin) return false
    if (INTERNAL_SKIP_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return false
    if (/\.(json|xml)$/i.test(url.pathname)) return false
    return true
  }

  async function navigate(url, { push = true, hash = '' } = {}) {
    const target = url + (hash ? '#' + hash : '')
    document.body.classList.add('is-navigating')
    try {
      const response = await fetch(url, { headers: { Accept: 'text/html' }, cache: 'no-store' })
      if (!response.ok) return void (window.location.href = target)
      const parsed = new DOMParser().parseFromString(await response.text(), 'text/html')
      const nextSidebar = parsed.querySelector('.discord-sidebar')
      const nextWrapper = parsed.querySelector('.content-wrapper')
      if (!nextSidebar || !nextWrapper) return void (window.location.href = target)
      document.title = parsed.title
      const sidebarScroll = document.querySelector('.sidebar-scrollable').scrollTop
      document.querySelector('.discord-sidebar').replaceWith(nextSidebar)
      document.querySelector('.sidebar-scrollable').scrollTop = sidebarScroll
      document.querySelector('.content-wrapper').replaceWith(nextWrapper)
      if (push) history.pushState({ softNav: true }, '', target)
      attachCopyButtons()
      scrollToHash(hash)
      refreshSidebar()
    } catch {
      window.location.href = target
    } finally {
      document.body.classList.remove('is-navigating')
    }
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = event.target.closest('a[href]')
    if (!isInternalLink(anchor)) return
    const url = new URL(anchor.href, location.href)
    event.preventDefault()
    if (url.pathname === location.pathname && url.search === location.search) {
      history.pushState({ softNav: true }, '', url.pathname + url.search + url.hash)
      if (url.hash) scrollToHash(url.hash.slice(1))
      else window.scrollTo({ top: 0, behavior: 'smooth' })
      refreshSidebar()
      return
    }
    navigate(url.pathname + url.search, { hash: url.hash.slice(1) })
  })

  window.addEventListener('popstate', () => {
    navigate(location.pathname + location.search, { push: false, hash: location.hash.slice(1) })
  })
}

function attachSearch() {
  const input = document.getElementById('site-search')
  const list = document.getElementById('search-results')
  if (!input || !list) return

  let entries = []
  let loaded = false

  async function ensureIndex() {
    if (loaded) return
    try {
      const response = await fetch('/search-index.json', { cache: 'no-store' })
      entries = await response.json()
    } catch {
      entries = []
    }
    loaded = true
  }

  function close() {
    list.hidden = true
    list.innerHTML = ''
  }

  function render(query) {
    const q = query.trim().toLowerCase()
    if (!q) return close()
    const matches = entries.filter((entry) => entry.title.toLowerCase().includes(q) || entry.hint?.toLowerCase().includes(q)).slice(0, 10)
    list.innerHTML = matches.length
      ? matches
          .map(
            (entry) =>
              `<a class="search-result" href="${entry.url}">` +
              `<span class="search-title">${entry.title}</span>` +
              `<span class="search-kind">${entry.kind}</span>` +
              (entry.hint ? `<span class="search-hint">${entry.hint}</span>` : '') +
              `</a>`,
          )
          .join('')
      : '<div class="search-empty">Brak wyników</div>'
    list.hidden = false
  }

  input.addEventListener('focus', ensureIndex)
  input.addEventListener('input', async () => {
    await ensureIndex()
    if (document.activeElement === input) render(input.value)
  })
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    input.value = ''
    close()
    input.blur()
  })
  list.addEventListener('click', () => {
    input.value = ''
    close()
  })
  document.addEventListener('click', (event) => {
    if (event.target !== input && !list.contains(event.target)) close()
  })
  document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return
    event.preventDefault()
    input.focus()
    input.select()
  })
}

function attachMobileMenu() {
  const media = matchMedia('(max-width: 900px)')
  const toggle = document.querySelector('.mobile-menu-toggle')
  const menu = document.getElementById('header-menu')
  const layout = document.querySelector('.app-layout')
  function setOpen(open) {
    document.body.classList.toggle('mobile-menu-open', open)
    toggle.setAttribute('aria-expanded', String(open))
    toggle.setAttribute('aria-label', open ? 'Zamknij menu' : 'Otwórz menu')
    layout.inert = open
    document.querySelector('.discord-footer').inert = open
  }
  function close() {
    setOpen(false)
  }
  function sync() {
    close()
    const sidebar = document.querySelector('.discord-sidebar')
    if (media.matches) menu.appendChild(sidebar)
    else layout.prepend(sidebar)
  }
  document.body.classList.add('mobile-nav-ready')
  toggle.addEventListener('click', () => {
    setOpen(!document.body.classList.contains('mobile-menu-open'))
  })
  document.addEventListener('click', (event) => {
    if (!media.matches || !document.body.classList.contains('mobile-menu-open')) return
    if (event.target.closest('#header-menu a')) {
      close()
      toggle.focus()
    } else if (!event.target.closest('.discord-header')) close()
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('mobile-menu-open')) {
      close()
      toggle.focus()
    }
    if (media.matches && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      setOpen(true)
    }
  })
  media.addEventListener('change', sync)
  sync()
}

attachMobileMenu()
attachCopyButtons()
attachSidebarTracking()
attachSoftNavigation()
attachSearch()
