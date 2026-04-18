"""
Data Models for RedFlag CI Scan Engine
───────────────────────────────────────

These dataclasses mirror the TypeScript interfaces defined in
backend/src/services/scan.service.ts (ScanFinding, ScanEngineResult).

They form the CONTRACT between the Python engine and the Node.js service.
If you change a field here, you MUST update the TypeScript interface too,
or JSON parsing will silently produce incorrect results.

💡 Why dataclasses instead of plain dicts?
───────────────────────────────────────────
Python dicts are "stringly-typed" — you could write finding['sevrity']
(typo) and Python would happily create a new key instead of raising an error.
Dataclasses give us:
  - Type safety: IDE autocomplete and linting catch typos at write-time
  - Validation: We can add __post_init__ validation later
  - Serialization: The asdict() helper converts them cleanly to JSON-ready dicts

💡 What is a dataclass?
───────────────────────
A Python dataclass (from the `dataclasses` module, added in Python 3.7) is
syntactic sugar that auto-generates __init__, __repr__, and __eq__ methods
from class-level type annotations. It's Python's answer to TypeScript interfaces
but with runtime enforcement.

    @dataclass
    class Point:
        x: int
        y: int

    # Python auto-generates: __init__(self, x: int, y: int), __repr__, __eq__
"""

from dataclasses import dataclass, asdict
from typing import Optional, List


@dataclass
class ScanFinding:
    """
    A single vulnerability detected by an analyzer.
    
    Maps 1:1 to the ScanFinding interface in scan.service.ts.
    Every field here MUST exist in the TypeScript interface.
    """
    type: str           # 'credential' | 'sql_injection' | 'dependency' | 'prompt_injection'
    severity: str       # 'critical' | 'high' | 'medium' | 'low'
    confidence: str     # 'high' | 'medium' | 'low'
    file: str           # Affected file path from the diff
    line: int           # Line number within that file
    description: str    # Human-readable explanation of the vulnerability
    original_code: str  # The vulnerable code snippet

    # Optional fields — only set when applicable
    remediated_code: Optional[str] = None   # Auto-fixed version (deterministic fixes only)
    recommendation: Optional[str] = None    # Guided fix steps (for complex issues)

    def to_dict(self) -> dict:
        """
        Convert to a JSON-serializable dict, excluding None values.
        
        💡 Why exclude None?
        JSON has null, but if we send { "remediated_code": null } for every finding
        that doesn't have a fix, it bloats the payload and clutters the TypeScript
        side with unnecessary null checks. Omitting the key entirely is cleaner.
        """
        result = asdict(self)
        return {k: v for k, v in result.items() if v is not None}


@dataclass
class ScanEngineResult:
    """
    The complete output of a scan — this is what Node.js receives on stdout.

    Maps 1:1 to the ScanEngineResult interface in scan.service.ts.
    """
    findings: List[ScanFinding]
    risk_score: int                 # 0–100 normalized score
    risk_classification: str        # 'critical' | 'high' | 'medium' | 'low' | 'clean'
    summary: str                    # One-line human summary

    def to_dict(self) -> dict:
        """Convert the entire result tree to a JSON-serializable dict."""
        return {
            'findings': [f.to_dict() for f in self.findings],
            'risk_score': self.risk_score,
            'risk_classification': self.risk_classification,
            'summary': self.summary,
        }
