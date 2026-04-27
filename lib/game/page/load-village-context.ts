import { neonAuth } from '@neondatabase/auth/next/server'
import { redirect } from 'next/navigation'
import type { BuildingType, InhabitantType, VillageBuilding } from '@prisma/client'
import { getBuildingTypes } from '@/lib/game/buildings/get-building-types'
import { getVillageBuildings } from '@/lib/game/buildings/get-village-buildings'
import { completePendingBuildings } from '@/lib/game/buildings/complete-pending-buildings'
import {
  computeStorageCapacity,
  getStorageStaffCounts,
  type BuildingStaffCounts,
  type StorageCapacity,
} from '@/lib/game/buildings/storage-capacity'
import { getInhabitantTypes } from '@/lib/game/inhabitants/get-inhabitant-types'
import { getUnoccupiedInhabitantsCount } from '@/lib/game/inhabitants/get-unoccupied-inhabitants-count'
import { getVillageInhabitants } from '@/lib/game/inhabitants/get-village-inhabitants'
import { INHABITANT_TYPES, type VillageInhabitants } from '@/lib/game/inhabitants/types'
import { completePendingMissions } from '@/lib/game/missions/complete-missions'
import { applyDailyConsumption } from '@/lib/game/resources/apply-daily-consumption'
import {
  computeDailyConsumption,
  type DailyConsumption,
} from '@/lib/game/resources/compute-daily-consumption'
import { getUserResources } from '@/lib/game/resources/get-user-resources'
import { getVillageResources } from '@/lib/game/resources/get-village-resources'
import type { VillageResources } from '@/lib/game/resources/types'
import type { UserResources } from '@/lib/game/resources/types'
import { completePendingResearch } from '@/lib/game/research/complete-pending-research'
import { getUser, type User } from '@/lib/game/user/get-user'
import { getVillage, type Village } from '@/lib/game/village/get-village'
import { assignVillageToUser } from '@/lib/game/village/assign-village'

export interface VillageContext {
  userId: string
  village: Village
  userData: User
  userResources: UserResources
  villageResources: VillageResources
  villageInhabitants: VillageInhabitants | null
  buildingTypes: BuildingType[]
  villageBuildings: VillageBuilding[]
  inhabitantTypes: InhabitantType[]
  totalInhabitants: number
  dailyConsumption: DailyConsumption
  completedBuildings: VillageBuilding[]
  storageStaffCounts: BuildingStaffCounts
  storageCapacity: StorageCapacity
  unoccupiedInhabitants: number
}

interface LoadOptions {
  /** Run completePendingResearch in the catch-up batch. Defaults to true. */
  completeResearch?: boolean
  /** Auto-create a village for the user if missing. Defaults to false. */
  ensureVillage?: boolean
}

/**
 * Loads the shared "page header" context every protected page needs:
 * auth → village → catch-up → mutable state → derived computations.
 *
 * Redirects to /sign-in if the user is unauthenticated, has no profile,
 * or has no village. Pages can rely on a non-null village + userData.
 */
export async function loadVillageContext(opts: LoadOptions = {}): Promise<VillageContext> {
  const { completeResearch = true, ensureVillage = false } = opts

  const { session } = await neonAuth()
  if (!session) redirect('/sign-in')

  if (ensureVillage) {
    await assignVillageToUser(session.userId)
  }

  const [village, userResources, userData, inhabitantTypes] = await Promise.all([
    getVillage(session.userId),
    getUserResources(session.userId),
    getUser(session.userId),
    getInhabitantTypes(),
  ])

  if (!userData || !village) redirect('/sign-in')

  // Catch up on lazily-completed jobs and apply pending consumption
  const catchUp: Promise<unknown>[] = [
    completePendingMissions(village.id),
    completePendingBuildings(village.id),
    applyDailyConsumption(village.id, inhabitantTypes),
  ]
  if (completeResearch) {
    catchUp.push(completePendingResearch(village.id))
  }
  await Promise.all(catchUp)

  // Fetch mutable state AFTER catch-up so derived values reflect fresh data
  const [villageResources, villageInhabitants, buildingTypes, villageBuildings] = await Promise.all([
    getVillageResources(session.userId),
    getVillageInhabitants(session.userId),
    getBuildingTypes(),
    getVillageBuildings(session.userId),
  ])

  if (!villageResources) redirect('/sign-in')

  const totalInhabitants = villageInhabitants
    ? INHABITANT_TYPES.reduce((sum, type) => sum + (villageInhabitants[type] ?? 0), 0)
    : 0

  const dailyConsumption = computeDailyConsumption(villageInhabitants, inhabitantTypes)
  const completedBuildings = villageBuildings.filter((vb) => vb.completedAt !== null)
  const storageStaffCounts = getStorageStaffCounts(villageInhabitants)
  const storageCapacity = computeStorageCapacity(buildingTypes, completedBuildings, storageStaffCounts)

  const unoccupiedInhabitants = await getUnoccupiedInhabitantsCount(
    village.id,
    totalInhabitants,
    villageInhabitants,
  )

  return {
    userId: session.userId,
    village,
    userData,
    userResources,
    villageResources,
    villageInhabitants,
    buildingTypes,
    villageBuildings,
    inhabitantTypes,
    totalInhabitants,
    dailyConsumption,
    completedBuildings,
    storageStaffCounts,
    storageCapacity,
    unoccupiedInhabitants,
  }
}
