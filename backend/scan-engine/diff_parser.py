"""
Unified Diff Parser
───────────────────

Parses the unified diff format returned by GitHub's PR diff API into
structured data that analyzers can work with.

💡 What is a unified diff?
──────────────────────────
A unified diff is a standard text format invented by GNU for `diff -u`.
It shows exactly which lines were added (+), removed (-), and unchanged ( )
between two versions of files.

Example:
    diff --git a/app.py b/app.py
    --- a/app.py
    +++ b/app.py
    @@ -10,6 +10,8 @@ def connect():
         normal_line()
    +    added_line()
    -    removed_line()

Key anatomy:
    'diff --git a/X b/X'  → File boundary marker
    '--- a/X'             → The "before" version (old file)
    '+++ b/X'             → The "after" version (new file)
    '@@ -old,count +new,count @@' → "Hunk header": where this chunk starts
    '+line'               → Line ADDED in the new version
    '-line'               → Line REMOVED from the old version
    ' line'               → Context line (unchanged, shown for reference)

💡 Why we only analyze ADDED lines:
────────────────────────────────────
1. Removed lines are no longer in the codebase — scanning them is wasteful.
2. The PR author is responsible only for new code they introduce.
3. It dramatically reduces false positives from pre-existing issues.
"""

import re
from dataclasses import dataclass, field
from typing import List


@dataclass
class DiffLine:
    """A single added line from the diff, with its file context."""
    content: str        # The actual line of code ('+' prefix already stripped)
    line_number: int    # Line number in the NEW version of the file


@dataclass
class DiffFile:
    """
    Represents all added lines from a single file in the diff.

    💡 Why store added_lines as a list of DiffLine instead of raw strings?
    Because analyzers need both the CODE and the LINE NUMBER to generate
    meaningful findings. GitHub PR comments reference specific lines —
    without line numbers, we'd have no way to point the developer to
    exactly where the vulnerability is.
    """
    filename: str
    added_lines: List[DiffLine] = field(default_factory=list)

    @property
    def full_content(self) -> str:
        """
        Returns all added lines joined together — useful for multi-line
        pattern matching (e.g., detecting a function that spans multiple lines).
        """
        return '\n'.join(line.content for line in self.added_lines)


def parse_diff(raw_diff: str) -> List[DiffFile]:
    """
    Parse a unified diff string into structured DiffFile objects.

    Algorithm:
    ──────────
    1. Iterate line-by-line through the raw diff text.
    2. When we hit a '+++ b/...' line, we know a new file section begins.
    3. When we hit a '@@ ... @@' hunk header, we extract the NEW file
       starting line number (the number after '+').
    4. For each subsequent line:
       - '+' prefix → this is an ADDED line. Capture it and increment line counter.
       - ' ' prefix → this is a CONTEXT line. Just increment the line counter.
       - '-' prefix → this is a REMOVED line. Do NOT increment the new-file
         line counter (these lines don't exist in the new version).
    """
    files: List[DiffFile] = []
    current_file: DiffFile | None = None
    current_line_number = 0

    for line in raw_diff.split('\n'):

        # ── File boundary ────────────────────────────────────────────
        # '+++ b/path/to/file.py' → this is the "after" version header.
        # The 'b/' prefix is git's convention for the "new" side.
        if line.startswith('+++ b/'):
            filename = line[6:]  # Strip the '+++ b/' prefix
            current_file = DiffFile(filename=filename)
            files.append(current_file)
            continue

        # Skip the '--- a/...' header (old version) and diff boundary markers
        if line.startswith('---') or line.startswith('diff --git'):
            continue

        # ── Hunk header ──────────────────────────────────────────────
        # Format: @@ -old_start,old_count +new_start,new_count @@
        # We need new_start to know where added lines BEGIN in the file.
        #
        # 💡 Why (?:,\d+)? is optional:
        # Git omits the count when a hunk is exactly 1 line long.
        # '@@ -1 +1 @@' is valid (both old and new sections are 1 line).
        hunk_match = re.match(r'^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@', line)
        if hunk_match:
            current_line_number = int(hunk_match.group(1))
            continue

        if current_file is None:
            continue

        # ── Added line (+) ───────────────────────────────────────────
        # This line exists in the NEW version of the file. We capture it.
        if line.startswith('+'):
            current_file.added_lines.append(DiffLine(
                content=line[1:],       # Strip the '+' prefix
                line_number=current_line_number,
            ))
            current_line_number += 1

        # ── Context line (space prefix or empty) ─────────────────────
        # Context lines are unchanged. They still increment the line counter
        # because they occupy line numbers in the new file — if we skip them,
        # all subsequent line numbers would be wrong.
        elif line.startswith(' ') or line == '':
            current_line_number += 1

        # ── Removed line (-) ─────────────────────────────────────────
        # Removed lines do NOT increment the new-file line counter because
        # they don't exist in the new version. They only existed in the old.
        # We skip them entirely — nothing to analyze.

    return files
