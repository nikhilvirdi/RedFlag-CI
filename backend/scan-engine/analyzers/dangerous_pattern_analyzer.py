import re
from typing import List
from models import DiffFile, ScanFinding

def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    findings = []
    
    patterns = [
        (r'eval\(', 'high', 'Use of eval() is extremely dangerous as it executes arbitrary code.', 'Avoid eval(). Use JSON.parse() for JSON data or safely access object properties.'),
        (r'\bexec\(', 'high', 'Use of exec() can lead to arbitrary code execution.', 'Avoid exec(). Use safer alternatives like subprocess.run() with arguments list in Python or specific APIs in Node.js.'),
        (r'pickle\.loads\(', 'critical', 'Insecure deserialization with pickle can lead to RCE.', 'Use safer formats like JSON or verify the source of the pickled data.'),
        (r'shell\s*=\s*True', 'high', 'Executing subprocesses with shell=True is vulnerable to command injection.', 'Set shell=False and pass arguments as a list.'),
        (r'child_process\.exec\(', 'high', 'child_process.exec spawns a shell and is vulnerable to command injection.', 'Use child_process.execFile or child_process.spawn which do not spawn a shell by default.'),
        (r'__import__\(', 'medium', 'Dynamic module loading with __import__ can be abused to load malicious code.', 'Use explicit imports or importlib with strict validation of the module name.'),
        (r'setTimeout\(\s*[\'"`]', 'medium', 'Passing a string to setTimeout leads to eval-like execution.', 'Pass a function reference instead of a string to setTimeout.'),
        (r'\w+\[\w+\]\s*=\s*\w+', 'medium', 'Potential prototype pollution pattern detected.', 'Ensure the key is validated against a whitelist (e.g., check for "__proto__", "constructor", "prototype") before assignment.')
    ]
    
    for file in files:
        if file.binary:
            continue
            
        for line in file.added_lines:
            for pattern, severity, desc, rec in patterns:
                if re.search(pattern, line.content):
                    if pattern == r'\w+\[\w+\]\s*=\s*\w+':
                        if not any(x in line.content for x in ['__proto__', 'constructor', 'prototype']):
                            if not re.search(r'req\.|params|query|body', line.content):
                                continue
                                
                    findings.append(ScanFinding(
                        file_path=file.path,
                        line_number=line.number,
                        column_number=1,
                        rule_id='dangerous-pattern',
                        severity=severity,
                        description=desc,
                        recommendation=rec,
                        context=line.content.strip()
                    ))
                    
    return findings
