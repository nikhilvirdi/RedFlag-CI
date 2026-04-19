import { apiFetch } from '../lib/api'
import type { DashboardStats, Paginated, Repository, ScanResultDetail, ScanResultSummary } from './dashboard.types'

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await apiFetch<{ stats: DashboardStats }>('/api/dashboard/stats', { method: 'GET' })
  return res.stats
}

export async function getRepositories(): Promise<Repository[]> {
  const res = await apiFetch<{ repositories: Repository[] }>('/api/dashboard/repositories', { method: 'GET' })
  return res.repositories
}

export async function getRepositoryById(repositoryId: string): Promise<Repository> {
  const res = await apiFetch<{ repository: Repository }>(`/api/dashboard/repositories/${repositoryId}`, { method: 'GET' })
  return res.repository
}

export async function getScanResults(params: {
  repositoryId: string
  page: number
  pageSize: number
}): Promise<Paginated<ScanResultSummary>> {
  const { repositoryId, page, pageSize } = params
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  return await apiFetch<Paginated<ScanResultSummary>>(`/api/dashboard/repositories/${repositoryId}/scans?${qs.toString()}`, {
    method: 'GET',
  })
}

export async function getScanDetail(scanResultId: string): Promise<ScanResultDetail> {
  const res = await apiFetch<{ scanResult: ScanResultDetail }>(`/api/dashboard/scans/${scanResultId}`, { method: 'GET' })
  return res.scanResult
}

