"""
SQL Injection Analyzer
──────────────────────

Detects unsafe database query construction patterns that may lead to
SQL injection attacks.

💡 What is SQL Injection?
─────────────────────────
SQL injection is consistently ranked #1 in the OWASP Top 10 (the industry
standard list of most critical web application security risks). It occurs
when user-controlled input is inserted DIRECTLY into a SQL query string
without parameterization.

Vulnerable code:
    query = f"SELECT * FROM users WHERE id = {user_input}"
    # If user_input = "1; DROP TABLE users; --"
    # The query becomes: SELECT * FROM users WHERE id = 1; DROP TABLE users; --
    # → The entire users table is deleted.

Safe code (parameterized):
    cursor.execute("SELECT * FROM users WHERE id = %s", (user_input,))
    # The database driver treats user_input as DATA, never as SQL commands.
    # Even if user_input contains SQL, it's treated as a literal string value.

💡 Why is AI-generated code especially vulnerable?
──────────────────────────────────────────────────
LLMs learn from millions of code examples, including tutorials and Stack Overflow
answers that use string concatenation for simplicity. When generating code,
the model often follows these patterns rather than the safer parameterized approach,
especially when writing "quick examples" or prototypes.

Detection Patterns:
───────────────────
1. String concatenation:   "SELECT * FROM users WHERE id = " + userId
2. Python f-strings:       f"SELECT * FROM users WHERE id = {user_id}"
3. .format() method:       "SELECT ... WHERE id = {}".format(user_id)
4. JS template literals:   `SELECT * FROM users WHERE id = ${userId}`
5. Python % formatting:    "SELECT ... WHERE id = %s" % user_id
"""

import re
from typing import List

from models import ScanFinding
from diff_parser import DiffFile


# ─────────────────────────────────────────────────────────────────────────────
# SQL KEYWORD GATE
# ─────────────────────────────────────────────────────────────────────────────
# Performance optimization: we first check if a line even contains SQL-like
# keywords before running expensive regex patterns. This eliminates ~95% of
# lines from further processing.
#
# 💡 Why \b (word boundary)?
# Without \b, "SELECTED" or "UPDATED_AT" would match. Word boundaries ensure
# we only match the exact SQL keywords as standalone words.

SQL_KEYWORDS = re.compile(
    r'(?i)\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|WHERE|FROM|INTO|VALUES)\b'
)


# ─────────────────────────────────────────────────────────────────────────────
# UNSAFE QUERY CONSTRUCTION PATTERNS
# ─────────────────────────────────────────────────────────────────────────────
# Each pattern targets a specific string interpolation technique used to
# unsafely build SQL queries.

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
            r'(?i)f["\'](?:.*?)(?:SELECT|INSERT|UPDATE|DELETE|WHERE)(?:.*?)\{[^}]+\}'
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
            r'(?i)["\'](?:.*?)(?:SELECT|INSERT|UPDATE|DELETE|WHERE)(?:.*?)'
            r'(?:\{\}|\{[0-9]+\}|\{\w+\})(?:.*?)["\']'
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
            r'(?i)["\'](?:.*?)(?:SELECT|INSERT|UPDATE|DELETE|WHERE)(?:.*?)%[sd](?:.*?)["\']'
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
    """
    Analyze all added lines for SQL injection vulnerabilities.

    Returns a list of ScanFinding objects for each detected pattern.
    """
    findings: List[ScanFinding] = []

    for diff_file in files:
        for diff_line in diff_file.added_lines:
            line_content = diff_line.content
            stripped = line_content.strip()

            # Skip empty lines and comments
            if not stripped or stripped.startswith(('#', '//', '/*', '*')):
                continue

            # Performance gate: skip lines that don't contain SQL keywords
            if not SQL_KEYWORDS.search(line_content):
                continue

            # Check each unsafe pattern
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
                    break  # One finding per line — avoid duplicate noise

    return findings
