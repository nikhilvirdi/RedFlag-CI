import sys
import json
import subprocess
import os
from typing import List
from diff_parser import DiffFile
from models import ScanFinding


def log(message: str) -> None:
    print(f"[TruffleHogAnalyzer] {message}", file=sys.stderr)


def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    findings = []
    
    try:
        cmd = ["trufflehog", "filesystem", ".", "--json"]
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        
        if result.stdout:
            for line in result.stdout.strip().split('\n'):
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                    source_meta = data.get("SourceMetadata", {}).get("Filesystem", {})
                    file_path = source_meta.get("file", "unknown")
                    line_num = source_meta.get("line", 0)
                    detector = data.get("DetectorName", "Unknown")
                    
                    findings.append(ScanFinding(
                        type="TruffleHog Secret",
                        severity="high",
                        confidence="confidence_high",
                        file=file_path,
                        line=line_num,
                        description=f"Secret detected by {detector} detector.",
                        original_code=data.get("Raw", "").strip()
                    ))
                except json.JSONDecodeError:
                    continue
                    
    except FileNotFoundError:
        log("TruffleHog is not installed or not in PATH.")
    except Exception as e:
        log(f"Unexpected error running TruffleHog: {str(e)}")
        
    return findings
