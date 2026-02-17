export interface VillageResources {
  id: string
  villageId: string
  bois: number
  pierre: number
  cereales: number
  viande: number
  lastConsumptionAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UserResources {
  id: string
  userId: string
  or: number
  savoir: number
  createdAt: Date
  updatedAt: Date
}