import re
import sys
from typing import List
from models import ScanFinding
from diff_parser import DiffFile, DiffLine

WEAK_ALGO_RE = re.compile(r"""['\"](md5|sha1|des|rc4|rc2)['\"]""", re.IGNORECASE)
INSECURE_RAND_PY_RE = re.compile(r"""random\.(?:random|randint|choice|randrange|uniform)\(""")
INSECURE_RAND_JS_RE = re.compile(r"""Math\.random\(""")
HARDCODED_SECRET_RE = re.compile(r"""(?:iv|salt|key|nonce)\s*(?:=|:)\s*['"]([^'"]{4,})['\"]""", re.IGNORECASE)
ECB_MODE_RE = re.compile(r"""['"][\w-]*ecb[\w-]*['\"]""", re.IGNORECASE)

def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    findings = []
    try:
        for df in files:
            for dl in df.added_lines:
                line = dl.content.strip()
                if not line or line.startswith(('#', '//', '*')):
                    continue

                if WEAK_ALGO_RE.search(line):
                    findings.append(_make_finding(df.filename, dl.line_number, line, 'weak_crypto', 'Weak cryptographic algorithm detected (MD5, SHA1, DES, or RC4).'))

                if df.filename.endswith('.py') and INSECURE_RAND_PY_RE.search(line):
                    findings.append(_make_finding(df.filename, dl.line_number, line, 'insecure_random', "Insecure random number generator detected in Python. Use 'secrets' module."))

                if df.filename.endswith(('.js', '.ts', '.jsx', '.tsx')) and INSECURE_RAND_JS_RE.search(line):
                    findings.append(_make_finding(df.filename, dl.line_number, line, 'insecure_random', "Insecure random number generator (Math.random) detected. Use 'crypto.getRandomValues()'."))

                if HARDCODED_SECRET_RE.search(line):
                    findings.append(_make_finding(df.filename, dl.line_number, line, 'hardcoded_crypto_secret', 'Hardcoded cryptographic secret (IV, salt, or key) detected.'))

                if ECB_MODE_RE.search(line):
                    findings.append(_make_finding(df.filename, dl.line_number, line, 'insecure_crypto_mode', 'Insecure block cipher mode (ECB) detected.'))
    except Exception as e:
        print(f'[CryptoAnalyzer] error: {e}', file=sys.stderr)
    return findings

def _make_finding(file: str, line: int, code: str, type: str, desc: str) -> ScanFinding:
    return ScanFinding(
        type=type, severity='high', confidence='medium',
        file=file, line=line, description=desc, original_code=code
    )
