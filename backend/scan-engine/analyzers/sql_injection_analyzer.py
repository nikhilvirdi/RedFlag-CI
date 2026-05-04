import re
import sys
from typing import List

from models import ScanFinding
from diff_parser import DiffFile


SQL_KEYWORDS = re.compile(
    r'(?i)\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|WHERE|FROM|INTO|VALUES)\b'
)


UNSAFE_PATTERNS = [
    {
        'name': 'String Concatenation in SQL',
        'pattern': re.compile(
            r'(?i)(?:SELECT|INSERT|UPDATE|DELETE|WHERE)\s.*?\+\s*\w+'
        ),
        'severity': 'critical',
        'confidence': 'high',
        'description': (
            'SQL query built with string concatenation (+). An attacker who controls '
            'the concatenated variable can inject arbitrary SQL commands, potentially '
            'reading, modifying, or deleting all database records.'
        ),
        'recommendation': (
            'Use parameterized queries: '
            'PostgreSQL/pg: client.query("SELECT * FROM users WHERE id = $1", [userId]) | '
            'Prisma: prisma.$queryRaw`SELECT * FROM users WHERE id = ${userId}` | '
            'Python: cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))'
        ),
    },
    {
        'name': 'Python f-string SQL Query',
        'pattern': re.compile(
            r'(?i)f["\''](?:.*?)(?:SELECT|INSERT|UPDATE|DELETE|WHERE)(?:.*?)\{[^}]+\}'
        ),
        'severity': 'critical',
        'confidence': 'high',
        'description': (
            'SQL query constructed with Python f-string interpolation. '
            'The variable inside {braces} is inserted directly into the query '
            'without any escaping, creating a direct injection vector.'
        ),
        'recommendation': (
            'Replace f-string with parameterized query. '
            'Before: cursor.execute(f"SELECT * FROM users WHERE id = {user_id}") '
            'After:  cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))'
        ),
    },
    {
        'name': '.format() SQL Query',
        'pattern': re.compile(
            r'(?i)["\''](?:.*?)(?:SELECT|INSERT|UPDATE|DELETE|WHERE)(?:.*?)'
            r'(?:\{\}|\{[0-9]+\}|\{\w+\})(?:.*?)["\'']'
            r'\s*\.format\s*\('
        ),
        'severity': 'critical',
        'confidence': 'high',
        'description': (
            'SQL query built with .format() method. Variables are injected directly '
            'into the query string without sanitization.'
        ),
        'recommendation': (
            'Replace .format() with parameterized queries using your database driver\'s '
            'placeholder syntax (e.g., %s for psycopg2, ? for sqlite3).'
        ),
    },
    {
        'name': 'JavaScript Template Literal SQL',
        'pattern': re.compile(
            r'(?i)`(?:.*?)(?:SELECT|INSERT|UPDATE|DELETE|WHERE)(?:.*?)\$\{[^}]+\}'
        ),
        'severity': 'critical',
        'confidence': 'high',
        'description': (
            'SQL query built with JavaScript template literal (backticks). '
            'Variables inside ${} are interpolated directly into the query string.'
        ),
        'recommendation': (
            'Use parameterized queries. '
            'pg: client.query("SELECT * FROM users WHERE id = $1", [id]) | '
            'Prisma: use Prisma.sql tagged template instead of raw backticks | '
            'mysql2: connection.execute("SELECT * FROM users WHERE id = ?", [id])'
        ),
    },
    {
        'name': 'Python % String Formatting SQL',
        'pattern': re.compile(
            r'(?i)["\''](?:.*?)(?:SELECT|INSERT|UPDATE|DELETE|WHERE)(?:.*?)%[sd](?:.*?)["\'']'
            r'\s*%\s*'
        ),
        'severity': 'critical',
        'confidence': 'high',
        'description': (
            'SQL query built with Python % string formatting. '
            'This is the oldest and most common SQL injection pattern in Python. '
            'The %s/%d placeholders in the STRING are different from the %s '
            'placeholders in cursor.execute() — the former is vulnerable, the latter is safe.'
        ),
        'recommendation': (
            'Replace: cursor.execute("SELECT * FROM x WHERE id = %s" % id) '
            'With:    cursor.execute("SELECT * FROM x WHERE id = %s", (id,)) '
            'Note the comma after id — (id,) is a tuple, which triggers parameterization.'
        ),
    },
]


def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    findings: List[ScanFinding] = []
    try:
        for diff_file in files:
            for diff_line in diff_file.added_lines:
                line_content = diff_line.content
                stripped = line_content.strip()

                if not stripped or stripped.startswith(('#', '//', '/*', '*')):
                    continue

                if not SQL_KEYWORDS.search(line_content):
                    continue

                for pattern_def in UNSAFE_PATTERNS:
                    if pattern_def['pattern'].search(line_content):
                        findings.append(ScanFinding(
                            type='sql_injection',
                            severity=pattern_def['severity'],
                            confidence=pattern_def['confidence'],
                            file=diff_file.filename,
                            line=diff_line.line_number,
                            description=f"{pattern_def['name']}: {pattern_def['description']}",
                            original_code=stripped,
                            recommendation=pattern_def['recommendation'],
                        ))
                        break
    except Exception as e:
        print(f'[SqlInjectionAnalyzer] error: {e}', file=sys.stderr)
    return findings
