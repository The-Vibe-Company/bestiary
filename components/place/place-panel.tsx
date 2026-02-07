interface PlacePanelProps {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}

export function PlacePanel({ icon, title, children }: PlacePanelProps) {
  return (
    <div className="h-full flex flex-col bg-black/75 backdrop-blur border border-[var(--burnt-amber)]/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-[var(--ivory)]/10">
        <span className="text-[var(--burnt-amber)]">{icon}</span>
        <h2 className="text-sm font-[family-name:var(--font-title)] tracking-[0.15em] text-[var(--ivory)] uppercase">
          {title}
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {children}
      </div>
    </div>
  )
}
