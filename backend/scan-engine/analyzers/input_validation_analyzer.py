import re
from typing import List
from models import DiffFile, ScanFinding

def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    findings = []
    
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
    
    for file in files:
        if file.binary:
            continue
            
        added_lines_content = "\n".join([line.content for line in file.added_lines])
        
        for sink_type, sink_patterns in sinks.items():
            for sink_pattern in sink_patterns:
                for line in file.added_lines:
                    if re.search(sink_pattern, line.content):
                        has_source = any(re.search(src, line.content) for src in sources)
                        
                        if not has_source:
                            for other_line in file.added_lines:
                                if any(re.search(src, other_line.content) for src in sources):
                                    source_var_match = re.search(r'(const|let|var|([a-zA-Z0-9_]+))\s*=\s*.*req\.', other_line.content)
                                    if source_var_match:
                                        var_name = source_var_match.group(2)
                                        if var_name and re.search(rf'\b{var_name}\b', line.content):
                                            has_source = True
                                            break
                        
                        if has_source:
                            is_sanitized = any(re.search(san, line.content) for san in sanitizers)
                            
                            if not is_sanitized:
                                findings.append(ScanFinding(
                                    file_path=file.path,
                                    line_number=line.number,
                                    column_number=1,
                                    rule_id='input-validation-gap',
                                    severity='high',
                                    description=f'Potential {sink_type} due to unvalidated user input passing into a sensitive sink.',
                                    recommendation=f'Validate and sanitize all user-controlled input before passing it to {sink_pattern}. Use type-safe APIs, parameterized queries, or dedicated validation libraries (Joi, Zod, Marshmallow).',
                                    context=line.content.strip()
                                ))
                                
    return findings
