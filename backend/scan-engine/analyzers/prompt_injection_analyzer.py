import re
from typing import List

from models import ScanFinding
from diff_parser import DiffFile


LLM_API_PATTERNS = [
    re.compile(r'(?:openai|client)\.(?:chat\.completions|completions)\.create'),
    re.compile(r'ChatCompletion\.create'),
    re.compile(r'(?:anthropic|client)\.messages\.create'),
    re.compile(r'(?:anthropic|client)\.completions\.create'),
    re.compile(r'\.generate\s*\('),
    re.compile(r'\.predict\s*\('),
    re.compile(r'(?:LLMChain|ChatOpenAI|ChatAnthropic|PromptTemplate)\s*\('),
    re.compile(r'(?:genai|model)\.generate_content\s*\('),
]


UNSAFE_PROMPT_PATTERNS = [
    {
        'name': 'f-string Prompt Injection',
        'pattern': re.compile(
            r'f["\''](?:.*?)'
            r'(?:prompt|message|instruction|system|content|role)(?:.*?)'
            r'\{(?:user|input|query|request|body|params|data|message|text|question)'
        ),
        'severity': 'high',
        'confidence': 'medium',
        'description': (
            'User-controlled variable directly interpolated into an LLM prompt '
            'via Python f-string. An attacker could override system instructions '
            'by injecting prompt manipulation text.'
        ),
    },
    {
        'name': 'Template Literal Prompt Injection',
        'pattern': re.compile(
            r'`(?:.*?)'
            r'(?:prompt|message|instruction|system|content)(?:.*?)'
            r'\$\{(?:.*?)'
            r'(?:user|input|query|request|body|params|req\.)'
        ),
        'severity': 'high',
        'confidence': 'medium',
        'description': (
            'User-controlled variable interpolated into an LLM prompt via '
            'JavaScript template literal. The ${} syntax inserts the value directly '
            'without any sanitization.'
        ),
    },
    {
        'name': 'Concatenated Prompt Construction',
        'pattern': re.compile(
            r'(?:prompt|message|system|content)\s*'
            r'(?:=|\+=)\s*.*?\+\s*'
            r'(?:user|input|query|request|body|params|req\.)'
        ),
        'severity': 'high',
        'confidence': 'medium',
        'description': (
            'User-controlled input concatenated into an LLM prompt string '
            'using the + operator. This allows an attacker to inject arbitrary '
            'instructions into the prompt.'
        ),
    },
    {
        'name': '.format() Prompt Injection',
        'pattern': re.compile(
            r'(?:prompt|message|system|content)(?:.*?)'
            r'\.format\s*\((?:.*?)'
            r'(?:user|input|query|request|body)'
        ),
        'severity': 'high',
        'confidence': 'medium',
        'description': (
            'User input inserted into an LLM prompt via .format() method '
            'without sanitization. The {} placeholders are replaced with '
            'raw user input, enabling prompt override attacks.'
        ),
    },
]

RECOMMENDATION = (
    'Mitigate prompt injection using these techniques: '
    '(1) Use the "system" and "user" message roles to separate instructions from input — '
    'e.g., messages=[{"role": "system", "content": "..."}, {"role": "user", "content": user_input}]. '
    '(2) Validate and sanitize user input (length limits, character filtering). '
    '(3) Never concatenate user input directly into system prompts. '
    '(4) Implement output validation to detect prompt leakage. '
    '(5) Consider using a prompt firewall or guardrails library.'
)


def analyze(files: List[DiffFile]) -> List[ScanFinding]:
    findings: List[ScanFinding] = []

    for diff_file in files:
        file_has_llm_usage = any(
            pattern.search(diff_file.full_content)
            for pattern in LLM_API_PATTERNS
        )

        for diff_line in diff_file.added_lines:
            line_content = diff_line.content
            stripped = line_content.strip()

            if not stripped or stripped.startswith(('#', '//', '/*', '*')):
                continue

            for pattern_def in UNSAFE_PROMPT_PATTERNS:
                if pattern_def['pattern'].search(line_content):
                    confidence = 'high' if file_has_llm_usage else pattern_def['confidence']

                    findings.append(ScanFinding(
                        type='prompt_injection',
                        severity=pattern_def['severity'],
                        confidence=confidence,
                        file=diff_file.filename,
                        line=diff_line.line_number,
                        description=(
                            f"{pattern_def['name']}: {pattern_def['description']}"
                        ),
                        original_code=stripped,
                        recommendation=RECOMMENDATION,
                    ))
                    break

    return findings
