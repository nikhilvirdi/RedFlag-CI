import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getScanResults } from '../api/dashboard.api'
import type { Paginated, ScanResultSummary } from '../api/dashboard.types'

export function useScanResults(params: {
  repositoryId: string | undefined
  page: number
  pageSize: number
}) {
  const { repositoryId, page, pageSize } = params
  return useQuery<Paginated<ScanResultSummary>>({
    queryKey: ['dashboard', 'repository', repositoryId, 'scans', page, pageSize],
    queryFn: () => getScanResults({ repositoryId: repositoryId!, page, pageSize }),
    enabled: Boolean(repositoryId),
    placeholderData: keepPreviousData,
  })
}

