import { useQuery } from '@tanstack/react-query'
import { getRepositories } from '../api/dashboard.api'

export function useRepositories() {
  return useQuery({
    queryKey: ['dashboard', 'repositories'],
    queryFn: getRepositories,
  })
}

