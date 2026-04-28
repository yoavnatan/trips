'use client'

import { useState, useEffect } from 'react'
import Map, { NavigationControl } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

export function MapView() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="map-view">
      {mounted && (
        <Map
          initialViewState={{ longitude: 20, latitude: 30, zoom: 1.5 }}
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
        >
          <NavigationControl position="top-right" />
        </Map>
      )}
    </div>
  )
}
