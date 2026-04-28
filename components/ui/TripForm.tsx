'use client'

import { useActionState } from 'react'
import { createTrip } from '@/app/actions/createTrip'
import type { ActionState } from '@/types'

const initialState: ActionState = {}

export function TripForm() {
  const [state, formAction, pending] = useActionState(createTrip, initialState)

  return (
    <form className="trip-form" action={formAction}>
      <h2 className="trip-form__title">New Trip</h2>
      <div className="trip-form__field">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="Summer in Portugal"
        />
      </div>
      <div className="trip-form__field">
        <label htmlFor="destination">Destination</label>
        <input
          id="destination"
          name="destination"
          type="text"
          required
          placeholder="Lisbon, Portugal"
        />
      </div>
      {state.error && <p className="trip-form__error">{state.error}</p>}
      <button className="trip-form__submit" type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create Trip'}
      </button>
    </form>
  )
}
