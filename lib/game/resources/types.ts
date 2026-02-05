export interface VillageResources {
  id: string
  villageId: string
  bois: number
  pierre: number
  cereales: number
  viande: number
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

export interface AllResources {
  villageResources: VillageResources
  userResources: UserResources
}
