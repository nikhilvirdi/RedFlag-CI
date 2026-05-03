import re
import sys
import time
import urllib.request
import urllib.error
from typing import List, Set, Dict, Tuple

from models import ScanFinding
from diff_parser import DiffFile


NPM_REGISTRY_URL = "https://registry.npmjs.org/{package}"
PYPI_REGISTRY_URL = "https://pypi.org/pypi/{package}/json"

REQUEST_TIMEOUT_SECONDS = 5


JS_IMPORT_RE = re.compile(
    r"""(?:import\s+(?:type\s+)?(?:[\w*{},\s]+\s+from\s+|)|require\s*\(\s*)['"]"""
    r"""((?:@[^'"./][^'"]*\/)?[^'"./][^'"]*?)['"]"""
)

PY_IMPORT_RE = re.compile(
    r"""^(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_]*)"""
)

PKG_JSON_RE = re.compile(
    r""""((?:@[^"./][^"]*\/)?[^"@./][^"]*?)"\s*:\s*"[^"]*\d[^"]*\""""
)

REQUIREMENTS_RE = re.compile(
    r"""^([a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?)(?:[=<>!~;\s]|$)"""
)


PYTHON_STDLIB: Set[str] = {
    'abc', 'aifc', 'argparse', 'array', 'ast', 'asynchat', 'asyncio',
    'asyncore', 'atexit', 'audioop', 'base64', 'bdb', 'binascii',
    'binhex', 'bisect', 'builtins', 'bz2', 'calendar', 'cgi', 'cgitb',
    'chunk', 'cmath', 'cmd', 'code', 'codecs', 'codeop', 'collections',
    'colorsys', 'compileall', 'concurrent', 'configparser', 'contextlib',
    'contextvars', 'copy', 'copyreg', 'cProfile', 'csv', 'ctypes',
    'curses', 'dataclasses', 'datetime', 'dbm', 'decimal', 'difflib',
    'dis', 'doctest', 'email', 'encodings', 'enum', 'errno', 'faulthandler',
    'fcntl', 'filecmp', 'fileinput', 'fnmatch', 'fractions', 'ftplib',
    'functools', 'gc', 'getopt', 'getpass', 'gettext', 'glob', 'grp',
    'gzip', 'hashlib', 'heapq', 'hmac', 'html', 'http', 'idlelib',
    'imaplib', 'importlib', 'inspect', 'io', 'ipaddress', 'itertools',
    'json', 'keyword', 'lib2to3', 'linecache', 'locale', 'logging',
    'lzma', 'mailbox', 'mailcap', 'marshal', 'math', 'mimetypes',
    'mmap', 'modulefinder', 'multiprocessing', 'netrc', 'nis', 'nntplib',
    'numbers', 'operator', 'optparse', 'os', 'ossaudiodev', 'pathlib',
    'pdb', 'pickle', 'pickletools', 'pipes', 'pkgutil', 'platform',
    'plistlib', 'poplib', 'posix', 'posixpath', 'pprint', 'profile',
    'pstats', 'pty', 'pwd', 'py_compile', 'pyclbr', 'pydoc', 'queue',
    'quopri', 'random', 're', 'readline', 'reprlib', 'resource', 'rlcompleter',
    'runpy', 'sched', 'secrets', 'select', 'selectors', 'shelve', 'shlex',
    'shutil', 'signal', 'site', 'smtpd', 'smtplib', 'sndhdr', 'socket',
    'socketserver', 'spwd', 'sqlite3', 'sre_compile', 'sre_constants',
    'sre_parse', 'ssl', 'stat', 'statistics', 'string', 'stringprep',
    'struct', 'subprocess', 'sunau', 'symtable', 'sys', 'sysconfig',
    'syslog', 'tabnanny', 'tarfile', 'telnetlib', 'tempfile', 'termios',
    'test', 'textwrap', 'threading', 'time', 'timeit', 'tkinter', 'token',
    'tokenize', 'tomllib', 'trace', 'traceback', 'tracemalloc', 'tty',
    'turtle', 'turtledemo', 'types', 'typing', 'unicodedata', 'unittest',
    'urllib', 'uu', 'uuid', 'venv', 'warnings', 'wave', 'weakref',
    'webbrowser', 'winreg', 'winsound', 'wsgiref', 'xdrlib', 'xml',
    'xmlrpc', 'zipapp', 'zipfile', 'zipimport', 'zlib', 'zoneinfo',
    '__future__', '_thread', 'antigravity', 'cPickle', 'cStringIO',
}

NODE_BUILTINS: Set[str] = {
    'assert', 'async_hooks', 'buffer', 'child_process', 'cluster',
    'console', 'constants', 'crypto', 'dgram', 'diagnostics_channel',
    'dns', 'domain', 'events', 'fs', 'http', 'http2', 'https', 'inspector',
    'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode',
    'querystring', 'readline', 'repl', 'stream', 'string_decoder',
    'timers', 'tls', 'trace_events', 'tty', 'url', 'util', 'v8', 'vm',
    'wasi', 'worker_threads', 'zlib',
}

TRUSTED_SCOPES: Set[str] = {'@types', '@aws-sdk', '@google-cloud', '@angular'}


def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    findings: List[ScanFinding] = []

    npm_candidates:  Dict[str, Tuple[str, int, str]] = {}
    pypi_candidates: Dict[str, Tuple[str, int, str]] = {}

    for diff_file in files:
        filename = diff_file.filename

        for diff_line in diff_file.added_lines:
            line = diff_line.content
            stripped = line.strip()

            if not stripped or stripped.startswith('#') or stripped.startswith('//'):
                continue

            if filename.endswith(('.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs')):
                for pkg in JS_IMPORT_RE.findall(line):
                    pkg = _normalize_js_package(pkg)
                    if pkg and pkg not in npm_candidates:
                        npm_candidates[pkg] = (filename, diff_line.line_number, stripped)

            elif filename.endswith('package.json'):
                for pkg in PKG_JSON_RE.findall(line):
                    pkg = _normalize_js_package(pkg)
                    if pkg and pkg not in npm_candidates:
                        npm_candidates[pkg] = (filename, diff_line.line_number, stripped)

            elif filename.endswith('.py'):
                match = PY_IMPORT_RE.match(stripped)
                if match:
                    pkg = _normalize_py_package(match.group(1))
                    if pkg and pkg not in pypi_candidates:
                        pypi_candidates[pkg] = (filename, diff_line.line_number, stripped)

            elif 'requirements' in filename and filename.endswith('.txt'):
                match = REQUIREMENTS_RE.match(stripped)
                if match:
                    pkg = _normalize_py_package(match.group(1))
                    if pkg and pkg not in pypi_candidates:
                        pypi_candidates[pkg] = (filename, diff_line.line_number, stripped)

    _log(f"Verifying {len(npm_candidates)} npm package(s) and {len(pypi_candidates)} PyPI package(s)...")

    for pkg_name, (filename, line_number, original_code) in npm_candidates.items():
        exists, err = _check_npm(pkg_name)
        if err:
            _log(f"npm check skipped for '{pkg_name}': {err}")
            continue
        if not exists:
            findings.append(_make_finding(
                pkg_name=pkg_name,
                ecosystem='npm',
                filename=filename,
                line_number=line_number,
                original_code=original_code,
            ))

    for pkg_name, (filename, line_number, original_code) in pypi_candidates.items():
        exists, err = _check_pypi(pkg_name)
        if err:
            _log(f"PyPI check skipped for '{pkg_name}': {err}")
            continue
        if not exists:
            findings.append(_make_finding(
                pkg_name=pkg_name,
                ecosystem='PyPI',
                filename=filename,
                line_number=line_number,
                original_code=original_code,
            ))

    return findings


def _check_npm(package_name: str) -> Tuple[bool, str]:
    url = NPM_REGISTRY_URL.format(package=urllib.request.quote(package_name, safe='@/'))
    try:
        req = urllib.request.Request(url, headers={'Accept': 'application/json'})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
            if resp.status == 200:
                return True, ''
            return True, f"Unexpected HTTP {resp.status}"
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False, ''
        return True, f"HTTP {e.code}"
    except urllib.error.URLError as e:
        return True, f"Network error: {e.reason}"
    except Exception as e:
        return True, f"Unexpected error: {e}"


def _check_pypi(package_name: str) -> Tuple[bool, str]:
    url = PYPI_REGISTRY_URL.format(package=urllib.request.quote(package_name, safe=''))
    try:
        req = urllib.request.Request(url, headers={'Accept': 'application/json'})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
            if resp.status == 200:
                return True, ''
            return True, f"Unexpected HTTP {resp.status}"
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False, ''
        return True, f"HTTP {e.code}"
    except urllib.error.URLError as e:
        return True, f"Network error: {e.reason}"
    except Exception as e:
        return True, f"Unexpected error: {e}"


def _normalize_js_package(raw: str) -> str:
    pkg = raw.strip()
    if not pkg:
        return ''

    if pkg.startswith('node:'):
        return ''

    if pkg.startswith('.') or pkg.startswith('/'):
        return ''

    root = pkg.split('/')[0]
    if root in NODE_BUILTINS:
        return ''

    for scope in TRUSTED_SCOPES:
        if pkg.startswith(scope + '/'):
            return ''

    return pkg


def _normalize_py_package(raw: str) -> str:
    pkg = raw.strip()
    if not pkg:
        return ''
    if pkg.startswith('_'):
        return ''
    if pkg in PYTHON_STDLIB:
        return ''
    return pkg


def _make_finding(
    pkg_name: str,
    ecosystem: str,
    filename: str,
    line_number: int,
    original_code: str,
) -> ScanFinding:
    registry_url = (
        f"https://www.npmjs.com/package/{pkg_name}"
        if ecosystem == 'npm'
        else f"https://pypi.org/project/{pkg_name}/"
    )
    return ScanFinding(
        type='dependency',
        severity='high',
        confidence='high',
        file=filename,
        line=line_number,
        description=(
            f'Package "{pkg_name}" does not exist on {ecosystem}. '
            f'This package may have been hallucinated by an AI code generator. '
            f'Installing a non-existent package name carries the risk of '
            f'"dependency confusion" — if an attacker registers this name on '
            f'{ecosystem}, your next install will pull down arbitrary malicious code.'
        ),
        original_code=original_code,
        recommendation=(
            f'Verify this package exists: {registry_url}\n'
            f'If it does not exist, remove it and find the correct package name. '
            f'Check the official documentation for the library you intended to use. '
            f'Never install a package that you cannot verify exists and is maintained.'
        ),
    )


def _log(message: str) -> None:
    print(f"[HallucinatedPackageAnalyzer] {message}", file=sys.stderr)
