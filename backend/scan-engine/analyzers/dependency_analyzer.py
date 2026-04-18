"""
Dependency Integrity Analyzer
─────────────────────────────

Detects suspicious, potentially malicious, or typosquatted package dependencies.

💡 What is a Supply Chain Attack?
─────────────────────────────────
Instead of attacking YOUR code, an attacker publishes a malicious package
on npm or PyPI with a name very similar to a popular legitimate package.
When a developer (or an AI code generator) accidentally imports the wrong
name, the malicious code executes on their machine or server.

Real-world examples:
  - "crossenv" (malicious) vs "cross-env" (legitimate) — stolen env variables
  - "event-stream" — legitimate package hijacked to steal Bitcoin
  - "ua-parser-js" — compromised to install crypto miners

Supply chain attacks via package managers grew 700% between 2021-2023
(Sonatype State of the Software Supply Chain Report).

💡 What is Typosquatting?
─────────────────────────
Typosquatting is registering a domain/package name that is a common TYPO
of a popular name. The attacker bets that developers will make mistakes:
  - "lod ash" → "lodahs" (character swap)
  - "express" → "expres" (missing character)
  - "axios" → "axois" (letter transposition)

Detection Strategy:
───────────────────
1. Parse import/require statements to extract package names
2. Check against a curated database of known typosquat variants
3. Apply heuristic rules for suspicious naming patterns
"""

import re
from typing import List, Set

from models import ScanFinding
from diff_parser import DiffFile


# ─────────────────────────────────────────────────────────────────────────────
# KNOWN TYPOSQUAT DATABASE
# ─────────────────────────────────────────────────────────────────────────────
# Map of legitimate packages to their known typosquat variants.
# These are based on real-world incidents and common typo patterns.
#
# 💡 Why a hardcoded database instead of an API call?
# The scan engine runs as a child process for every PR. Making HTTP requests
# to an external registry for every import statement would:
#   1. Add seconds of latency per scan
#   2. Fail if the registry is down (making our CI unreliable)
#   3. Require rate limiting logic
# A local database is instant, offline-capable, and deterministic.

TYPOSQUAT_DB: dict[str, Set[str]] = {
    # ── npm ecosystem ────────────────────────────────────────────────────
    'lodash':       {'lodahs', 'lodashs', 'lodash-utils', 'l0dash'},
    'express':      {'expres', 'expresss', 'xpress', 'expess'},
    'react':        {'raect', 'reactt', 'reect', 're-act'},
    'axios':        {'axois', 'axioss', 'axxios', 'axos'},
    'moment':       {'momnet', 'momentt', 'momnent'},
    'chalk':        {'chalks', 'chaulk', 'chlak'},
    'dotenv':       {'dot-env', 'dotenvs', 'dotnev'},
    'mongoose':     {'mongose', 'mongoosee', 'mongooze'},
    'jsonwebtoken': {'json-web-token', 'jsonwebtokens', 'jwt-token'},
    'bcrypt':       {'bcyrpt', 'bcrpyt', 'bcript'},
    'cors':         {'corss', 'c0rs'},
    'helmet':       {'helmett', 'helment'},
    'nodemon':      {'nodmon', 'nodemn'},
    'prisma':       {'prissma', 'prizma'},

    # ── Python ecosystem ─────────────────────────────────────────────────
    'requests':     {'requets', 'reqeusts', 'request', 'requsts'},
    'numpy':        {'numppy', 'numby', 'numpie'},
    'pandas':       {'pands', 'pandass', 'pnadas'},
    'flask':        {'flaask', 'flassk', 'flak'},
    'django':       {'djnago', 'djanog', 'djangoo'},
    'cryptography': {'crytography', 'cryptograpy'},
    'boto3':        {'botto3', 'boto33', 'botoo3'},
    'pillow':       {'pilllow', 'pilow', 'piilow'},
}

# Build a flat set of ALL known malicious names for O(1) lookup.
# O(1) means constant-time lookup regardless of database size — checking
# if a name is in a set is as fast for 10 items as for 10,000.
KNOWN_BAD_PACKAGES: Set[str] = set()
for variants in TYPOSQUAT_DB.values():
    KNOWN_BAD_PACKAGES.update(variants)


# ─────────────────────────────────────────────────────────────────────────────
# IMPORT / REQUIRE PARSERS
# ─────────────────────────────────────────────────────────────────────────────
# Each regex extracts the PACKAGE NAME from different import syntaxes.
#
# 💡 Why [^"'./] as the first character?
# This excludes RELATIVE imports like './utils' or '../config'.
# Relative imports are local files, not external packages — they can't be
# typosquatted because they don't come from a registry.

# JavaScript/TypeScript:
#   import express from 'express'
#   const express = require('express')
JS_IMPORT_PATTERN = re.compile(
    r'''(?:import\s+.*?\s+from\s+|require\s*\(\s*)["']([^"'./][^"']*)["']'''
)

# Python:
#   import requests
#   from flask import Flask
PY_IMPORT_PATTERN = re.compile(
    r'''(?:^|\s)(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_]*)'''
)

# package.json dependencies:
#   "express": "^4.18.0"
PKG_JSON_PATTERN = re.compile(
    r'''"([^"@./][^"]*?)"\s*:\s*"[^"]*"'''
)

# requirements.txt:
#   flask==2.0.0
#   requests>=2.28
REQUIREMENTS_PATTERN = re.compile(
    r'''^([a-zA-Z0-9_-]+)(?:[=<>!~]|$)'''
)


def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    """
    Analyze added dependencies for supply chain risks.

    Scans import statements in code files, package.json entries,
    and requirements.txt entries for known typosquats and suspicious names.
    """
    findings: List[ScanFinding] = []

    for diff_file in files:
        for diff_line in diff_file.added_lines:
            line_content = diff_line.content
            stripped = line_content.strip()

            if not stripped:
                continue

            # Extract package names based on file type
            packages = _extract_packages(diff_file.filename, line_content)

            for package_name in packages:
                # ── Check 1: Known typosquat match ───────────────────
                if package_name.lower() in KNOWN_BAD_PACKAGES:
                    legit_name = _find_legitimate_package(package_name.lower())

                    findings.append(ScanFinding(
                        type='dependency',
                        severity='critical',
                        confidence='high',
                        file=diff_file.filename,
                        line=diff_line.line_number,
                        description=(
                            f'Known typosquat package detected: "{package_name}". '
                            f'This is likely a malicious imitation of the legitimate '
                            f'package "{legit_name}". It may contain code that steals '
                            f'environment variables, installs backdoors, or mines cryptocurrency.'
                        ),
                        original_code=stripped,
                        remediated_code=stripped.replace(package_name, legit_name),
                        recommendation=(
                            f'Replace "{package_name}" with "{legit_name}". '
                            f'Remove this package immediately and audit your '
                            f'node_modules or site-packages directory for unexpected files.'
                        ),
                    ))

                # ── Check 2: Suspicious naming heuristics ────────────
                elif _has_suspicious_pattern(package_name):
                    findings.append(ScanFinding(
                        type='dependency',
                        severity='medium',
                        confidence='low',
                        file=diff_file.filename,
                        line=diff_line.line_number,
                        description=(
                            f'Package "{package_name}" has a suspicious naming pattern. '
                            f'This may indicate a typosquat or malicious package.'
                        ),
                        original_code=stripped,
                        recommendation=(
                            f'Verify that "{package_name}" is the correct package by '
                            f'checking its npm/PyPI page, download count, maintainer '
                            f'history, and GitHub repository link.'
                        ),
                    ))

    return findings


def _extract_packages(filename: str, line: str) -> List[str]:
    """
    Extract package names from a code line based on the file type.

    Returns a list because a single line could theoretically contain
    multiple imports (though this is rare in practice).
    """
    packages: List[str] = []

    if filename.endswith(('.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs')):
        packages.extend(JS_IMPORT_PATTERN.findall(line))
    elif filename.endswith('.py'):
        packages.extend(PY_IMPORT_PATTERN.findall(line))
    elif filename.endswith('package.json'):
        packages.extend(PKG_JSON_PATTERN.findall(line))
    elif 'requirements' in filename and filename.endswith('.txt'):
        packages.extend(REQUIREMENTS_PATTERN.findall(line))

    # Normalize scoped packages: '@scope/package' → 'package'
    # We check the package-local name because typosquats target the package
    # name, not the scope (e.g., '@evil/express' vs 'expres').
    normalized: List[str] = []
    for pkg in packages:
        if '/' in pkg:
            normalized.append(pkg.split('/')[-1])
        else:
            normalized.append(pkg)

    return normalized


def _find_legitimate_package(typosquat_name: str) -> str:
    """Find the legitimate package that a typosquat is imitating."""
    for legit, variants in TYPOSQUAT_DB.items():
        if typosquat_name in variants:
            return legit
    return 'unknown'


def _has_suspicious_pattern(package_name: str) -> bool:
    """
    Heuristic check for suspicious package naming patterns.

    These rules catch packages that aren't in our typosquat database
    but still look suspicious based on common attack patterns.
    """
    # Extremely long names (> 40 chars) — often auto-generated malware
    if len(package_name) > 40:
        return True

    # All-numeric suffixes of 4+ digits — bulk-registered malicious packages
    if re.search(r'\d{4,}$', package_name):
        return True

    # Social engineering keywords — these trick devs into thinking they're tools
    if re.search(r'(?i)(install|setup|update|download|free|crack|keygen)', package_name):
        return True

    return False
