import re
from dataclasses import dataclass, field
from typing import List


@dataclass
class DiffLine:
    content: str
    line_number: int


@dataclass
class DiffFile:
    filename: str
    added_lines: List[DiffLine] = field(default_factory=list)

    @property
    def full_content(self) -> str:
        return '\n'.join(line.content for line in self.added_lines)


def parse_diff(raw_diff: str) -> List[DiffFile]:
    files: List[DiffFile] = []
    current_file: DiffFile | None = None
    current_line_number = 0

    for line in raw_diff.split('\n'):

        if line.startswith('+++ b/'):
            filename = line[6:]
            current_file = DiffFile(filename=filename)
            files.append(current_file)
            continue

        if line.startswith('---') or line.startswith('diff --git'):
            continue

        hunk_match = re.match(r'^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@', line)
        if hunk_match:
            current_line_number = int(hunk_match.group(1))
            continue

        if current_file is None:
            continue

        if line.startswith('+'):
            current_file.added_lines.append(DiffLine(
                content=line[1:],
                line_number=current_line_number,
            ))
            current_line_number += 1

        elif line.startswith(' ') or line == '':
            current_line_number += 1

    return files
