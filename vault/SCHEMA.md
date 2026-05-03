# Database Schema — Current State

Last migration: 20260418175232_init_full

## User
Stores authenticated developers. Identified by githubId (GitHub's permanent numeric ID).
Fields: id (uuid), githubId (unique string), email (nullable), name (nullable), avatarUrl, createdAt, updatedAt.
Relations: has many Repository.

## Repository
A GitHub repo associated with a user. Created when GitHub App is installed.
Fields: id (uuid), githubRepoId (unique), name, fullName, url, isPrivate, createdAt, updatedAt.
Relations: belongs to User, has many ScanResult.

## ScanResult
Output of one scan on one PR. One per PR event processed.
Fields: id (uuid), pullRequestId (string), commitSha, status (PENDING|IN_PROGRESS|COMPLETED|FAILED), createdAt, updatedAt.
Relations: belongs to Repository, has one RiskScore, has many Finding.

## RiskScore
The computed 0-100 score for a ScanResult.
Fields: id (uuid), totalScore (float), classification (CRITICAL|HIGH|MEDIUM|LOW|CLEAN), contributionData (JSON), scanResultId (unique).
Relations: belongs to ScanResult (1-to-1).

## Finding
A single detected vulnerability within a ScanResult.
Fields: id (uuid), category (string), description, file, lineNumber (nullable int), severity (RiskLevel enum), confidence (ConfidenceLevel enum), codeSnippet (nullable), scanResultId.
Relations: belongs to ScanResult, has one optional Remediation.

## Remediation
The fix associated with a Finding.
Fields: id (uuid), type (AUTOMATIC|GUIDED), correctedCode (nullable), recommendation (nullable), findingId (unique).
Relations: belongs to Finding (1-to-1).

## Enums
ScanStatus: PENDING, IN_PROGRESS, COMPLETED, FAILED
RiskLevel: CRITICAL, HIGH, MEDIUM, LOW, CLEAN
ConfidenceLevel: HIGH, MEDIUM, LOW
RemediationType: AUTOMATIC, GUIDED

## Pending Schema Additions (not yet migrated)
- IgnoreRule model (Stage 5)
- BaselineSnapshot model (Stage 5)
- CodeEmbedding model with pgvector (Stage 5)
- AuditLog model (Stage 7)
- NotificationConfig model (Stage 7)
- OutboundWebhook model (Stage 7)
- CommunityRule model (Stage 7)
- ScheduledScanLog model (Stage 6)
