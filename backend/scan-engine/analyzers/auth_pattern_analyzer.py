import re
from typing import List
from models import ScanFinding
from diff_parser import DiffFile, DiffLine

EXPRESS_ROUTE_RE = re.compile(r"""(?:app|router|route)\.(?:get|post|put|delete|patch|all)\s*\(\s*['"].*?['"]\s*,(.*)\)""", re.DOTALL)
HARDCODED_ROLE_RE = re.compile(r"""(?:\.role|\.permissions?|\.group|['"]role['"]|['"]permissions?['"])\s*(?:===|==|!=|!==|includes)\s*['"](\w+)['"]""", re.IGNORECASE)
INSECURE_HASH_RE = re.compile(r"""(?:createHash|hashlib\.)\s*\(\s*['"](md5|sha1)['"]""", re.IGNORECASE)
JWT_EXPIRE_RE = re.compile(r"""jwt\.sign\s*\(\s*[^)]+?,\s*[^)]+?,\s*\{([^}]*)\}""", re.DOTALL)
COOKIE_RE = re.compile(r"""res\.cookie\s*\(\s*[^,]+?,\s*[^,]+?,\s*\{([^}]*)\}""", re.DOTALL)
BYPASS_RE = re.compile(r"""(?:TODO|FIXME|BYPASS|SKIP|DISABLE|REMOVE|TEMP).*?(?:auth|login|perm|session|guard|check|role|admin|pwd|password|secret)""", re.IGNORECASE)

AUTH_KEYWORDS = {'auth', 'authenticate', 'authorize', 'checkrole', 'isauthed', 'guard', 'protected', 'required'}

def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    findings = []
    for df in files:
        for dl in df.added_lines:
            line = dl.content.strip()
            if not line or line.startswith(('#', '//', '*')): continue

            route_match = EXPRESS_ROUTE_RE.search(line)
            if route_match:
                args = route_match.group(1).split(',')
                if len(args) < 2:
                    findings.append(_make_finding(df.filename, dl.line_number, line, "auth_gap", "Express route seems to be missing authentication middleware."))
                else:
                    found_auth = False
                    for arg in args[:-1]:
                        arg_clean = arg.strip().lower()
                        if any(kw in arg_clean for kw in AUTH_KEYWORDS):
                            found_auth = True
                            break
                    if not found_auth:
                        findings.append(_make_finding(df.filename, dl.line_number, line, "auth_gap", "Express route defined without recognizable authentication/authorization middleware."))

            if HARDCODED_ROLE_RE.search(line):
                findings.append(_make_finding(df.filename, dl.line_number, line, "hardcoded_role", "Hardcoded role check detected. Use a centralized RBAC/ABAC policy engine or constants."))

            if INSECURE_HASH_RE.search(line):
                findings.append(_make_finding(df.filename, dl.line_number, line, "weak_crypto", "Insecure hashing algorithm (MD5/SHA1) detected. Use SHA-256 or better for security-sensitive operations."))

            jwt_match = JWT_EXPIRE_RE.search(line)
            if jwt_match:
                if 'expiresIn' not in jwt_match.group(1):
                    findings.append(_make_finding(df.filename, dl.line_number, line, "jwt_security", "JWT signed without an expiration check (expiresIn). This can lead to indefinite session validity."))

            cookie_match = COOKIE_RE.search(line)
            if cookie_match:
                options = cookie_match.group(1)
                if 'httpOnly: true' not in options:
                    findings.append(_make_finding(df.filename, dl.line_number, line, "insecure_cookie", "Cookie set without httpOnly: true. This makes the cookie accessible to client-side scripts (XSS risk)."))
                if 'secure: true' not in options:
                    findings.append(_make_finding(df.filename, dl.line_number, line, "insecure_cookie", "Cookie set without secure: true. The cookie will be transmitted over unencrypted connections."))

            if BYPASS_RE.search(line):
                findings.append(_make_finding(df.filename, dl.line_number, line, "auth_bypass", "Authentication bypass marker (TODO/FIXME/BYPASS) detected in security-sensitive code."))

    return findings

def _make_finding(file: str, line: int, code: str, type: str, desc: str) -> ScanFinding:
    severity = 'medium'
    if type in ('auth_gap', 'auth_bypass'): severity = 'high'
    return ScanFinding(
        type=type, severity=severity, confidence='medium',
        file=file, line=line, description=desc, original_code=code
    )
