export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN'

export type ScanStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW'
export type RemediationType = 'AUTOMATIC' | 'GUIDED'

export type DashboardStats = {
  totalRepos: number
  totalScans: number
  totalFindings: number
  scansByRiskLevel: Partial<Record<RiskLevel, number>>
}

export type Repository = {
  id: string
  githubRepoId: string
  name: string
  fullName: string
  url: string
  isPrivate: boolean
  createdAt: string
  updatedAt: string
  _count?: {
    scanResults: number
  }
}

export type RiskScore = {
  id: string
  totalScore: number
  classification: RiskLevel
  contributionData: Record<string, unknown>
  scanResultId: string
}

export type Remediation = {
  id: string
  type: RemediationType
  correctedCode: string | null
  recommendation: string | null
  findingId: string
}

export type Finding = {
  id: string
  category: string
  description: string
  file: string
  lineNumber: number | null
  severity: RiskLevel
  confidence: ConfidenceLevel
  codeSnippet: string | null
  scanResultId: string
  remediation: Remediation | null
}

export type ScanResultSummary = {
  id: string
  pullRequestId: string
  commitSha: string
  status: ScanStatus
  createdAt: string
  updatedAt: string
  repositoryId: string
  riskScore: RiskScore | null
  _count: { findings: number }
}

export type ScanResultDetail = {
  id: string
  pullRequestId: string
  commitSha: string
  status: ScanStatus
  createdAt: string
  repository: {
    fullName: string
    url: string
  }
  riskScore: RiskScore | null
  findings: Finding[]
}

export type PaginationInfo = {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export type Paginated<T> = {
  data: T[]
  pagination: PaginationInfo
}

