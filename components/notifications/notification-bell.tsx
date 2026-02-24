'use client'

import { useState, useRef, useEffect } from 'react'
import { GiRingingBell, GiAnimalSkull, GiWatchtower } from 'react-icons/gi'
import { markNotificationsRead } from '@/lib/game/notifications/mark-notifications-read'
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
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  async function handleOpen() {
    setOpen((prev) => !prev)
    if (!open && unreadCount > 0) {
      await markNotificationsRead()
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Tooltip label="Notifications" position="bottom">
        <button
          onClick={handleOpen}
          className="relative flex items-center justify-center w-10 h-10 border-2 rounded-full transition-all duration-300 cursor-pointer border-[var(--ivory)] text-[var(--ivory)] hover:bg-[var(--burnt-amber)]/20 hover:text-[var(--burnt-amber)] hover:border-[var(--burnt-amber)] hover:scale-105 hover:shadow-md hover:shadow-[var(--burnt-amber)]/30"
        >
          <GiRingingBell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-red-600 text-white border border-[var(--obsidian)]">
              {unreadCount > 99 ? '99+' : unreadCount}
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
                const isUnread = !notif.readAt

                return (
                  <div
                    key={notif.id}
                    className={`px-4 py-3 flex gap-3 items-start transition-colors ${
                      isUnread ? 'bg-[var(--burnt-amber)]/5' : ''
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 mt-0.5 ${
                        notif.type === 'starvation'
                          ? 'text-red-400'
                          : notif.type === 'traveler_detected'
                            ? 'text-amber-400'
                            : 'text-[var(--burnt-amber)]'
                      }`}
                    >
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
