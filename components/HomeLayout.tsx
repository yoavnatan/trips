'use client'

import { useState, useRef, useCallback, type ReactNode } from 'react'

const DESKTOP_BP = 768
const DEFAULT_SIDEBAR_PX = 360
const MIN_SIDEBAR_PX = DEFAULT_SIDEBAR_PX
const MAX_SIDEBAR_PX = 620
const DEFAULT_MAP_VH = 35
const MIN_MAP_VH = 15
const MAX_MAP_VH = DEFAULT_MAP_VH

interface HomeLayoutProps {
  mapSlot: ReactNode
  sidebarSlot: ReactNode
}

export function HomeLayout({ mapSlot, sidebarSlot }: HomeLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_PX)
  const [mapHeight, setMapHeight] = useState(DEFAULT_MAP_VH)
  const drag = useRef<{ desktop: boolean; startPos: number; startSize: number } | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      const desktop = window.innerWidth >= DESKTOP_BP
      drag.current = {
        desktop,
        startPos: desktop ? e.clientX : e.clientY,
        startSize: desktop ? sidebarWidth : mapHeight,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [sidebarWidth, mapHeight]
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    const { desktop, startPos, startSize } = drag.current
    if (desktop) {
      const delta = startPos - e.clientX
      setSidebarWidth(Math.max(MIN_SIDEBAR_PX, Math.min(MAX_SIDEBAR_PX, startSize + delta)))
    } else {
      const pct = ((e.clientY - startPos) / window.innerHeight) * 100
      setMapHeight(Math.max(MIN_MAP_VH, Math.min(MAX_MAP_VH, startSize + pct)))
    }
  }, [])

  const onPointerUp = useCallback(() => {
    drag.current = null
  }, [])

  return (
    <main
      className="home-layout"
      style={
        {
          '--sidebar-width': `${sidebarWidth}px`,
          '--map-height': `${mapHeight}vh`,
        } as React.CSSProperties
      }
    >
      {mapSlot}
      <div
        className="home-layout__resize-handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      {sidebarSlot}
    </main>
  )
}
