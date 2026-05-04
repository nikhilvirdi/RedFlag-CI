import re
import ast
import sys
from typing import List, Set, Dict, Tuple
from models import ScanFinding
from diff_parser import DiffFile, DiffLine

JS_IMPORT_RE = re.compile(
    r"""(?:import\s+(?:type\s+)?(?:([\w*{},\s]+)\s+from\s+|)|require\s*\(\s*)['"]"""
    r"""((?:@[^'"./][^'"]*\/)?[^'"./][^'"]*?)['"]"""
)
JS_EXPORT_RE = re.compile(r"""export\s+(?:const|function|class|let|var|type|interface|enum)\s+([a-zA-Z_]\w*)""")
PY_IMPORT_RE = re.compile(r"""^(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_]*)""")
PY_EXPORT_RE = re.compile(r"""^(?:def|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)""")
PKG_JSON_RE = re.compile(r""""((?:@[^"./][^"]*\/)?[^"@./][^"]*?)"\s*:\s*"[^"]*\d[^"]*\"""")
REQUIREMENTS_RE = re.compile(r"""^([a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?)(?:[=<>!~;\s]|$)""")

PYTHON_STDLIB = {
    'abc', 'argparse', 'array', 'ast', 'asyncio', 'base64', 'binascii', 'bisect', 'builtins', 'bz2', 'calendar', 'collections',
    'concurrent', 'configparser', 'contextlib', 'copy', 'csv', 'ctypes', 'dataclasses', 'datetime', 'decimal', 'difflib', 'dis',
    'email', 'enum', 'errno', 'fcntl', 'filecmp', 'fnmatch', 'fractions', 'functools', 'gc', 'getopt', 'getpass', 'glob', 'gzip',
    'hashlib', 'heapq', 'hmac', 'html', 'http', 'importlib', 'inspect', 'io', 'ipaddress', 'itertools', 'json', 'logging', 'math',
    'mimetypes', 'multiprocessing', 'netrc', 'numbers', 'operator', 'os', 'pathlib', 'pdb', 'pickle', 'platform', 'pprint', 'profile',
    'pstats', 'random', 're', 'resource', 'runpy', 'sched', 'secrets', 'select', 'selectors', 'shlex', 'shutil', 'signal', 'site',
    'socket', 'sqlite3', 'ssl', 'stat', 'statistics', 'string', 'struct', 'subprocess', 'sys', 'tempfile', 'textwrap', 'threading',
    'time', 'traceback', 'types', 'typing', 'unittest', 'urllib', 'uuid', 'warnings', 'weakref', 'xml', 'zipfile', 'zlib'
}

NODE_BUILTINS = {
    'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants', 'crypto', 'dgram', 'dns', 'domain',
    'events', 'fs', 'http', 'http2', 'https', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode',
    'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'timers', 'tls', 'tty', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib'
}

def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    findings = []
    try:
        all_imports = set()
        all_content = "\n".join(f.full_content for f in files)

        manifest_deps = {}

        for df in files:
            if df.filename.endswith('package.json'):
                for line in df.added_lines:
                    for pkg in PKG_JSON_RE.findall(line.content):
                        normalized = _normalize_js_pkg(pkg)
                        if normalized: manifest_deps[normalized] = (df.filename, line.line_number, line.content.strip())
            elif 'requirements' in df.filename and df.filename.endswith('.txt'):
                for line in df.added_lines:
                    match = REQUIREMENTS_RE.match(line.content.strip())
                    if match:
                        normalized = _normalize_py_pkg(match.group(1))
                        if normalized: manifest_deps[normalized] = (df.filename, line.line_number, line.content.strip())

        for df in files:
            if df.filename.endswith(('.js', '.ts', '.jsx', '.tsx')):
                imports_in_file = []
                for line in df.added_lines:
                    for match in JS_IMPORT_RE.findall(line.content):
                        symbols, pkg = match
                        norm_pkg = _normalize_js_pkg(pkg)
                        if norm_pkg: all_imports.add(norm_pkg)
                        if symbols:
                            for s in re.split(r'[,{}\s\*]+', symbols):
                                if s and s not in ('as', 'from', 'type', 'interface', 'enum'):
                                    imports_in_file.append((s, line.line_number, line.content.strip()))

                clean_content = _strip_comments_js(df.full_content)
                for sym, lno, code in imports_in_file:
                    if not re.search(r'\b' + re.escape(sym) + r'\b', clean_content.replace(code, '', 1)):
                        findings.append(ScanFinding(
                            type='dead_code', severity='low', confidence='high',
                            file=df.filename, line=lno, description=f"Imported symbol '{sym}' is never used in this file.",
                            original_code=code
                        ))

            elif df.filename.endswith('.py'):
                try:
                    tree = ast.parse(df.full_content)
                    imported_names = {}
                    for node in ast.walk(tree):
                        if isinstance(node, ast.Import):
                            for n in node.names:
                                imported_names[n.asname or n.name] = (node.lineno, n.name)
                                all_imports.add(n.name.split('.')[0])
                        elif isinstance(node, ast.ImportFrom):
                            if node.module: all_imports.add(node.module.split('.')[0])
                            for n in node.names:
                                imported_names[n.asname or n.name] = (node.lineno, n.name)

                    used_names = set()
                    for node in ast.walk(tree):
                        if isinstance(node, ast.Name): used_names.add(node.id)
                        elif isinstance(node, ast.Attribute): used_names.add(node.attr)

                    for name, (lineno, orig) in imported_names.items():
                        if name not in used_names:
                            findings.append(ScanFinding(
                                type='dead_code', severity='low', confidence='high',
                                file=df.filename, line=lineno, description=f"Imported name '{name}' is never used in this file.",
                                original_code=f"import {orig}"
                            ))
                except: pass

        for df in files:
            exports = []
            if df.filename.endswith(('.js', '.ts', '.jsx', '.tsx')):
                for line in df.added_lines:
                    match = JS_EXPORT_RE.search(line.content)
                    if match: exports.append((match.group(1), line.line_number, line.content.strip()))
            elif df.filename.endswith('.py'):
                for line in df.added_lines:
                    match = PY_EXPORT_RE.search(line.content)
                    if match: exports.append((match.group(1), line.line_number, line.content.strip()))

            for exp, lno, code in exports:
                if not re.search(r'\b' + re.escape(exp) + r'\b', all_content.replace(code, '', 1)):
                    findings.append(ScanFinding(
                        type='dead_code', severity='low', confidence='medium',
                        file=df.filename, line=lno, description=f"Exported symbol '{exp}' is never called or referenced in the current diff.",
                        original_code=code
                    ))

        for pkg, (fname, lno, code) in manifest_deps.items():
            if pkg not in all_imports:
                findings.append(ScanFinding(
                    type='ghost_dependency', severity='medium', confidence='medium',
                    file=fname, line=lno, description=f"Dependency '{pkg}' is declared but never imported in the changed files.",
                    original_code=code
                ))
    except Exception as e:
        print(f'[DeadCodeAnalyzer] error: {e}', file=sys.stderr)
    return findings

def _normalize_js_pkg(raw: str) -> str:
    pkg = raw.strip().replace('node:', '')
    if not pkg or pkg.startswith(('.', '/')): return ''
    root = pkg.split('/')[0]
    if root in NODE_BUILTINS or root == '@types': return ''
    return pkg

def _normalize_py_pkg(raw: str) -> str:
    pkg = raw.strip()
    if not pkg or pkg.startswith('_') or pkg in PYTHON_STDLIB: return ''
    return pkg

def _strip_comments_js(content: str) -> str:
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    content = re.sub(r'//.*', '', content)
    return content

def _log(msg: str) -> None:
    print(f"[DeadCodeAnalyzer] {msg}", file=sys.stderr)
