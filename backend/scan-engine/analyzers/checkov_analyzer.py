import sys
import json
import subprocess
import os
from typing import List
from diff_parser import DiffFile
from models import ScanFinding

def log(message: str) -> None:
    print(f"[CheckovAnalyzer] {message}", file=sys.stderr)

def is_iac_file(filename: str) -> bool:
    lower_name = filename.lower()
    if 'dockerfile' in lower_name:
        return True
    if lower_name.endswith(('.tf', '.tfvars')):
        return True
    if lower_name.endswith('docker-compose.yml') or lower_name.endswith('docker-compose.yaml'):
        return True
    
    path_parts = lower_name.split('/')
    if any(part in ['k8s', 'infra', 'terraform'] for part in path_parts):
        return True
        
    return False

def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    findings = []
    
    if not files:
        return findings

    iac_files = [f.filename for f in files if is_iac_file(f.filename) and os.path.exists(f.filename)]
    
    if not iac_files:
        return findings

    cmd = ["checkov", "-o", "json"]
    for f in iac_files:
        cmd.extend(["-f", f])
        
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        
        if not result.stdout.strip():
            return findings
            
        try:
            data = json.loads(result.stdout)
            
            reports = data if isinstance(data, list) else [data]
            
            for report in reports:
                results = report.get("results", {})
                failed_checks = results.get("failed_checks", [])
                
                for check in failed_checks:
                    path = check.get("file_path", "").lstrip("/")
                    line_range = check.get("file_line_range", [0, 0])
                    start_line = line_range[0] if line_range else 0
                    
                    findings.append(ScanFinding(
                        type="Checkov IaC",
                        severity="high",
                        confidence="high",
                        file=path,
                        line=start_line,
                        description=f"{check.get('check_id')}: {check.get('check_name')}",
                        original_code=""
                    ))
        except json.JSONDecodeError:
            log("Failed to parse Checkov JSON output.")
            
    except FileNotFoundError:
        log("Checkov is not installed or not in PATH.")
    except Exception as e:
        log(f"Unexpected error running Checkov: {str(e)}")
        
    return findings
