import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { getScanResults } from '../api/dashboard.api'
import type { Repository, ScanResultSummary } from '../api/dashboard.types'

export type RecentScanRow = ScanResultSummary & {
  repositoryId: string
  repositoryFullName: string
}

/**
 * Fetches first page of scans for up to `maxRepos` repositories and merges
 * into a single list sorted by `createdAt` descending (client-side aggregation).
 */
export function useRecentScans(repositories: Repository[] | undefined, maxRepos = 15) {
  const slice = useMemo(() => (repositories ?? []).slice(0, maxRepos), [repositories, maxRepos])

  const queries = useQueries({
    queries: slice.map((repo) => ({
      queryKey: ['dashboard', 'repository', repo.id, 'scans', 'recent-feed', 1, 10] as const,
      queryFn: () => getScanResults({ repositoryId: repo.id, page: 1, pageSize: 10 }),
      enabled: Boolean(repositories?.length),
    })),
  })

  const isLoading = queries.some((q) => q.isLoading)

  const dataUpdatedAt = queries.map((q) => q.dataUpdatedAt).join(',')

  const recent = useMemo(() => {
    const merged: RecentScanRow[] = []
    queries.forEach((q, i) => {
      const repo = slice[i]
      if (!repo || !q.data?.data) return
      for (const s of q.data.data) {
        merged.push({
          ...s,
          repositoryId: repo.id,
          repositoryFullName: repo.fullName,
        })
      }
    })
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return merged.slice(0, 5)
  }, [slice, queries, dataUpdatedAt])

  return { recent, isLoading }
}
