import { useQuery } from '@tanstack/react-query'
import { getRepositoryById } from '../api/dashboard.api'

export function useRepository(repositoryId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', 'repository', repositoryId],
    queryFn: () => getRepositoryById(repositoryId!),
    enabled: Boolean(repositoryId),
  })
}

