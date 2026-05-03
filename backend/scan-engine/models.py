from dataclasses import dataclass, asdict
from typing import Optional, List


@dataclass
class ScanFinding:
    type: str
    severity: str
    confidence: str
    file: str
    line: int
    description: str
    original_code: str

    remediated_code: Optional[str] = None
    recommendation: Optional[str] = None

    def to_dict(self) -> dict:
        result = asdict(self)
        return {k: v for k, v in result.items() if v is not None}


@dataclass
class ScanEngineResult:
    findings: List[ScanFinding]
    risk_score: int
    risk_classification: str
    summary: str

    def to_dict(self) -> dict:
        return {
            'findings': [f.to_dict() for f in self.findings],
            'risk_score': self.risk_score,
            'risk_classification': self.risk_classification,
            'summary': self.summary,
        }
