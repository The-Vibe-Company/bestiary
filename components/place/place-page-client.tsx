'use client'

import { useState } from 'react'
import { GiWalk, GiHammerNails, GiPawPrint, GiCrossedSwords, GiWatchtower } from 'react-icons/gi'
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
      <div className="px-3.5 py-2.5">
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

/* ── Main layout ─────────────────────────────────────────── */

export function PlacePageClient({
  travelerStatus,
  inhabitantTypes,
  isVillageFull,
  tavernLevel,
  missions,
  statsByType,
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
        <div className="w-[260px] flex-shrink-0 flex flex-col gap-3 py-1">
          <TravelerSnippet travelerStatus={travelerStatus} isActive={activeTab === 'voyageurs'} onClick={() => setActiveTab('voyageurs')} />
          <MissionsSnippet missions={missions} isActive={activeTab === 'missions'} onClick={() => setActiveTab('missions')} />
          <PlaceholderSnippet icon={GiPawPrint} title="Animaux errants" isActive={activeTab === 'animaux'} onClick={() => setActiveTab('animaux')} />
          <PlaceholderSnippet icon={GiCrossedSwords} title="Troupes & Combats" isActive={activeTab === 'troupes'} onClick={() => setActiveTab('troupes')} />
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
