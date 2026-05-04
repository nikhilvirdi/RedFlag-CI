import re
import sys
from typing import List
from models import ScanFinding
from diff_parser import DiffFile

def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    findings = []
    try:
        patterns = [
            (r'(?<!await\s)\b[a-zA-Z0-9_]+\.then\(', 'medium', 'Potential unhandled promise rejection or missing await before then().', 'Always await promises or use .catch() to handle rejections.'),
            (r'(?<!await\s)\b(fetch|axios|request|fs\.promises)\.', 'medium', 'Missing await on an asynchronous API call.', 'Ensure asynchronous calls are awaited to prevent floating promises and race conditions.'),
            (r'async\s+function\s+\w+\s*\(.*\)\s*\{[^\}]*(?<!await\s)\b\w+Async\(', 'high', 'Detected an async function call without await inside an async block.', 'All async functions should be awaited or explicitly handled.'),
            (r'asyncio\.(sleep|wait|gather|create_task)\(', 'medium', 'Missing await on asyncio utility.', 'Asyncio functions must be awaited to execute correctly in the event loop.'),
            (r'(?<!await\s)asyncio\.run\(', 'low', 'asyncio.run() should typically be the entry point and is often misused in library code.', 'Ensure asyncio.run() is only used as a top-level entry point.'),
            (r'\.catch\(\s*\)', 'low', 'Empty catch block detected for a promise.', 'Handle rejections properly; do not use empty catch blocks which swallow errors.'),
            (r'(const|let|var)\s+\w+\s*=\s*\w+Async\(', 'medium', 'Variable assigned to a promise without await.', 'If the variable is intended to be the result, add await. If it is the promise itself, ensure it is handled later.')
        ]

        for df in files:
            for dl in df.added_lines:
                for pattern, severity, desc, rec in patterns:
                    if re.search(pattern, dl.content):
                        findings.append(ScanFinding(
                            type='async_concurrency',
                            severity=severity,
                            confidence='medium',
                            file=df.filename,
                            line=dl.line_number,
                            description=desc,
                            original_code=dl.content.strip(),
                            recommendation=rec
                        ))
    except Exception as e:
        print(f'[AsyncConcurrencyAnalyzer] error: {e}', file=sys.stderr)
    return findings
