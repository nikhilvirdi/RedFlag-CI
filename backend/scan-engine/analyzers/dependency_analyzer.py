import re
import sys
from typing import List, Set

from models import ScanFinding
from diff_parser import DiffFile


TYPOSQUAT_DB: dict[str, Set[str]] = {
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

    'requests':     {'requets', 'reqeusts', 'request', 'requsts'},
    'numpy':        {'numppy', 'numby', 'numpie'},
    'pandas':       {'pands', 'pandass', 'pnadas'},
    'flask':        {'flaask', 'flassk', 'flak'},
    'django':       {'djnago', 'djanog', 'djangoo'},
    'cryptography': {'crytography', 'cryptograpy'},
    'boto3':        {'botto3', 'boto33', 'botoo3'},
    'pillow':       {'pilllow', 'pilow', 'piilow'},
}

KNOWN_BAD_PACKAGES: Set[str] = set()
for variants in TYPOSQUAT_DB.values():
    KNOWN_BAD_PACKAGES.update(variants)


JS_IMPORT_PATTERN = re.compile(
    r'''(?:import\s+.*?\s+from\s+|require\s*\(\s*)["']([^"'./][^"']*)["']'''
)

PY_IMPORT_PATTERN = re.compile(
    r'''(?:^|\s)(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_]*)'''
)

PKG_JSON_PATTERN = re.compile(
    r'''"([^"@./][^"]*?)"\s*:\s*"[^"]*"'''
)

REQUIREMENTS_PATTERN = re.compile(
    r'''^([a-zA-Z0-9_-]+)(?:[=<>!~]|$)'''
)


def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    findings: List[ScanFinding] = []
    try:
        for diff_file in files:
            for diff_line in diff_file.added_lines:
                line_content = diff_line.content
                stripped = line_content.strip()

                if not stripped:
                    continue

                packages = _extract_packages(diff_file.filename, line_content)

                for package_name in packages:
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
    except Exception as e:
        print(f'[DependencyAnalyzer] error: {e}', file=sys.stderr)
    return findings


def _extract_packages(filename: str, line: str) -> List[str]:
    packages: List[str] = []

    if filename.endswith(('.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs')):
        packages.extend(JS_IMPORT_PATTERN.findall(line))
    elif filename.endswith('.py'):
        packages.extend(PY_IMPORT_PATTERN.findall(line))
    elif filename.endswith('package.json'):
        packages.extend(PKG_JSON_PATTERN.findall(line))
    elif 'requirements' in filename and filename.endswith('.txt'):
        packages.extend(REQUIREMENTS_PATTERN.findall(line))

    normalized: List[str] = []
    for pkg in packages:
        if '/' in pkg:
            normalized.append(pkg.split('/')[-1])
        else:
            normalized.append(pkg)

    return normalized


def _find_legitimate_package(typosquat_name: str) -> str:
    for legit, variants in TYPOSQUAT_DB.items():
        if typosquat_name in variants:
            return legit
    return 'unknown'


def _has_suspicious_pattern(package_name: str) -> bool:
    if len(package_name) > 40:
        return True

    if re.search(r'\d{4,}$', package_name):
        return True

    if re.search(r'(?i)(install|setup|update|download|free|crack|keygen)', package_name):
        return True

    return False
