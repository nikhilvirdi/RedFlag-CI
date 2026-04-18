"""
RedFlag CI — Python Scan Engine Entry Point
────────────────────────────────────────────

This is the main orchestrator that:
  1. Reads a unified diff from stdin (piped by Node.js via child_process)
  2. Parses it into structured file/line data
  3. Runs all security analyzers in sequence
  4. Calculates the aggregate risk score
  5. Outputs the result as JSON to stdout (consumed by Node.js)

Communication Protocol:
───────────────────────
    Input:  Raw unified diff text via stdin
    Output: JSON object via stdout matching the ScanEngineResult interface
    Logs:   Internal diagnostics via stderr (captured by Node.js as debug logs)

💡 Why stdin/stdout instead of HTTP or files?
─────────────────────────────────────────────
This follows the Unix "Sidecar" or "Filter" pattern — a program that:
  1. Reads input from stdin
  2. Processes it
  3. Writes output to stdout

Benefits:
  - No network overhead: no HTTP server startup, no port binding, no TCP handshake
  - No file I/O: no temp files to create, write, read, and clean up
  - Language-agnostic: ANY language can spawn a process and pipe to stdin/stdout
  - Testable: you can test this script manually with `echo "diff..." | python main.py`

💡 Why stderr for logs?
───────────────────────
Node.js reads stdout to get the JSON result. If we accidentally print()
a log message to stdout, it would invalidate the JSON and crash JSON.parse()
in scan.service.ts. stderr is the safe channel for diagnostics — Node.js
captures it separately via pythonProcess.stderr and routes it to the logger.

This script is invoked by the Node.js backend as:
    const process = spawn('python3', ['backend/scan-engine/main.py']);
    process.stdin.write(diff);
    process.stdin.end();
    // ... reads process.stdout for JSON result
"""

import sys
import json
import time

# ── Internal imports ─────────────────────────────────────────────────────────
# These modules live in the same directory as main.py.
# Python automatically adds the script's directory to sys.path[0],
# so "from diff_parser import ..." resolves to ./diff_parser.py.
from diff_parser import parse_diff
from models import ScanEngineResult
from scoring import calculate_risk_score

# Each analyzer follows the uniform interface: analyze(files) -> List[ScanFinding]
from analyzers import credential_analyzer
from analyzers import sql_injection_analyzer
from analyzers import dependency_analyzer
from analyzers import prompt_injection_analyzer


def log(message: str) -> None:
    """
    Write diagnostic logs to stderr, NOT stdout.

    💡 Critical distinction:
    - stdout = the JSON result (consumed by Node.js JSON.parse())
    - stderr = diagnostic logs (captured by Node.js for debug logging)

    Using print() without file=sys.stderr would write to stdout
    and corrupt the JSON output, causing the entire scan to fail.
    """
    print(f"[ScanEngine] {message}", file=sys.stderr)


def main() -> None:
    """
    Main orchestration function. Coordinates the full scan pipeline.

    Execution flow:
        stdin → parse_diff → analyzers → scoring → stdout (JSON)
    """
    start_time = time.time()

    # ── Step 1: Read the diff from stdin ─────────────────────────────────
    # sys.stdin.read() blocks until EOF is received. Node.js signals EOF by
    # calling pythonProcess.stdin.end() after writing the diff.
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
        # This is the ONLY print to stdout — the JSON that Node.js parses.
        print(json.dumps(result.to_dict()))
        return

    log(f"Diff received: {len(raw_diff)} bytes")

    # ── Step 2: Parse the diff into structured data ──────────────────────
    # Converts the raw unified diff text into DiffFile objects containing
    # only the ADDED lines with their correct line numbers.
    log("Parsing diff...")
    files = parse_diff(raw_diff)

    total_added_lines = sum(len(f.added_lines) for f in files)
    log(f"Parsed {len(files)} file(s) with {total_added_lines} added line(s).")

    # ── Step 3: Run all analyzers ────────────────────────────────────────
    # Each analyzer returns a List[ScanFinding]. We aggregate all results.
    #
    # 💡 Why a list of tuples instead of calling each analyzer directly?
    # This is the "Registration Pattern" — adding a new analyzer is as
    # simple as:
    #   1. Create analyzers/new_analyzer.py with an analyze() function
    #   2. Import it at the top of this file
    #   3. Add one tuple to this list
    # No other code needs to change.
    #
    # 💡 Future optimization:
    # Since analyzers are independent (they don't share state), they can
    # be run in parallel using concurrent.futures.ThreadPoolExecutor.
    # For now, sequential execution is fast enough (< 1 second for most PRs).

    all_findings = []

    analyzers = [
        ('Credential Exposure',     credential_analyzer.analyze),
        ('SQL Injection',           sql_injection_analyzer.analyze),
        ('Dependency Integrity',    dependency_analyzer.analyze),
        ('Prompt Injection',        prompt_injection_analyzer.analyze),
    ]

    for name, analyzer_fn in analyzers:
        log(f"Running: {name} analyzer...")
        findings = analyzer_fn(files)
        log(f"  → {len(findings)} finding(s)")
        all_findings.extend(findings)

    # ── Step 4: Calculate risk score ─────────────────────────────────────
    # Aggregates all findings using weighted severity × confidence formula.
    # Returns a normalized 0-100 score and a classification label.
    risk_score, classification, summary = calculate_risk_score(all_findings)
    log(f"Risk Score: {risk_score}/100 | Classification: {classification}")

    # ── Step 5: Build the result and write JSON to stdout ────────────────
    result = ScanEngineResult(
        findings=all_findings,
        risk_score=risk_score,
        risk_classification=classification,
        summary=summary,
    )

    elapsed = time.time() - start_time
    log(f"Scan complete in {elapsed:.2f}s. Total findings: {len(all_findings)}")

    # ── THE CRITICAL LINE ────────────────────────────────────────────────
    # This is the ONE AND ONLY print to stdout in the entire engine.
    # Node.js reads this exact JSON string via pythonProcess.stdout
    # and feeds it to JSON.parse() in scan.service.ts.
    # indent=None produces compact JSON (no whitespace) for faster transmission.
    print(json.dumps(result.to_dict(), indent=None))


if __name__ == '__main__':
    main()
