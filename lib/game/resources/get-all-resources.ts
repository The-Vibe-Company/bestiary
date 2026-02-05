import { AllResources } from './types'
import { getUserResources } from './get-user-resources'
import { getVillageResources } from './get-village-resources'

export async function getAllResources(userId: string): Promise<AllResources> {
  const [userResources, villageResources] = await Promise.all([
    getUserResources(userId),
    getVillageResources(userId),
  ])

  if (!villageResources) {
    throw new Error('Village not found for user')
  }

  return {
    villageResources,
    userResources,
  }
}
