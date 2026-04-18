"""
RedFlag CI — Security Analyzers Package
───────────────────────────────────────

Each analyzer is a standalone module responsible for detecting one category
of vulnerability. They all follow the same interface:

    def analyze(files: List[DiffFile]) -> List[ScanFinding]

💡 Why a uniform interface?
───────────────────────────
This is the "Strategy Pattern" from software design. Every analyzer has the
same input (list of parsed diff files) and the same output (list of findings).
This means:

  1. main.py can loop through ALL analyzers with a single for-loop
  2. Adding a new analyzer = creating one .py file + adding one line in main.py
  3. Each analyzer can be tested in complete isolation
  4. We could run them in parallel with concurrent.futures (future optimization)

Analyzers in this package:
  - credential_analyzer     → Hardcoded secrets, API keys, tokens
  - sql_injection_analyzer  → Unsafe database query construction
  - dependency_analyzer     → Typosquatted or suspicious packages
  - prompt_injection_analyzer → User input injected into LLM prompts
"""
