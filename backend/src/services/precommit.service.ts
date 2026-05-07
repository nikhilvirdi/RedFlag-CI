import { prisma } from '../config/db';

export async function generatePrecommitConfig(repositoryId: string): Promise<string> {
    const latestScan = await prisma.scanResult.findFirst({
        where: { repositoryId, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        include: { findings: true }
    });

    const categories = new Set<string>();
    if (latestScan) {
        for (const f of latestScan.findings) {
            categories.add(f.category.toLowerCase());
        }
    }

    const hooks: string[] = [];

    hooks.push(`repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
      - id: detect-private-key`);

    if (categories.has('credential exposure') || categories.has('credential') || categories.size === 0) {
        hooks.push(`
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.5.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']`);
    }

    if (categories.has('semgrep sast') || categories.size === 0) {
        hooks.push(`
  - repo: https://github.com/semgrep/semgrep
    rev: v1.78.0
    hooks:
      - id: semgrep
        args: ['--config', 'auto', '--error']`);
    }

    if (categories.has('checkov iac') || categories.has('environment boundary') || categories.size === 0) {
        hooks.push(`
  - repo: https://github.com/bridgecrewio/checkov
    rev: 3.2.0
    hooks:
      - id: checkov`);
    }

    if (categories.has('trufflehog secrets') || categories.size === 0) {
        hooks.push(`
  - repo: https://github.com/trufflesecurity/trufflehog
    rev: v3.78.0
    hooks:
      - id: trufflehog
        entry: trufflehog git file://. --only-verified --fail`);
    }

    if (categories.has('license risk') || categories.size === 0) {
        hooks.push(`
  - repo: local
    hooks:
      - id: license-check
        name: License Compliance Check
        entry: npx license-checker --failOn "GPL-3.0;AGPL-3.0"
        language: system
        pass_filenames: false
        stages: [commit]`);
    }

    return hooks.join('\n');
}
