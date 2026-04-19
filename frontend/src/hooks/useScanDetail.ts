import { useQuery } from '@tanstack/react-query'
import { getScanDetail } from '../api/dashboard.api'

export function useScanDetail(scanResultId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', 'scan', scanResultId],
    queryFn: () => getScanDetail(scanResultId!),
    enabled: Boolean(scanResultId),
  })
}

