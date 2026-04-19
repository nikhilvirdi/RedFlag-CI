import { useNavigate } from 'react-router-dom'
import type { Repository } from '../../api/dashboard.types'
import { RepoCard } from './RepoCard'

export function RepoGrid({ repos }: { repos: Repository[] }) {
  const navigate = useNavigate()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      {repos.map((r) => (
        <RepoCard key={r.id} repo={r} onOpen={(id) => navigate(`/app/repos/${id}`)} />
      ))}
    </div>
  )
}
