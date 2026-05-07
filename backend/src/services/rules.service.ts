import { prisma } from '../config/db';

interface AnalyzerRule {
    id: string;
    name: string;
    category: string;
    engine: string;
    description: string;
    severity: string;
}

const ANALYZER_RULES: AnalyzerRule[] = [
    { id: 'credential-exposure', name: 'Credential Exposure', category: 'Secrets', engine: 'python', description: 'Detects hardcoded credentials, API keys, and secrets using pattern matching, variable name analysis, and entropy scoring.', severity: 'critical' },
    { id: 'sql-injection', name: 'SQL Injection', category: 'Injection', engine: 'python', description: 'Identifies SQL injection vulnerabilities through string concatenation and unsafe query patterns.', severity: 'critical' },
    { id: 'dependency-integrity', name: 'Dependency Integrity', category: 'Supply Chain', engine: 'python', description: 'Detects typosquatted packages and dependency confusion using a known-bad database and name similarity heuristics.', severity: 'high' },
    { id: 'prompt-injection', name: 'Prompt Injection', category: 'AI Security', engine: 'python', description: 'Detects LLM prompt injection vectors by analyzing prompt construction patterns.', severity: 'high' },
    { id: 'hallucinated-package', name: 'Hallucinated Package', category: 'AI Security', engine: 'python', description: 'Verifies imported packages against npm and PyPI registries to detect AI-hallucinated dependencies.', severity: 'high' },
    { id: 'ai-code-fingerprint', name: 'AI Code Fingerprint', category: 'AI Security', engine: 'python', description: 'Identifies patterns commonly associated with AI-generated code that may introduce security risks.', severity: 'medium' },
    { id: 'semgrep-sast', name: 'Semgrep SAST', category: 'SAST', engine: 'semgrep', description: 'Static analysis using Semgrep rules for common vulnerability patterns.', severity: 'high' },
    { id: 'checkov-iac', name: 'Checkov IaC', category: 'Infrastructure', engine: 'checkov', description: 'Scans infrastructure-as-code files for misconfigurations using Checkov.', severity: 'high' },
    { id: 'license-risk', name: 'License Risk', category: 'Compliance', engine: 'python', description: 'Detects dependencies with restrictive or incompatible licenses (GPL, AGPL, etc.).', severity: 'medium' },
    { id: 'trufflehog-secrets', name: 'TruffleHog Secrets', category: 'Secrets', engine: 'trufflehog', description: 'Scans git history for leaked secrets using TruffleHog.', severity: 'critical' },
    { id: 'environment-boundary', name: 'Environment Boundary', category: 'Configuration', engine: 'python', description: 'Detects misconfigurations like disabled TLS, debug mode, wildcard CORS, and insecure bind addresses.', severity: 'high' },
    { id: 'dead-code-ghost-deps', name: 'Dead Code / Ghost Deps', category: 'Code Quality', engine: 'python', description: 'Identifies unused imports, dead exports, and dependencies declared but not used in the diff.', severity: 'low' },
    { id: 'auth-pattern', name: 'Auth/Authz Pattern', category: 'Authentication', engine: 'python', description: 'Detects missing auth middleware, hardcoded roles, insecure hashing, and weak JWT/cookie configs.', severity: 'high' },
    { id: 'crypto-weakness', name: 'Cryptography Weakness', category: 'Cryptography', engine: 'python', description: 'Detects weak algorithms (MD5, SHA1, DES), insecure randomness, and hardcoded IVs/salts.', severity: 'high' },
    { id: 'input-validation-gap', name: 'Input Validation Gap', category: 'Injection', engine: 'python', description: 'Identifies missing sanitization when user input reaches sensitive sinks (SQL, OS command, XSS, SSRF).', severity: 'high' },
    { id: 'dangerous-pattern', name: 'Dangerous Patterns', category: 'Code Safety', engine: 'python', description: 'Detects eval(), exec(), pickle.loads(), subprocess shell=True, and other dangerous runtime patterns.', severity: 'critical' },
    { id: 'async-concurrency', name: 'Async / Concurrency', category: 'Code Safety', engine: 'python', description: 'Detects unhandled promise rejections, missing awaits, and asyncio misuse patterns.', severity: 'medium' },
];

export function listAnalyzerRules(): AnalyzerRule[] {
    return ANALYZER_RULES;
}

export async function suggestRule(
    userId: string,
    title: string,
    description: string,
    category: string,
    pattern: string,
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
) {
    return prisma.ruleSuggestion.create({
        data: { userId, title, description, category, pattern, severity }
    });
}

export async function listRuleSuggestions(status?: string) {
    const where = status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {};
    return prisma.ruleSuggestion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, githubId: true } } }
    });
}

export async function approveRuleSuggestion(suggestionId: string, reviewNote?: string) {
    const suggestion = await prisma.ruleSuggestion.findUnique({ where: { id: suggestionId } });
    if (!suggestion) throw new Error('Rule suggestion not found.');

    return prisma.ruleSuggestion.update({
        where: { id: suggestionId },
        data: { status: 'APPROVED', reviewNote }
    });
}

export async function rejectRuleSuggestion(suggestionId: string, reviewNote?: string) {
    const suggestion = await prisma.ruleSuggestion.findUnique({ where: { id: suggestionId } });
    if (!suggestion) throw new Error('Rule suggestion not found.');

    return prisma.ruleSuggestion.update({
        where: { id: suggestionId },
        data: { status: 'REJECTED', reviewNote }
    });
}
