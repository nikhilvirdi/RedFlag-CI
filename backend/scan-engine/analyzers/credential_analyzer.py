"""
Credential Exposure Analyzer
─────────────────────────────

Detects hardcoded secrets, API keys, tokens, and passwords in code.

💡 Why is this the #1 priority analyzer?
────────────────────────────────────────
Credential exposure is consistently the most critical vulnerability in
AI-generated code. LLMs frequently produce example code with placeholder
secrets that developers forget to replace, or they embed actual API keys
from training data patterns. A single leaked AWS key can result in
thousands of dollars of unauthorized cloud charges within hours.

Detection Strategy (3 Layers):
──────────────────────────────
Layer 1 — Known Format Patterns:
    Regex for AWS, GitHub, Stripe, etc. These are highest confidence
    because the FORMAT ITSELF is proof (e.g., AKIA + 16 uppercase chars
    is ALWAYS an AWS Access Key ID).

Layer 2 — Variable Assignment Patterns:
    Suspicious variable names (password, secret, token) combined with
    string literal assignments. Medium confidence because the variable
    name alone doesn't prove the value is a real secret.

Layer 3 — Shannon Entropy Analysis:
    High-randomness strings that statistically look like secrets.
    Lowest confidence — used as a safety net to catch secrets that
    don't match known formats.

💡 What is Shannon Entropy?
───────────────────────────
Invented by Claude Shannon (the father of information theory) in 1948.
Entropy measures the "randomness" or information density of a string.

Formula: H = -Σ p(x) × log₂(p(x))  for each unique character x
Where p(x) = frequency of character x / total characters

Examples:
    "aaaaaaaaaa"    → entropy ≈ 0.0 (no randomness at all)
    "hello world"   → entropy ≈ 2.8 (normal English text)
    "aB3$kL9!mN2&"  → entropy ≈ 3.6 (some randomness — might be a password)
    "AKIAIOSFODNN7" → entropy ≈ 4.2 (high randomness — likely a key)
    "x7Kp2mN9vL4qR" → entropy ≈ 5.1 (very high — almost certainly a secret)

We use a threshold of 4.5 because API keys and tokens typically have
entropy above this, while normal code and English text stay below it.
"""

import re
import math
from typing import List

from models import ScanFinding
from diff_parser import DiffFile


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 1: Known Secret Format Patterns
# ─────────────────────────────────────────────────────────────────────────────
# Each entry has:
#   - name: Human-readable label for the finding report
#   - pattern: Compiled regex (compiled = faster than re-compiling per line)
#   - severity/confidence: Risk assessment
#   - description: What the developer needs to understand
#   - recommendation: Exactly what to do to fix it

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
            r'(?i)aws_secret_access_key\s*[=:]\s*["\']?[A-Za-z0-9/+=]{40}["\']?'
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
            r'(?:postgres|mysql|mongodb|redis)(?:ql)?://[^:\s]+:[^@\s]+@[^\s"\']+'
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


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 2: Suspicious Variable Name Patterns
# ─────────────────────────────────────────────────────────────────────────────
# Catches cases like:
#   password = "mysecretpassword123"
#   const TOKEN = "abc123xyz789"
#
# Lower confidence than Layer 1 because the variable name SUGGESTS a secret
# but the value could be a test placeholder, a display label, etc.

SUSPICIOUS_VAR_PATTERN = re.compile(
    r'(?i)'                                             # Case-insensitive
    r'(?:password|passwd|pwd|secret|token|auth'         # Common secret var names
    r'|credential|api_key|apikey|private_key)'
    r'\s*[=:]\s*'                                       # Assignment (= or :)
    r'["\'][^"\']{8,}["\']',                            # String literal, 8+ chars
)


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 3: Shannon Entropy Calculator
# ─────────────────────────────────────────────────────────────────────────────

def calculate_shannon_entropy(data: str) -> float:
    """
    Calculate the Shannon entropy of a string.

    See module docstring for the full explanation of the math.
    """
    if not data:
        return 0.0

    # Count frequency of each character
    frequency: dict[str, int] = {}
    for char in data:
        frequency[char] = frequency.get(char, 0) + 1

    length = len(data)
    entropy = 0.0

    for count in frequency.values():
        # p(x) = probability of this character appearing
        probability = count / length
        if probability > 0:
            # Shannon's formula: H -= p(x) × log₂(p(x))
            entropy -= probability * math.log2(probability)

    return entropy


# Regex to extract quoted strings for entropy analysis.
# Only checks base64-safe characters (alphanumeric + /+=_-) to avoid
# flagging normal English sentences as high-entropy.
QUOTED_STRING_PATTERN = re.compile(r'["\']([A-Za-z0-9+/=_\-]{16,})["\']')

# Minimum entropy to flag a string. 4.5 catches API keys while ignoring
# normal code identifiers and English text.
ENTROPY_THRESHOLD = 4.5

# Minimum length for entropy analysis. Short strings can have high entropy
# by chance (e.g., "aB3$" has high entropy but isn't a secret).
MIN_ENTROPY_LENGTH = 20


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ANALYZER FUNCTION
# ─────────────────────────────────────────────────────────────────────────────

def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    """
    Analyze all added lines across all diff files for credential exposure.

    Returns a list of ScanFinding objects — one per detected vulnerability.
    """
    findings: List[ScanFinding] = []

    for diff_file in files:
        # Skip binary and non-code files
        if _is_non_code_file(diff_file.filename):
            continue

        for diff_line in diff_file.added_lines:
            line_content = diff_line.content

            # Skip empty lines and comment lines
            stripped = line_content.strip()
            if not stripped or stripped.startswith(('#', '//', '/*', '*', '<!--')):
                continue

            # ── Layer 1: Known secret format matching ────────────────
            # Highest confidence — the format itself is the proof.
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
                    break  # One finding per line to avoid duplicate noise

            if layer1_matched:
                continue

            # ── Layer 2: Suspicious variable name + literal value ────
            # Medium confidence — the name suggests a secret.
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
                continue  # Skip Layer 3 if Layer 2 matched

            # ── Layer 3: Entropy-based detection ─────────────────────
            # Lowest confidence — catches secrets that don't match any pattern.
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

    return findings


def _is_non_code_file(filename: str) -> bool:
    """
    Returns True for files that should be skipped during scanning.

    Binary files (images, fonts), lock files (package-lock.json),
    and minified bundles don't contain author-written code that could
    have exploitable vulnerabilities.
    """
    skip_extensions = {
        '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
        '.woff', '.woff2', '.ttf', '.eot',
        '.lock', '.map', '.min.js', '.min.css',
        '.pyc', '.pyo', '.class', '.o', '.so', '.dll',
    }
    return any(filename.endswith(ext) for ext in skip_extensions)
