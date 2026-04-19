export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  const prevDisabled = page <= 1
  const nextDisabled = page >= totalPages

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).slice(
    Math.max(0, page - 3),
    Math.min(totalPages, page + 2)
  )

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      <button
        disabled={prevDisabled}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        className="glass"
        style={{
          cursor: prevDisabled ? 'default' : 'pointer',
          opacity: prevDisabled ? 0.5 : 1,
          padding: '6px 10px',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: '#fff',
          fontSize: 12,
        }}
      >
        Prev
      </button>

      {pages.map((p) => {
        const active = p === page
        return (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`glass ${active ? 'glow-cyan' : ''}`}
            style={{
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              border: active ? '1px solid rgba(0,251,255,0.18)' : '1px solid rgba(255,255,255,0.10)',
              color: '#fff',
              fontSize: 12,
              minWidth: 36,
            }}
            aria-current={active ? 'page' : undefined}
          >
            {p}
          </button>
        )
      })}

      <button
        disabled={nextDisabled}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        className="glass"
        style={{
          cursor: nextDisabled ? 'default' : 'pointer',
          opacity: nextDisabled ? 0.5 : 1,
          padding: '6px 10px',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: '#fff',
          fontSize: 12,
        }}
      >
        Next
      </button>
    </div>
  )
}

