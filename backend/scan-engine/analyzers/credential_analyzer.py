import re
import math
import sys
from typing import List

from models import ScanFinding
from diff_parser import DiffFile


KNOWN_SECRET_PATTERNS = [
    {
        'name': 'AWS Access Key ID',
        'pattern': re.compile(r'AKIA[0-9A-Z]{16}'),
        'severity': 'critical',
        'confidence': 'high',
        'description': (
            'AWS Access Key ID detected. This key format (AKIA + 16 chars) is unique '
            'to AWS. If leaked, an attacker gains full access to your AWS account — '
            'they can spin up expensive EC2 instances, access S3 data, or delete resources.'
        ),
        'recommendation': (
            'Rotate this key immediately in the AWS IAM console. '
            'Use environment variables (process.env.AWS_ACCESS_KEY_ID) or '
            'AWS Secrets Manager instead of hardcoding.'
        ),
    },
    {
        'name': 'AWS Secret Access Key',
        'pattern': re.compile(
            r'(?i)aws_secret_access_key\s*[=:]\s*["\'']?[A-Za-z0-9/+=]{40}["\'']?'
        ),
        'severity': 'critical',
        'confidence': 'high',
        'description': 'AWS Secret Access Key detected in source code.',
        'recommendation': (
            'Rotate this key immediately via AWS IAM. '
            'Store secrets in environment variables or a secrets manager.'
        ),
    },
    {
        'name': 'GitHub Personal Access Token',
        'pattern': re.compile(r'ghp_[A-Za-z0-9]{36}'),
        'severity': 'critical',
        'confidence': 'high',
        'description': (
            'GitHub Personal Access Token (ghp_) detected. '
            'Grants full repository access — an attacker could push malicious code, '
            'delete branches, or access private repositories.'
        ),
        'recommendation': (
            'Revoke this token at github.com/settings/tokens and generate a new one '
            'with minimal scopes. Use GITHUB_TOKEN environment variable.'
        ),
    },
    {
        'name': 'GitHub OAuth / App Token',
        'pattern': re.compile(r'(?:gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{30,}'),
        'severity': 'critical',
        'confidence': 'high',
        'description': 'GitHub OAuth, App, or Fine-Grained Token detected in source code.',
        'recommendation': (
            'Revoke and regenerate this token immediately. '
            'Use environment variables for all GitHub credentials.'
        ),
    },
    {
        'name': 'Stripe Secret Key',
        'pattern': re.compile(r'sk_live_[A-Za-z0-9]{24,}'),
        'severity': 'critical',
        'confidence': 'high',
        'description': (
            'Stripe LIVE secret key detected. This grants full access to payment '
            'processing — an attacker could issue refunds, access customer data, '
            'or create fraudulent charges.'
        ),
        'recommendation': (
            'Rotate this key in the Stripe dashboard immediately. '
            'Use STRIPE_SECRET_KEY environment variable. Never commit live keys.'
        ),
    },
    {
        'name': 'Stripe Publishable Key (Live)',
        'pattern': re.compile(r'pk_live_[A-Za-z0-9]{24,}'),
        'severity': 'medium',
        'confidence': 'high',
        'description': (
            'Stripe live publishable key in source code. While less sensitive than '
            'secret keys, it should still be in environment config for consistency.'
        ),
        'recommendation': 'Move to an environment variable for environment-specific configuration.',
    },
    {
        'name': 'Private Cryptographic Key',
        'pattern': re.compile(r'-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'),
        'severity': 'critical',
        'confidence': 'high',
        'description': (
            'Private cryptographic key embedded in source code. '
            'This could be used for authentication, signing, or decryption — '
            'leaking it compromises the entire trust chain.'
        ),
        'recommendation': (
            'Remove immediately. Store private keys in a secure vault, '
            'as protected environment variables, or in mounted secrets volumes.'
        ),
    },
    {
        'name': 'JSON Web Token',
        'pattern': re.compile(
            r'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
        ),
        'severity': 'high',
        'confidence': 'medium',
        'description': (
            'Hardcoded JSON Web Token (JWT) detected. JWTs contain encoded claims '
            '(user identity, permissions) and may grant unauthorized access if '
            'reused or exposed.'
        ),
        'recommendation': (
            'Remove hardcoded JWT. Tokens should be generated at runtime '
            'and stored securely in HTTP-only cookies or secure storage.'
        ),
    },
    {
        'name': 'Generic API Key Assignment',
        'pattern': re.compile(
            r'(?i)(?:api[_-]?key|apikey|api[_-]?secret)\s*[=:]\s*["\'][A-Za-z0-9_\-]{16,}["\']'
        ),
        'severity': 'high',
        'confidence': 'medium',
        'description': 'Hardcoded API key detected via variable assignment pattern.',
        'recommendation': (
            'Replace with process.env.API_KEY (Node.js) or '
            'os.environ["API_KEY"] (Python). Never hardcode API keys.'
        ),
    },
    {
        'name': 'Database Connection String with Password',
        'pattern': re.compile(
            r'(?:postgres|mysql|mongodb|redis)(?:ql)?://[^:\s]+:[^@\s]+@[^\s"\'']+'
        ),
        'severity': 'critical',
        'confidence': 'high',
        'description': (
            'Database connection string with embedded credentials detected. '
            'This exposes the database host, username, AND password in one string.'
        ),
        'recommendation': (
            'Use DATABASE_URL environment variable. '
            'Example: process.env.DATABASE_URL or os.environ["DATABASE_URL"].'
        ),
    },
]


SUSPICIOUS_VAR_PATTERN = re.compile(
    r'(?i)'
    r'(?:password|passwd|pwd|secret|token|auth'
    r'|credential|api_key|apikey|private_key)'
    r'\s*[=:]\s*'
    r'["\'][^"\']{8,}["\']',
)


def calculate_shannon_entropy(data: str) -> float:
    if not data:
        return 0.0

    frequency: dict[str, int] = {}
    for char in data:
        frequency[char] = frequency.get(char, 0) + 1

    length = len(data)
    entropy = 0.0

    for count in frequency.values():
        probability = count / length
        if probability > 0:
            entropy -= probability * math.log2(probability)

    return entropy


QUOTED_STRING_PATTERN = re.compile(r'["\']([A-Za-z0-9+/=_\-]{16,})["\']')

ENTROPY_THRESHOLD = 4.5

MIN_ENTROPY_LENGTH = 20


def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    findings: List[ScanFinding] = []
    try:
        for diff_file in files:
            if _is_non_code_file(diff_file.filename):
                continue

            for diff_line in diff_file.added_lines:
                line_content = diff_line.content

                stripped = line_content.strip()
                if not stripped or stripped.startswith(('#', '//', '/*', '*', '<!--')):
                    continue

                layer1_matched = False
                for secret_pattern in KNOWN_SECRET_PATTERNS:
                    if secret_pattern['pattern'].search(line_content):
                        findings.append(ScanFinding(
                            type='credential',
                            severity=secret_pattern['severity'],
                            confidence=secret_pattern['confidence'],
                            file=diff_file.filename,
                            line=diff_line.line_number,
                            description=f"{secret_pattern['name']}: {secret_pattern['description']}",
                            original_code=stripped,
                            recommendation=secret_pattern.get('recommendation'),
                        ))
                        layer1_matched = True
                        break

                if layer1_matched:
                    continue

                if SUSPICIOUS_VAR_PATTERN.search(line_content):
                    findings.append(ScanFinding(
                        type='credential',
                        severity='high',
                        confidence='medium',
                        file=diff_file.filename,
                        line=diff_line.line_number,
                        description=(
                            'Potential hardcoded credential detected. A variable with a '
                            'security-sensitive name is assigned a string literal value.'
                        ),
                        original_code=stripped,
                        recommendation=(
                            'Replace with an environment variable lookup. '
                            'Node.js: process.env.SECRET_NAME | '
                            'Python: os.environ["SECRET_NAME"]'
                        ),
                    ))
                    continue

                for string_match in QUOTED_STRING_PATTERN.finditer(line_content):
                    value = string_match.group(1)
                    if len(value) < MIN_ENTROPY_LENGTH:
                        continue

                    entropy = calculate_shannon_entropy(value)
                    if entropy >= ENTROPY_THRESHOLD:
                        findings.append(ScanFinding(
                            type='credential',
                            severity='medium',
                            confidence='low',
                            file=diff_file.filename,
                            line=diff_line.line_number,
                            description=(
                                f'High-entropy string detected (entropy: {entropy:.2f}). '
                                f'Strings with entropy above {ENTROPY_THRESHOLD} often indicate '
                                f'secrets, tokens, or encoded credentials.'
                            ),
                            original_code=stripped,
                            recommendation=(
                                'Verify whether this string is a secret. If so, move it '
                                'to environment variables or a secrets manager.'
                            ),
                        ))
    except Exception as e:
        print(f'[CredentialAnalyzer] error: {e}', file=sys.stderr)
    return findings


def _is_non_code_file(filename: str) -> bool:
    skip_extensions = {
        '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
        '.woff', '.woff2', '.ttf', '.eot',
        '.lock', '.map', '.min.js', '.min.css',
        '.pyc', '.pyo', '.class', '.o', '.so', '.dll',
    }
    return any(filename.endswith(ext) for ext in skip_extensions)
