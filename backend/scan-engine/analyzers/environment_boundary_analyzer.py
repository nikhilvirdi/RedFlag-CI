import re
from typing import List
from models import ScanFinding
from diff_parser import DiffFile


ENV_VAR_FALLBACK_NODE = re.compile(r'process\.env\.[A-Z0-9_]+\s*(?:\|\||??)\s*["\']([^"\']+)["\']')
ENV_VAR_FALLBACK_PY = re.compile(r'os\.environ\.get\(\s*["\'][A-Z0-9_]+["\']\s*,\s*["\']([^"\']+)["\']\s*\)')
ASSIGNMENT_TO_LITERAL = re.compile(r'(?i)([a-z0-9_]*(?:password|secret|key|token|auth|credential|api)[a-z0-9_]*)\s*[=:]\s*["\']([^"\']+)["\']')
PROD_IDENTIFIER = re.compile(r'(?i)(prod|production|staging|live)')
CONFIG_STYLE_VAR = re.compile(r'^([A-Z0-9_]{4,})\s*=\s*["\']([^"\']+)["\']')


def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    findings = []
    for diff_file in files:
        filename = diff_file.filename
        if _is_non_code_file(filename):
            continue
        for diff_line in diff_file.added_lines:
            line_content = diff_line.content
            stripped = line_content.strip()
            if not stripped or stripped.startswith(('#', '//', '/*', '*', '<!--')):
                continue
            
            node_match = ENV_VAR_FALLBACK_NODE.search(line_content)
            if node_match:
                val = node_match.group(1)
                if val and len(val) > 1 and val.lower() not in ('development', 'dev', 'local', 'test'):
                    findings.append(ScanFinding(
                        type='environment_boundary',
                        severity='medium',
                        confidence='high',
                        file=filename,
                        line=diff_line.line_number,
                        description=f'Environment variable with hardcoded fallback literal: "{val}". Fallbacks in code can bypass environment configurations and lead to inconsistent behavior across stages.',
                        original_code=stripped,
                        recommendation='Remove hardcoded fallbacks for sensitive configuration. Use environment variables exclusively.'
                    ))

            py_match = ENV_VAR_FALLBACK_PY.search(line_content)
            if py_match:
                val = py_match.group(1)
                if val and len(val) > 1 and val.lower() not in ('development', 'dev', 'local', 'test'):
                    findings.append(ScanFinding(
                        type='environment_boundary',
                        severity='medium',
                        confidence='high',
                        file=filename,
                        line=diff_line.line_number,
                        description=f'Python environment lookup with hardcoded fallback literal: "{val}".',
                        original_code=stripped,
                        recommendation='Remove hardcoded default values for environment-sensitive variables.'
                    ))

            assign_match = ASSIGNMENT_TO_LITERAL.search(line_content)
            if assign_match:
                var_name = assign_match.group(1)
                val = assign_match.group(2)
                if PROD_IDENTIFIER.search(var_name) or PROD_IDENTIFIER.search(val):
                    findings.append(ScanFinding(
                        type='environment_boundary',
                        severity='high',
                        confidence='medium',
                        file=filename,
                        line=diff_line.line_number,
                        description=f'Potential hardcoded production credential or config crossing boundary: variable "{var_name}" assigned value starting with "{val[:10]}".',
                        original_code=stripped,
                        recommendation='Move production configuration to environment variables or a secrets manager.'
                    ))

            config_match = CONFIG_STYLE_VAR.search(stripped)
            if config_match:
                var_name = config_match.group(1)
                val = config_match.group(2)
                if len(val) > 2 and var_name not in ('VERSION', 'NAME', 'AUTHOR'):
                     if any(k in var_name.lower() for k in ('url', 'host', 'port', 'db', 'redis', 'api')):
                        findings.append(ScanFinding(
                            type='environment_boundary',
                            severity='low',
                            confidence='low',
                            file=filename,
                            line=diff_line.line_number,
                            description=f'Hardcoded configuration variable "{var_name}" detected. Configuration should ideally reside in .env files rather than source code.',
                            original_code=stripped,
                            recommendation='Move this configuration value to a .env file and access it via environment variables.'
                        ))
    return findings


def _is_non_code_file(filename: str) -> bool:
    skip = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.lock', '.pyc', '.o'}
    return any(filename.endswith(ext) for ext in skip)
