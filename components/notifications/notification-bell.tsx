'use client'

import { useState, useRef, useEffect } from 'react'
import {
  GiRingingBell,
  GiAnimalSkull,
  GiWatchtower,
  GiTreasureMap,
  GiHammerNails,
  GiMagnifyingGlass,
} from 'react-icons/gi'
import { markNotificationRead } from '@/lib/game/notifications/mark-notification-read'
import { deleteNotification } from '@/lib/game/notifications/delete-notification'
import { Tooltip } from '@/components/ui/tooltip'

interface NotificationData {
  id: string
  type: string
  title: string
  message: string
  readAt: string | null
  createdAt: string
}

interface NotificationBellProps {
  notifications: NotificationData[]
  unreadCount: number
}

const ICON_BY_TYPE: Record<string, typeof GiAnimalSkull> = {
  starvation: GiAnimalSkull,
  traveler_detected: GiWatchtower,
  mission_completed: GiTreasureMap,
  building_completed: GiHammerNails,
  research_completed: GiMagnifyingGlass,
}

const COLOR_BY_TYPE: Record<string, string> = {
  starvation: 'text-red-400',
  traveler_detected: 'text-amber-400',
  mission_completed: 'text-emerald-400',
  building_completed: 'text-sky-400',
  research_completed: 'text-violet-400',
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return "À l'instant"
  if (diffMin < 60) return `Il y a ${diffMin} min`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays === 1) return 'Hier'
  return `Il y a ${diffDays}j`
}

export function NotificationBell({
  notifications,
  unreadCount,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Reset local read state when server data changes
  useEffect(() => {
    setReadIds(new Set())
  }, [notifications])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
    }
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleHoverNotification(notif: NotificationData) {
    if (notif.readAt || readIds.has(notif.id)) return
    setReadIds((prev) => new Set(prev).add(notif.id))
    markNotificationRead(notif.id)
  }

  const displayedUnread = Math.max(0, unreadCount - readIds.size)

  return (
    <div className="relative" ref={dropdownRef}>
      <Tooltip label="Notifications" position="bottom">
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="relative flex items-center justify-center w-10 h-10 border-2 rounded-full transition-all duration-300 cursor-pointer border-[var(--ivory)] text-[var(--ivory)] hover:bg-[var(--burnt-amber)]/20 hover:text-[var(--burnt-amber)] hover:border-[var(--burnt-amber)] hover:scale-105 hover:shadow-md hover:shadow-[var(--burnt-amber)]/30"
        >
          <GiRingingBell size={20} />
          {displayedUnread > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-red-600 text-white border border-[var(--obsidian)]">
              {displayedUnread > 99 ? '99+' : displayedUnread}
            </span>
          )}
        </button>
      </Tooltip>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-lg stone-texture border border-[var(--ivory)]/20 shadow-2xl z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[var(--ivory)]/10">
            <h3 className="font-[family-name:var(--font-title)] tracking-[0.15em] text-sm text-[var(--ivory)] uppercase">
              Notifications
            </h3>
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <GiRingingBell
                size={32}
                className="mx-auto mb-2 text-[var(--ivory)]/20"
              />
              <p className="text-sm text-[var(--ivory)]/40 font-[family-name:var(--font-body)]">
                Aucune notification
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--ivory)]/5">
              {notifications.map((notif) => {
                const Icon = ICON_BY_TYPE[notif.type] ?? GiRingingBell
                const iconColor = COLOR_BY_TYPE[notif.type] ?? 'text-[var(--burnt-amber)]'
                const isUnread = !notif.readAt && !readIds.has(notif.id)

                return (
                  <div
                    key={notif.id}
                    onMouseEnter={() => handleHoverNotification(notif)}
                    className={`group px-4 py-3 flex gap-3 items-start transition-colors ${
                      isUnread ? 'bg-[var(--burnt-amber)]/5' : ''
                    }`}
                  >
                    <div className={`flex-shrink-0 mt-0.5 ${iconColor}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-[family-name:var(--font-title)] text-xs tracking-[0.1em] text-[var(--ivory)] uppercase">
                          {notif.title}
                        </span>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-[var(--burnt-amber)] flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-[var(--ivory)]/70 mt-0.5 font-[family-name:var(--font-body)]">
                        {notif.message}
                      </p>
                      <p className="text-xs text-[var(--ivory)]/30 mt-1">
                        {formatTimeAgo(notif.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={async () => await deleteNotification(notif.id)}
                      className="flex-shrink-0 mt-0.5 text-[var(--ivory)]/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      aria-label="Supprimer la notification"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
