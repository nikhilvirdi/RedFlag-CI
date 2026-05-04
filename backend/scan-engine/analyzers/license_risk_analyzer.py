import re
import sys
import json
import urllib.request
import urllib.error
from typing import List, Dict, Tuple

from models import ScanFinding
from diff_parser import DiffFile


NPM_REGISTRY_URL = "https://registry.npmjs.org/{package}"
PYPI_REGISTRY_URL = "https://pypi.org/pypi/{package}/json"
REQUEST_TIMEOUT_SECONDS = 5

PKG_JSON_RE = re.compile(r""""((?:@[^"./][^"]*\/)?[^"@./][^"]*?)"\s*:\s*"[^"]*\d[^"]*\"""")
REQUIREMENTS_RE = re.compile(r"""^([a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?)(?:[=<>!~;\s]|$)""")

RESTRICTIVE_LICENSES = {'gpl', 'agpl', 'lgpl'}


def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    findings: List[ScanFinding] = []
    npm_candidates: Dict[str, Tuple[str, int, str]] = {}
    pypi_candidates: Dict[str, Tuple[str, int, str]] = {}

    for diff_file in files:
        filename = diff_file.filename
        for diff_line in diff_file.added_lines:
            line = diff_line.content
            stripped = line.strip()

            if not stripped or stripped.startswith('#') or stripped.startswith('//'):
                continue

            if filename.endswith('package.json'):
                for pkg in PKG_JSON_RE.findall(line):
                    pkg_norm = pkg.strip()
                    if pkg_norm and pkg_norm not in npm_candidates:
                        npm_candidates[pkg_norm] = (filename, diff_line.line_number, stripped)

            elif 'requirements' in filename and filename.endswith('.txt'):
                match = REQUIREMENTS_RE.match(stripped)
                if match:
                    pkg_norm = match.group(1).strip()
                    if pkg_norm and pkg_norm not in pypi_candidates:
                        pypi_candidates[pkg_norm] = (filename, diff_line.line_number, stripped)

    _log(f"Checking licenses for {len(npm_candidates)} npm package(s) and {len(pypi_candidates)} PyPI package(s)...")

    for pkg_name, (filename, line_number, original_code) in npm_candidates.items():
        license_name, err = _get_npm_license(pkg_name)
        if err:
            _log(f"npm license check skipped for '{pkg_name}': {err}")
            continue
        risk, reason = _evaluate_license(license_name)
        if risk:
            findings.append(_make_finding(pkg_name, 'npm', license_name, reason, filename, line_number, original_code))

    for pkg_name, (filename, line_number, original_code) in pypi_candidates.items():
        license_name, err = _get_pypi_license(pkg_name)
        if err:
            _log(f"PyPI license check skipped for '{pkg_name}': {err}")
            continue
        risk, reason = _evaluate_license(license_name)
        if risk:
            findings.append(_make_finding(pkg_name, 'PyPI', license_name, reason, filename, line_number, original_code))

    return findings


def _evaluate_license(license_name: str) -> Tuple[bool, str]:
    if not license_name or str(license_name).lower().strip() in ('unknown', 'missing', 'none', 'null'):
        return True, "Unknown or missing license"
    
    lower_license = str(license_name).lower()
    for rest_lic in RESTRICTIVE_LICENSES:
        if rest_lic in lower_license:
            return True, "Restrictive license detected"
            
    return False, ""


def _get_npm_license(package_name: str) -> Tuple[str, str]:
    url = NPM_REGISTRY_URL.format(package=urllib.request.quote(package_name, safe='@/'))
    try:
        req = urllib.request.Request(url, headers={'Accept': 'application/json'})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode('utf-8'))
                lic = data.get('license', 'unknown')
                if isinstance(lic, dict):
                    lic = lic.get('type', 'unknown')
                return str(lic), ''
            return 'unknown', f"HTTP {resp.status}"
    except Exception as e:
        return 'unknown', str(e)


def _get_pypi_license(package_name: str) -> Tuple[str, str]:
    url = PYPI_REGISTRY_URL.format(package=urllib.request.quote(package_name, safe=''))
    try:
        req = urllib.request.Request(url, headers={'Accept': 'application/json'})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode('utf-8'))
                info = data.get('info', {})
                lic = info.get('license_expression') or info.get('license')
                if not lic or not str(lic).strip():
                    lic = 'unknown'
                return str(lic), ''
            return 'unknown', f"HTTP {resp.status}"
    except Exception as e:
        return 'unknown', str(e)


def _make_finding(pkg_name: str, ecosystem: str, license_name: str, reason: str, filename: str, line_number: int, original_code: str) -> ScanFinding:
    short_license = str(license_name)[:50]
    if len(str(license_name)) > 50:
        short_license += "..."
    return ScanFinding(
        type='license_risk',
        severity='medium',
        confidence='high',
        file=filename,
        line=line_number,
        description=f'Package "{pkg_name}" from {ecosystem} has a risky license: {short_license}. Reason: {reason}',
        original_code=original_code,
        recommendation='Replace with a package that has a permissive license (e.g. MIT, Apache-2.0).'
    )


def _log(message: str) -> None:
    print(f"[LicenseRiskAnalyzer] {message}", file=sys.stderr)
