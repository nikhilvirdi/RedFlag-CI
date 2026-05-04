import re
import sys
from typing import List
from diff_parser import DiffFile
from models import ScanFinding

def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    findings = []
    patterns = [
        (r'todo.*auth', 'Disabled Authentication (TODO)', 'high', 'high', 'Detected a TODO comment indicating authentication is missing or disabled.'),
        (r'cors\(\s*[\'"]\*[\'"]\s*\)', 'Wildcard CORS Configuration', 'high', 'high', 'Detected wildcard CORS configuration allowing all origins.'),
        (r'Access-Control-Allow-Origin:\s*\*', 'Wildcard CORS Header', 'high', 'high', 'Detected wildcard CORS header allowing all origins.'),
        (r'debug\s*=\s*True', 'Debug Mode Enabled', 'critical', 'high', 'Detected hardcoded debug=True. This exposes sensitive internal application state.'),
        (r'DEBUG\s*=\s*True', 'Debug Mode Enabled', 'critical', 'high', 'Detected hardcoded DEBUG = True. This exposes sensitive internal application state.'),
        (r'@csrf_exempt', 'Disabled CSRF Protection', 'high', 'high', 'Detected @csrf_exempt decorator, disabling Cross-Site Request Forgery protection.'),
        (r'verify\s*=\s*False', 'Disabled TLS Verification', 'high', 'high', 'Detected verify=False in network request, disabling TLS certificate validation.'),
        (r'app\.listen\(.*[\'"]0\.0\.0\.0[\'"]', 'Insecure Bind Address', 'medium', 'medium', 'Detected binding to 0.0.0.0 which exposes the service to all network interfaces.'),
    ]
    try:
        for file in files:
            for line in file.added_lines:
                for pattern, issue_type, severity, confidence, description in patterns:
                    if re.search(pattern, line.content, re.IGNORECASE):
                        findings.append(ScanFinding(
                            type=issue_type,
                            severity=severity,
                            confidence=confidence,
                            file=file.filename,
                            line=line.line_number,
                            description=description,
                            original_code=line.content.strip(),
                        ))
    except Exception as e:
        print(f'[AiFingerprintAnalyzer] error: {e}', file=sys.stderr)
    return findings
