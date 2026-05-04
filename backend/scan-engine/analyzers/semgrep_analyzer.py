import sys
import json
import subprocess
import os
from typing import List
from diff_parser import DiffFile
from models import ScanFinding

def log(message: str) -> None:
    print(f"[SemgrepAnalyzer] {message}", file=sys.stderr)

def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    findings = []
    
    if not files:
        return findings

    filenames = [f.filename for f in files if os.path.exists(f.filename)]
    
    if not filenames:
        log("No changed files exist on disk to scan.")
        return findings

    try:
        cmd = ["semgrep", "scan", "--json", "-q"] + filenames
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        
        if result.stdout:
            try:
                data = json.loads(result.stdout)
                
                for result_item in data.get("results", []):
                    path = result_item.get("path")
                    start_line = result_item.get("start", {}).get("line", 0)
                    extra = result_item.get("extra", {})
                    severity = extra.get("severity", "WARNING").lower()
                    
                    if severity == "error":
                        mapped_severity = "high"
                    elif severity == "warning":
                        mapped_severity = "medium"
                    else:
                        mapped_severity = "low"
                        
                    findings.append(ScanFinding(
                        type="Semgrep SAST",
                        severity=mapped_severity,
                        confidence="confidence_high",
                        file=path,
                        line=start_line,
                        description=extra.get("message", "Semgrep finding"),
                        original_code=extra.get("lines", "").strip()
                    ))
            except json.JSONDecodeError:
                log("Failed to parse Semgrep JSON output.")
                
    except FileNotFoundError:
        log("Semgrep is not installed or not in PATH.")
    except Exception as e:
        log(f"Unexpected error running Semgrep: {str(e)}")
        
    return findings
