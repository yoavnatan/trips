'use client'

import { Fragment, useState, useEffect } from 'react'
import Map, { Marker, Source, Layer, NavigationControl } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { DayWithLocations } from '@/types'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

interface ShareMapProps {
  days: DayWithLocations[]
}

export function ShareMap({ days }: ShareMapProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const allLocs = days.flatMap((d) => d.locations)

  const initialViewState = (() => {
    if (allLocs.length === 0) return { longitude: 20, latitude: 30, zoom: 1.5 }
    const lngs = allLocs.map((l) => l.lng)
    const lats = allLocs.map((l) => l.lat)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    if (allLocs.length === 1) return { longitude: lngs[0], latitude: lats[0], zoom: 13 }
    return {
      bounds: [
        [minLng - 0.3, minLat - 0.3],
        [maxLng + 0.3, maxLat + 0.3],
      ] as [[number, number], [number, number]],
      fitBoundsOptions: { padding: 60 },
    }
  })()

  return (
    <div className="share-map">
      {mounted && (
        <Map
          initialViewState={initialViewState}
          mapboxAccessToken={TOKEN}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          cursor="grab"
        >
          <NavigationControl position="top-right" />

          {days.map((day) => {
            const locs = [...day.locations].sort((a, b) => a.orderIndex - b.orderIndex)
            if (locs.length === 0) return null

            const routeGeoJSON = {
              type: 'FeatureCollection' as const,
              features: locs.length > 1 ? [{
                type: 'Feature' as const,
                geometry: { type: 'LineString' as const, coordinates: locs.map((p) => [p.lng, p.lat]) },
                properties: {},
              }] : [],
            }

            return (
              <Fragment key={day.id}>
                {locs.length > 1 && (
                  <Source id={`route-${day.id}`} type="geojson" data={routeGeoJSON}>
                    <Layer
                      id={`route-line-${day.id}`}
                      type="line"
                      paint={{ 'line-color': '#2563eb', 'line-width': 2, 'line-dasharray': [2, 1] }}
                    />
                  </Source>
                )}
                {locs.map((loc, i) => (
                  <Marker key={loc.id} latitude={loc.lat} longitude={loc.lng}>
                    <div className="map-marker" title={loc.name}>
                      <span className="map-marker__number">{i + 1}</span>
                    </div>
                  </Marker>
                ))}
              </Fragment>
            )
          })}
        </Map>
      )}
    </div>
  )
}
