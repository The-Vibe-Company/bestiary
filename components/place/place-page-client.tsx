'use client'

import { useState } from 'react'
import type { ComponentType } from 'react'
import { GiWalk, GiHammerNails, GiPawPrint, GiCrossedSwords, GiWatchtower, GiThreeFriends, GiAxeInStump, GiWarPick, GiBowArrow, GiBasket, GiCompass, GiSheep, GiWheat, GiBookshelf, GiBeerStein, GiVillage, GiWoodPile, GiStonePile, GiMeal, GiCleaver } from 'react-icons/gi'
import { TravelersPanel } from './travelers-panel'
import { ActiveJobsPanel } from './active-jobs-panel'
import { Countdown } from './countdown'
import type { DetectedTravelerStatus } from '@/lib/game/travelers/detection'
import type { ActiveMission } from '@/lib/game/missions/types'
const PLACE_TABS = [
  { key: 'voyageurs', label: 'Voyageurs', icon: GiWalk },
  { key: 'missions', label: 'Missions', icon: GiHammerNails },
  { key: 'animaux', label: 'Animaux', icon: GiPawPrint },
  { key: 'troupes', label: 'Troupes', icon: GiCrossedSwords },
]

interface PlacePageClientProps {
  travelerStatus: DetectedTravelerStatus
  inhabitantTypes: { key: string; title: string; image: string }[]
  isVillageFull: boolean
  tavernLevel: number
  missions: ActiveMission[]
  statsByType: Record<string, { gatherRate: number; maxCapacity: number }>
  inhabitantCounts: Record<string, number>
  totalInhabitants: number
  maxPopulation: number
  jobCapacities: Record<string, { current: number; max: number | null; available: boolean }>
}

/* ── Snippet cards (left sidebar) ────────────────────────── */

function SnippetCard({ icon, title, isActive, onClick, children }: { icon: React.ReactNode; title: string; isActive?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        text-left w-full bg-black/75 backdrop-blur rounded-xl overflow-hidden cursor-pointer transition-all duration-150
        ${isActive
          ? 'border border-[var(--burnt-amber)]/60 shadow-[0_0_12px_rgba(179,123,52,0.15)]'
          : 'border border-[var(--burnt-amber)]/20 hover:border-[var(--burnt-amber)]/40'
        }
      `}
    >
      <div className={`flex items-center gap-2 px-3.5 py-2 border-b ${isActive ? 'border-[var(--burnt-amber)]/20' : 'border-[var(--ivory)]/10'}`}>
        <span className="text-[var(--burnt-amber)]">{icon}</span>
        <h3 className="text-xs font-[family-name:var(--font-title)] tracking-[0.15em] text-[var(--ivory)] uppercase">
          {title}
        </h3>
      </div>
      <div className="px-3.5 py-2.5 flex-1 min-h-0">
        {children}
      </div>
    </button>
  )
}

function TravelerSnippet({ travelerStatus, isActive, onClick }: { travelerStatus: DetectedTravelerStatus; isActive: boolean; onClick: () => void }) {
  return (
    <SnippetCard icon={<GiWalk size={16} />} title="Voyageurs" isActive={isActive} onClick={onClick}>
      {travelerStatus.status === 'present' ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[var(--ivory)]/80">
            {travelerStatus.isWelcomed ? 'Voyageur accueilli' : 'Un voyageur attend !'}
          </span>
          {!travelerStatus.isWelcomed && (
            <span className="text-[10px]">
              <Countdown targetDate={travelerStatus.departsAt} />
            </span>
          )}
        </div>
      ) : travelerStatus.status === 'detected' ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <GiWatchtower size={12} className="text-amber-400/80" />
            <span className="text-xs text-[var(--ivory)]/80">En approche</span>
          </div>
          <span className="text-[10px]">
            <Countdown targetDate={travelerStatus.arrivesAt} />
          </span>
        </div>
      ) : (
        <span className="text-xs text-[var(--ivory)]/40">Aucun voyageur en vue</span>
      )}
    </SnippetCard>
  )
}

function MissionsSnippet({ missions, isActive, onClick }: { missions: ActiveMission[]; isActive: boolean; onClick: () => void }) {
  return (
    <SnippetCard icon={<GiHammerNails size={16} />} title="Missions" isActive={isActive} onClick={onClick}>
      {missions.length === 0 ? (
        <span className="text-xs text-[var(--ivory)]/40">Aucune mission en cours</span>
      ) : (
        <span className="text-xs text-[var(--ivory)]/80">
          {missions.length} mission{missions.length > 1 ? 's' : ''} en cours
        </span>
      )}
    </SnippetCard>
  )
}

function PlaceholderSnippet({ icon: Icon, title, isActive, onClick }: { icon: React.ComponentType<{ size: number }>; title: string; isActive: boolean; onClick: () => void }) {
  return (
    <SnippetCard icon={<Icon size={16} />} title={title} isActive={isActive} onClick={onClick}>
      <span className="text-xs text-[var(--ivory)]/30 italic">Bientôt disponible</span>
    </SnippetCard>
  )
}

const INHABITANT_ICONS: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  lumberjack: GiAxeInStump,
  miner: GiWarPick,
  hunter: GiBowArrow,
  gatherer: GiBasket,
  explorer: GiCompass,
  breeder: GiSheep,
  farmer: GiWheat,
  researcher: GiBookshelf,
  builder: GiHammerNails,
  watchman: GiWatchtower,
  tavernkeeper: GiBeerStein,
  mayor: GiVillage,
  splitter: GiWoodPile,
  stonecutter: GiStonePile,
  victualer: GiMeal,
  butcher: GiCleaver,
}

function InhabitantsSnippet({
  inhabitantTypes,
  inhabitantCounts,
  totalInhabitants,
  maxPopulation,
}: {
  inhabitantTypes: { key: string; title: string; image: string }[]
  inhabitantCounts: Record<string, number>
  totalInhabitants: number
  maxPopulation: number
}) {
  const sortedInhabitantTypes = [...inhabitantTypes]
    .filter((t) => (inhabitantCounts[t.key] ?? 0) > 0)
    .sort((a, b) => {
      if (a.key === 'mayor' && b.key !== 'mayor') return -1
      if (b.key === 'mayor' && a.key !== 'mayor') return 1
      return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })
    })

  return (
    <div className="w-full flex-1 min-h-0 bg-black/75 backdrop-blur rounded-xl overflow-hidden border border-[var(--burnt-amber)]/20 flex flex-col">
      <div className="flex items-center gap-2 px-3.5 py-2 border-b border-[var(--ivory)]/10">
        <span className="text-[var(--burnt-amber)]"><GiThreeFriends size={16} /></span>
        <h3 className="text-xs font-[family-name:var(--font-title)] tracking-[0.15em] text-[var(--ivory)] uppercase">
          Habitants
        </h3>
        <span className="ml-auto text-xs font-bold text-[var(--burnt-amber)]">
          {totalInhabitants}<span className="text-[var(--ivory)]/30 font-normal">/{maxPopulation}</span>
        </span>
      </div>
      <div className="px-3.5 py-2.5 flex-1 min-h-0 flex flex-col">
        {sortedInhabitantTypes.length === 0 ? (
          <span className="text-xs text-[var(--ivory)]/40">Aucun habitant</span>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto pr-5 space-y-1.5">
            {sortedInhabitantTypes.map((type) => {
              const Icon = INHABITANT_ICONS[type.key] ?? GiThreeFriends
              return (
                <div key={type.key} className="flex items-center gap-2">
                  <Icon size={14} className="text-[var(--burnt-amber)]/70" />
                  <span className="text-xs text-[var(--ivory)]/70 flex-1 truncate">{type.title}</span>
                  <span className="text-xs font-bold text-[var(--ivory)] shrink-0 min-w-[1.75rem] text-right">{inhabitantCounts[type.key] ?? 0}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Main layout ─────────────────────────────────────────── */

export function PlacePageClient({
  travelerStatus,
  inhabitantTypes,
  isVillageFull,
  tavernLevel,
  missions,
  statsByType,
  inhabitantCounts,
  totalInhabitants,
  maxPopulation,
  jobCapacities,
}: PlacePageClientProps) {
  const [activeTab, setActiveTab] = useState('voyageurs')

  return (
    <>
      <style>{`
        .place-detail-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .place-detail-scroll::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.8);
        }
        .place-detail-scroll::-webkit-scrollbar-thumb {
          background: var(--burnt-amber);
          border-radius: 2px;
        }
        .place-detail-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--burnt-amber-light);
        }
      `}</style>

      <div className="h-full flex gap-4 max-w-6xl mx-auto">
        {/* Left: Overview sidebar */}
        <div className="w-[260px] flex-shrink-0 flex flex-col gap-3 py-1 min-h-0">
          <TravelerSnippet travelerStatus={travelerStatus} isActive={activeTab === 'voyageurs'} onClick={() => setActiveTab('voyageurs')} />
          <MissionsSnippet missions={missions} isActive={activeTab === 'missions'} onClick={() => setActiveTab('missions')} />
          <PlaceholderSnippet icon={GiPawPrint} title="Animaux errants" isActive={activeTab === 'animaux'} onClick={() => setActiveTab('animaux')} />
          <PlaceholderSnippet icon={GiCrossedSwords} title="Troupes & Combats" isActive={activeTab === 'troupes'} onClick={() => setActiveTab('troupes')} />
          <InhabitantsSnippet
            inhabitantTypes={inhabitantTypes}
            inhabitantCounts={inhabitantCounts}
            totalInhabitants={totalInhabitants}
            maxPopulation={maxPopulation}
          />
        </div>

        {/* Right: Detail panel */}
        <div className="flex-1 min-w-0 bg-black/75 backdrop-blur border border-[var(--burnt-amber)]/50 rounded-2xl overflow-hidden flex flex-col">
          {/* Tab header */}
          <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2.5 border-b border-[var(--ivory)]/10">
            {PLACE_TABS.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`
                    cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-150
                    ${isActive
                      ? 'bg-[var(--burnt-amber)]/20 text-[var(--burnt-amber)] border border-[var(--burnt-amber)]/40'
                      : 'text-[var(--ivory)]/40 hover:text-[var(--ivory)]/70 hover:bg-[var(--ivory)]/5 border border-transparent'
                    }
                  `}
                >
                  <tab.icon size={13} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto place-detail-scroll p-5 flex flex-col">
            {activeTab === 'voyageurs' && (
              <TravelersPanel
                travelerStatus={travelerStatus}
                inhabitantTypes={inhabitantTypes}
                isVillageFull={isVillageFull}
                tavernLevel={tavernLevel}
                jobCapacities={jobCapacities}
              />
            )}
            {activeTab === 'missions' && (
              <ActiveJobsPanel
                missions={missions}
                statsByType={statsByType}
              />
            )}
            {activeTab === 'animaux' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <GiPawPrint size={48} className="text-[var(--ivory)]/20" />
                <p className="text-sm font-[family-name:var(--font-title)] tracking-[0.15em] text-[var(--ivory)]/30 uppercase">
                  Bientôt disponible
                </p>
              </div>
            )}
            {activeTab === 'troupes' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <GiCrossedSwords size={48} className="text-[var(--ivory)]/20" />
                <p className="text-sm font-[family-name:var(--font-title)] tracking-[0.15em] text-[var(--ivory)]/30 uppercase">
                  Bientôt disponible
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
