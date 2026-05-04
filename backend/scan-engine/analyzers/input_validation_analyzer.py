import re
import sys
from typing import List
from models import ScanFinding
from diff_parser import DiffFile

def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    findings = []
    try:
        sources = [
            r'req\.(body|query|params|headers|cookies)',
            r'request\.(form|args|json|files|values)',
            r'sys\.argv',
            r'input\(',
            r'window\.location',
            r'document\.(URL|referrer|cookie)',
            r'process\.env'
        ]

        sinks = {
            'SQL Injection': [
                r'\.query\(.*[\+\%]',
                r'\.execute\(.*[\+\%]',
                r'cursor\.execute\(.*\%',
                r'db\.find\(.*\$where'
            ],
            'Path Traversal': [
                r'fs\.(read|write|append|unlink|mkdir)File(Sync)?\(',
                r'open\(',
                r'send_from_directory\(',
                r'send_file\('
            ],
            'Command Injection': [
                r'os\.system\(',
                r'subprocess\.(run|call|Popen|check_output)\(',
                r'child_process\.(exec|spawn)\(',
                r'eval\(',
                r'exec\('
            ],
            'Cross-Site Scripting (XSS)': [
                r'\.innerHTML\s*=',
                r'dangerouslySetInnerHTML',
                r'res\.write\(',
                r'res\.send\('
            ],
            'Server-Side Request Forgery (SSRF)': [
                r'fetch\(',
                r'axios\.(get|post|put|delete)\(',
                r'request\.(get|post)\(',
                r'urllib\.request\.urlopen\('
            ]
        }

        sanitizers = [
            r'parseInt\(',
            r'Number\(',
            r'validator\.',
            r'DOMPurify\.',
            r'z\.parse',
            r'Joi\.',
            r'yup\.',
            r'escape\(',
            r'encodeURIComponent\(',
            r'bleach\.clean',
            r'html\.escape'
        ]

        for df in files:
            for sink_type, sink_patterns in sinks.items():
                for sink_pattern in sink_patterns:
                    for dl in df.added_lines:
                        if re.search(sink_pattern, dl.content):
                            has_source = any(re.search(src, dl.content) for src in sources)

                            if not has_source:
                                for other in df.added_lines:
                                    if any(re.search(src, other.content) for src in sources):
                                        source_var_match = re.search(r'(const|let|var|([a-zA-Z0-9_]+))\s*=\s*.*req\.', other.content)
                                        if source_var_match:
                                            var_name = source_var_match.group(2)
                                            if var_name and re.search(rf'\b{var_name}\b', dl.content):
                                                has_source = True
                                                break

                            if has_source:
                                is_sanitized = any(re.search(san, dl.content) for san in sanitizers)
                                if not is_sanitized:
                                    findings.append(ScanFinding(
                                        type='input_validation_gap',
                                        severity='high',
                                        confidence='medium',
                                        file=df.filename,
                                        line=dl.line_number,
                                        description=f'Potential {sink_type} due to unvalidated user input passing into a sensitive sink.',
                                        original_code=dl.content.strip(),
                                        recommendation=f'Validate and sanitize all user-controlled input before passing it to {sink_pattern}. Use type-safe APIs, parameterized queries, or dedicated validation libraries (Joi, Zod, Marshmallow).'
                                    ))
    except Exception as e:
        print(f'[InputValidationAnalyzer] error: {e}', file=sys.stderr)
    return findings
