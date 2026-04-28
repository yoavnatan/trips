export interface Trip {
  id: string
  userId: string
  title: string
  destination: string
  createdAt: Date
  updatedAt: Date
}

export interface ActionState {
  error?: string
}
