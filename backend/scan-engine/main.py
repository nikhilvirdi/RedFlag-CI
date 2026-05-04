import sys
import json
import time

from diff_parser import parse_diff
from models import ScanEngineResult
from scoring import calculate_risk_score

from analyzers import credential_analyzer
from analyzers import sql_injection_analyzer
from analyzers import dependency_analyzer
from analyzers import prompt_injection_analyzer
from analyzers import hallucinated_package_analyzer
from analyzers import ai_fingerprint_analyzer
from analyzers import semgrep_analyzer
from analyzers import checkov_analyzer
from analyzers import license_risk_analyzer
from analyzers import trufflehog_analyzer
from analyzers import environment_boundary_analyzer
from analyzers import dead_code_analyzer
from analyzers import auth_pattern_analyzer


def log(message: str) -> None:
    print(f"[ScanEngine] {message}", file=sys.stderr)


def main() -> None:
    start_time = time.time()

    log("Reading diff from stdin...")
    raw_diff = sys.stdin.read()

    if not raw_diff.strip():
        log("Empty diff received. Returning clean result.")
        result = ScanEngineResult(
            findings=[],
            risk_score=0,
            risk_classification='clean',
            summary='No code changes to analyze.',
        )
        print(json.dumps(result.to_dict()))
        return

    log(f"Diff received: {len(raw_diff)} bytes")

    log("Parsing diff...")
    files = parse_diff(raw_diff)

    total_added_lines = sum(len(f.added_lines) for f in files)
    log(f"Parsed {len(files)} file(s) with {total_added_lines} added line(s).")

    all_findings = []

    analyzers = [
        ('Credential Exposure',       credential_analyzer.analyze),
        ('SQL Injection',             sql_injection_analyzer.analyze),
        ('Dependency Integrity',      dependency_analyzer.analyze),
        ('Prompt Injection',          prompt_injection_analyzer.analyze),
        ('Hallucinated Package',      hallucinated_package_analyzer.analyze),
        ('AI Code Fingerprint',       ai_fingerprint_analyzer.analyze),
        ('Semgrep SAST',              semgrep_analyzer.analyze),
        ('Checkov IaC',               checkov_analyzer.analyze),
        ('License Risk',              license_risk_analyzer.analyze),
        ('TruffleHog Secrets',        trufflehog_analyzer.analyze),
        ('Environment Boundary',      environment_boundary_analyzer.analyze),
        ('Dead Code / Ghost Deps',    dead_code_analyzer.analyze),
        ('Auth/Authz Pattern',        auth_pattern_analyzer.analyze),
    ]

    for name, analyzer_fn in analyzers:
        log(f"Running: {name} analyzer...")
        findings = analyzer_fn(files)
        log(f"  → {len(findings)} finding(s)")
        all_findings.extend(findings)

    risk_score, classification, summary = calculate_risk_score(all_findings)
    log(f"Risk Score: {risk_score}/100 | Classification: {classification}")

    result = ScanEngineResult(
        findings=all_findings,
        risk_score=risk_score,
        risk_classification=classification,
        summary=summary,
    )

    elapsed = time.time() - start_time
    log(f"Scan complete in {elapsed:.2f}s. Total findings: {len(all_findings)}")

    print(json.dumps(result.to_dict(), indent=None))


if __name__ == '__main__':
    main()
