function attachInvitation() {
  let releaseFlight
  let pointerId
  let pressed = false
  const ambient = matchMedia('(hover: none) and (pointer: coarse)')

  function startFlight(button, automatic = false) {
    if (releaseFlight) return
    const canvas = document.createElement('canvas')
    canvas.className = 'invite-flight'
    canvas.setAttribute('aria-hidden', 'true')
    canvas.width = innerWidth
    canvas.height = innerHeight
    document.body.appendChild(canvas)
    const context = canvas.getContext('2d')
    if (!context) {
      console.error('[Web] Invitation animation requires a 2D canvas context')
      canvas.remove()
      return
    }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const stars = Array.from({ length: 700 }, () => ({
      angle: Math.random() * Math.PI * 2,
      distance: Math.random(),
      size: 0.5 + Math.random() * 1.5,
      fadeDuration: 110 + Math.random() * 130,
    }))
    const ribbons = Array.from({ length: 42 }, (_, index) => ({
      angle: (index / 42) * Math.PI * 2,
      distance: Math.random(),
      hue: (index / 42) * 360,
      size: 12 + Math.random() * 40,
      fadeDuration: 220 + Math.random() * 160,
    }))
    const started = performance.now()
    const initialBounds = button.getBoundingClientRect()
    const originX = initialBounds.left + initialBounds.width / 2
    const originY = Math.max(innerHeight * 0.2, Math.min(innerHeight * 0.8, initialBounds.top + initialBounds.height / 2))
    const mobileRadius = Math.hypot(innerWidth, innerHeight)
    let previous = started
    let travel = 0
    let speed = 0
    let scrollPosition = scrollY
    let parallax = 0
    let stopped = false
    let released
    releaseFlight = () => {
      if (released !== undefined) return
      released = performance.now()
      releaseFlight = undefined
      pointerId = undefined
      pressed = false
      if (automatic || reduced) {
        stopped = true
        canvas.remove()
      }
    }
    function frame(now) {
      if (stopped) return
      if (!button.isConnected) {
        if (released === undefined) releaseFlight()
        canvas.remove()
        return
      }
      const fadeAge = released === undefined ? 0 : Math.max(0, now - released)
      if (released !== undefined && fadeAge >= 380) {
        canvas.remove()
        return
      }
      const remaining = (duration) => (1 - Math.min(1, fadeAge / duration)) ** 2
      const age = Math.max(0, now - started)
      const elapsed = age * (automatic ? 0.01 : 1)
      const delta = Math.max(0, Math.min(64, now - previous))
      const targetSpeed = automatic ? 0.12 * (1 - Math.exp(-age / 1200000)) : pressed ? 1 : Math.min(0.55, elapsed / 18000)
      speed += (targetSpeed - speed) * (1 - Math.exp(-delta / (pressed ? 350 : 1600)))
      const acceleration = speed
      travel += delta * (automatic ? 0.01 : 1) * (0.000015 + acceleration ** 2 * 0.0012) * remaining(380)
      const scrollDelta = scrollY - scrollPosition
      scrollPosition = scrollY
      parallax = Math.max(-2, Math.min(2, parallax + Math.max(-40, Math.min(40, scrollDelta)) * 0.008)) * Math.exp(-delta / 600)
      previous = now
      if (canvas.width !== innerWidth || canvas.height !== innerHeight) {
        canvas.width = innerWidth
        canvas.height = innerHeight
      }
      const { width, height } = canvas
      const bounds = button.getBoundingClientRect()
      const buttonX = bounds.left + bounds.width / 2
      const buttonY = bounds.top + bounds.height / 2
      const centerX = automatic ? originX : buttonX
      const centerY = automatic ? originY : buttonY
      const depthOffset = automatic && !reduced ? parallax : 0
      const radius = automatic ? mobileRadius : Math.hypot(Math.max(centerX, width - centerX), Math.max(centerY, height - centerY))
      const appearance = Math.min(1, elapsed / 600)
      const opacity = automatic ? 1 - Math.exp(-age / 180000) : appearance * appearance * (3 - 2 * appearance)
      context.clearRect(0, 0, width, height)
      context.globalCompositeOperation = 'source-over'
      context.globalAlpha = Math.min(1, elapsed / 1500) * remaining(160)
      context.fillStyle = `rgba(6, 7, 16, ${(automatic ? 0.3 : 0.85) * (1 - Math.exp(-elapsed / 12000))})`
      context.fillRect(0, 0, width, height)
      if (reduced) {
        context.globalAlpha = opacity * 0.16
        const gradient = context.createLinearGradient(0, 0, width, height)
        for (let index = 0; index <= 6; index++) gradient.addColorStop(index / 6, `hsl(${index * 60} 85% 65%)`)
        context.fillStyle = gradient
        context.fillRect(0, 0, width, height)
      } else {
        context.globalCompositeOperation = 'lighter'
        context.lineCap = 'round'
        for (const ribbon of ribbons) {
          const distance = ((ribbon.distance + travel * 0.45) % 1) * radius
          const tail = Math.max(0, distance - radius * (0.15 + acceleration * 0.4) * remaining(ribbon.fadeDuration))
          const x = Math.cos(ribbon.angle)
          const y = Math.sin(ribbon.angle)
          const gradient = context.createLinearGradient(centerX + x * tail, centerY + y * tail, centerX + x * distance, centerY + y * distance)
          gradient.addColorStop(0, `hsla(${ribbon.hue}, 90%, 65%, 0)`)
          gradient.addColorStop(0.65, `hsla(${ribbon.hue}, 90%, 65%, 0.18)`)
          gradient.addColorStop(1, `hsla(${ribbon.hue + 40}, 90%, 75%, 0)`)
          context.globalAlpha = opacity * acceleration * remaining(ribbon.fadeDuration)
          context.strokeStyle = gradient
          context.lineWidth = ribbon.size * (0.5 + acceleration)
          context.filter = 'blur(14px)'
          context.save()
          context.translate(0, depthOffset * 0.5)
          context.beginPath()
          context.moveTo(centerX + x * tail, centerY + y * tail)
          context.quadraticCurveTo(
            centerX + x * distance * 0.6 - y * 30,
            centerY + y * distance * 0.6 + x * 30,
            centerX + x * distance,
            centerY + y * distance,
          )
          context.stroke()
          context.restore()
        }
        context.filter = 'none'
        for (const star of stars) {
          const distance = ((star.distance + travel) % 1) * radius
          const tail = Math.max(0, distance - (2 + acceleration ** 2 * radius * 0.16) * remaining(star.fadeDuration))
          const x = Math.cos(star.angle)
          const y = Math.sin(star.angle)
          const gradient = context.createLinearGradient(centerX + x * tail, centerY + y * tail, centerX + x * distance, centerY + y * distance)
          gradient.addColorStop(0, 'rgba(170, 190, 255, 0)')
          gradient.addColorStop(1, 'rgba(225, 235, 255, 0.8)')
          context.globalAlpha = opacity * Math.min(1, distance / (radius * 0.4)) * remaining(star.fadeDuration)
          context.strokeStyle = gradient
          context.lineWidth = star.size
          context.save()
          context.translate(0, depthOffset * star.size)
          context.beginPath()
          context.moveTo(centerX + x * tail, centerY + y * tail)
          context.lineTo(centerX + x * distance, centerY + y * distance)
          context.stroke()
          context.restore()
        }
      }
      context.save()
      context.globalCompositeOperation = 'destination-out'
      context.globalAlpha = 1
      if (automatic) {
        context.fillStyle = '#000'
        context.beginPath()
        context.roundRect(bounds.left - 1, bounds.top - 1, bounds.width + 2, bounds.height + 2, 6)
        context.fill()
      } else {
        context.translate(buttonX, buttonY)
        context.scale(bounds.width / 2 + 32, bounds.height / 2 + 24)
        const opening = context.createRadialGradient(0, 0, 1, 0, 0, 2)
        opening.addColorStop(0, '#000')
        opening.addColorStop(1, 'transparent')
        context.fillStyle = opening
        context.fillRect(-2, -2, 4, 4)
      }
      context.restore()
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  document.addEventListener('pointerover', (event) => {
    if (ambient.matches) return
    const button = event.target.closest('[data-invite]')
    if (button && event.pointerType !== 'touch') startFlight(button)
  })
  document.addEventListener('pointerout', (event) => {
    if (ambient.matches) return
    const button = event.target.closest('[data-invite]')
    if (button && !button.contains(event.relatedTarget) && !pressed) releaseFlight?.()
  })
  document.addEventListener('pointerdown', (event) => {
    if (ambient.matches) return
    const button = event.target.closest('[data-invite]')
    if (event.button !== 0 || !event.isPrimary || !button) return
    pointerId = event.pointerId
    pressed = true
    startFlight(button)
  })
  document.addEventListener('pointerup', (event) => {
    if (event.pointerId === pointerId) releaseFlight?.()
  })
  document.addEventListener('pointercancel', () => {
    if (!ambient.matches) releaseFlight?.()
  })
  window.addEventListener('blur', () => releaseFlight?.())
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseFlight?.()
    else syncAmbient()
  })
  window.addEventListener('focus', syncAmbient)
  document.addEventListener('focusin', (event) => {
    if (ambient.matches) return
    const button = event.target.closest('[data-invite]')
    if (button && button.matches(':focus-visible')) startFlight(button)
  })
  document.addEventListener('focusout', (event) => {
    if (ambient.matches) return
    if (event.target.closest('[data-invite]') && !pressed) releaseFlight?.()
  })
  document.addEventListener('click', (event) => {
    if (!ambient.matches && event.target.closest('[data-invite]')) releaseFlight?.()
  })

  function syncAmbient() {
    if (!ambient.matches || document.hidden) return
    const button = document.querySelector('[data-invite]')
    if (button) startFlight(button, true)
    else releaseFlight?.()
  }

  ambient.addEventListener('change', () => {
    releaseFlight?.()
    syncAmbient()
  })
  const layout = document.querySelector('.app-layout')
  if (layout) new MutationObserver(syncAmbient).observe(layout, { childList: true, subtree: true })
  syncAmbient()
}

attachInvitation()
