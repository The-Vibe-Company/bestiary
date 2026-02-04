import { neonAuth } from '@neondatabase/auth/next/server'
import { redirect } from 'next/navigation'
import { ResourceBar } from '@/components/layout/resource-bar'
import { getUserResources } from '@/lib/game/resources/get-user-resources'
import Image from 'next/image'

const habitants = [
  {
    id: 'agriculteur',
    title: 'Agriculteur',
    image: '/assets/habitants/agriculteur.png',
    description:
      'Cultive les terres fertiles du village pour produire céréales et légumes. Son travail assidu nourrit la communauté et assure des réserves pour les temps difficiles.',
  },
  {
    id: 'bucheron',
    title: 'Bûcheron',
    image: '/assets/habitants/bucheron.png',
    description:
      'Abat les arbres des forêts environnantes pour fournir le bois nécessaire aux constructions et au chauffage. Sa force et son endurance sont légendaires.',
  },
  {
    id: 'cueilleur',
    title: 'Cueilleur',
    image: '/assets/habitants/cueilleur.png',
    description:
      'Parcourt les plaines et les sous-bois à la recherche de baies, champignons et plantes médicinales. Ses connaissances botaniques sont précieuses pour le village.',
  },
  {
    id: 'eleveur',
    title: 'Éleveur',
    image: '/assets/habitants/eleveur.png',
    description:
      'Prend soin des créatures domestiquées du village. Il veille à leur bien-être et assure la production de lait, œufs et laine pour la communauté.',
  },
  {
    id: 'explorateur',
    title: 'Explorateur',
    image: '/assets/habitants/explorateur.png',
    description:
      'Brave les dangers des terres inconnues pour découvrir de nouvelles créatures et ressources. Son courage et sa curiosité repoussent les frontières du monde connu.',
  },
  {
    id: 'tailleur_de_pierre',
    title: 'Tailleur de Pierre',
    image: '/assets/habitants/tailleur_de_pierre.png',
    description:
      'Sculpte et façonne la roche pour ériger les bâtiments du village. Son art ancestral transforme la pierre brute en fondations solides et durables.',
  },
]

export default async function HabitantsPage() {
  const { session } = await neonAuth()

  if (!session) {
    redirect('/sign-in')
  }

  const resources = await getUserResources(session.userId)

  return (
    <div className="relative min-h-screen bg-[var(--obsidian)]">
      <div className="absolute top-0 left-0 right-0 z-50">
        <ResourceBar resources={resources} />
      </div>

      <div className="pt-32 pb-16 px-6 max-w-4xl mx-auto">
        <h1 className="text-4xl font-[family-name:var(--font-title)] tracking-[0.15em] text-[var(--ivory)] mb-12 text-center">
          HABITANTS
        </h1>

        <div className="space-y-6">
          {habitants.map((habitant) => (
            <div
              key={habitant.id}
              className="flex items-center gap-6 bg-black/40 backdrop-blur-sm border border-[var(--ivory)]/20 rounded-lg p-4 hover:border-[var(--burnt-amber)]/50 transition-colors"
            >
              <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden border-2 border-[var(--burnt-amber)]">
                <Image
                  src={habitant.image}
                  alt={habitant.title}
                  fill
                  className="object-cover"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-[family-name:var(--font-title)] tracking-wider text-[var(--ivory)]">
                    {habitant.title}
                  </h2>
                  <span className="text-2xl font-bold text-[var(--burnt-amber)]">
                    0
                  </span>
                </div>
                <p className="text-sm text-[var(--ivory)]/70 leading-relaxed">
                  {habitant.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
