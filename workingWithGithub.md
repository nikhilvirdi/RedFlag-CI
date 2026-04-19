# Version Control with Git & GitHub: A Complete Guide

---

## Part 1: Version Control Fundamentals

### Why Version Control Exists

Imagine you're writing a critical piece of software. Without version control, you might end up with folders like this:

```
project_final/
project_final_v2/
project_final_ACTUALLY_FINAL/
project_final_use_this_one/
```

This is a disaster waiting to happen. Version control solves this by tracking every change to your codebase over time, who made it, when, and why.

**The core problems version control solves:**

- **History** — Roll back to any previous state of your project
- **Collaboration** — Multiple developers work simultaneously without overwriting each other
- **Accountability** — Every change is attributed to an author
- **Experimentation** — Try risky changes on a branch; discard or merge as needed
- **Recovery** — A bug introduced three weeks ago? Find exactly which commit broke things

---

### Centralized vs Distributed VCS

**Centralized VCS (e.g., SVN, CVS)**

```
        ┌─────────────────┐
        │  Central Server │  ← Single source of truth
        │  (full history) │
        └────────┬────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
┌───▼───┐   ┌───▼───┐   ┌───▼───┐
│ Dev A │   │ Dev B │   │ Dev C │
│(copy) │   │(copy) │   │(copy) │
└───────┘   └───────┘   └───────┘
```

- Developers only have a working copy, not the full history
- Server goes down → nobody can commit or see history
- Every operation (commit, log, diff) requires network access

**Distributed VCS (Git)**

```
┌──────────────────┐
│  Remote (GitHub) │  ← Shared reference point
└────────┬─────────┘
         │
    ┌────┴─────┐
    │          │
┌───▼────┐ ┌──▼─────┐
│ Dev A  │ │ Dev B  │
│(FULL   │ │(FULL   │
│history)│ │history)│
└────────┘ └────────┘
```

- Every developer has the **complete repository**, including full history
- Work offline completely — commit, branch, diff, log all work locally
- The "remote" is just a convention, not an architectural requirement
- If GitHub goes down, your full history is safe locally

---

### Git's Snapshot-Based Model

Most older systems store changes as **deltas** (diffs between versions):

```
File v1:  "Hello World"
Delta 1:  Replace "World" with "Git"      → "Hello Git"
Delta 2:  Append "!"                      → "Hello Git!"
```

Git stores **snapshots** of the entire project at each commit:

```
Commit 1: [file_a: "v1", file_b: "v1", file_c: "v1"]
Commit 2: [file_a: "v2", file_b: "v1", file_c: "v1"]
               ↑ changed      ↑ same        ↑ same
                              (pointer to same blob)
```

Unchanged files aren't duplicated — Git stores a pointer to the previous identical blob. This makes Git extremely fast because you don't need to replay a chain of diffs to reconstruct any version.

---

### Repository Structure: The Three Areas

This is the single most important mental model in Git. Every file lives in one of three places:

```
┌─────────────────────────────────────────────────────────┐
│                    Your Computer                        │
│                                                         │
│  ┌───────────────┐  git add  ┌──────────────────────┐  │
│  │ Working       │ ────────► │ Staging Area (Index)  │  │
│  │ Directory     │           │                       │  │
│  │               │ ◄──────── │ "What will go into    │  │
│  │ (what you see │ git       │  the next commit"     │  │
│  │  and edit)    │ restore   │                       │  │
│  └───────────────┘           └──────────┬────────────┘  │
│                                         │ git commit    │
│                                         ▼               │
│                              ┌──────────────────────┐   │
│                              │ Commit History (.git) │   │
│                              │                       │   │
│                              │ c3 → c2 → c1         │   │
│                              │ (permanent snapshots) │   │
│                              └──────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

- **Working Directory** — The actual files you see and edit in your folder
- **Staging Area (Index)** — A preparation zone; you decide exactly what goes into the next commit
- **Commit History** — The permanent, immutable record of all snapshots

The staging area is what makes Git powerful. You can edit 10 files but commit only 3 of them logically related to a single feature, keeping your history clean and meaningful.

---

## Part 2: Core Git Operations — Local Workflow

### Repository Setup

**`git init` — Create a new repository**

```bash
mkdir my-project
cd my-project
git init
```

```
Initialized empty Git repository in /my-project/.git/
```

This creates a hidden `.git/` directory — the entire repository lives here:

```
.git/
├── HEAD          ← Points to current branch
├── config        ← Repo-level configuration
├── objects/      ← All file content (blobs, trees, commits)
└── refs/         ← Branch and tag pointers
```

**Real-life scenario:** You're starting a new Django web app for your company. You `git init` in your project folder before writing a single line of code. Good habit — capture history from day one.

---

**`git clone` — Copy an existing repository**

```bash
git clone https://github.com/org/project.git
git clone https://github.com/org/project.git my-folder-name   # custom name
git clone --depth 1 https://github.com/org/project.git        # shallow clone (latest snapshot only)
```

Clone does more than copy files — it:

1. Downloads the full commit history
2. Sets up a remote called `origin` pointing to the source URL
3. Creates a local branch tracking the remote's default branch

**Real-life scenario:** You join a team mid-project. Your tech lead gives you the GitHub URL. You clone it, and within seconds you have the full project history, all branches, and every commit message explaining why decisions were made.

---

### File Lifecycle

A file in a Git project exists in one of these states:

```
Untracked ──── git add ────► Staged
                                │
                           git commit
                                │
                                ▼
Tracked/Unmodified ◄──────── Committed
        │
    (you edit it)
        │
        ▼
  Tracked/Modified ──── git add ────► Staged again
```

- **Untracked** — Git sees the file but has never been told to manage it
- **Tracked/Unmodified** — In the last commit, unchanged since
- **Tracked/Modified** — Changed since the last commit, not yet staged
- **Staged** — Marked to go into the next commit

`.gitignore` controls what stays permanently untracked:

```gitignore
# .gitignore example
__pycache__/
*.pyc
.env
node_modules/
.DS_Store
dist/
```

Any file matching these patterns will never show up as "untracked" — Git ignores them entirely.

---

### Core Commands

**`git status` — Your constant companion**

```bash
git status
```

```
On branch main
Changes to be committed:          ← Staged (green)
  (use "git restore --staged <file>..." to unstage)
        modified:   auth/login.py

Changes not staged for commit:    ← Modified, not staged (red)
  (use "git add <file>..." to update what will be committed)
        modified:   README.md

Untracked files:                  ← New files Git doesn't know about
  (use "git add <file>..." to include in what will be committed)
        tests/test_auth.py
```

Run this constantly. It tells you exactly where everything stands.

```bash
git status -s    # Short format — compact overview
```

```
M  auth/login.py     ← MM means modified in both staging and working dir
 M README.md         ← space then M = modified in working dir only
?? tests/test_auth.py
```

---

**`git add` — Move changes to staging**

```bash
git add auth/login.py          # Stage a specific file
git add src/                   # Stage an entire directory
git add *.js                   # Stage by pattern
git add .                      # Stage everything in current dir (use carefully)
git add -p                     # Interactive: stage specific chunks/hunks within a file
```

The `-p` (patch) flag is powerful. Say you edited one file to fix a bug AND add a new feature. You can stage only the bug fix lines for one commit, then stage the feature lines separately:

```bash
git add -p auth/login.py
```

```
@@ -45,6 +45,10 @@ def login(user, password):
+    # Bug fix: handle None password
+    if password is None:
+        return False
+
Stage this hunk [y,n,q,a,d,s,?]? y    ← Accept this chunk

@@ -67,6 +71,8 @@ def logout():
+    # New feature: log logout events
+    audit_log.record('logout', user)
Stage this hunk [y,n,q,a,d,s,?]? n    ← Skip this for now
```

---

**`git commit` — Permanently record a snapshot**

```bash
git commit -m "Fix null password crash in login handler"
git commit                     # Opens editor for multi-line message
git commit -am "message"       # Stage all tracked modified files + commit (skips git add)
git commit --amend             # Modify the most recent commit (message or content)
```

**Writing good commit messages — the most underrated skill in Git:**

```
Bad:  "fix stuff"
Bad:  "wip"
Bad:  "asdfgh"

Good: "Fix null password crash in login handler"
Good: "Add OAuth2 support for Google login"

Great (multi-line):
feat: add password reset via email

Users can now request a password reset link sent to their
registered email address. Link expires after 1 hour.

Closes #142
```

The convention many teams follow:

```
<type>: <short summary>

<body explaining what and why, not how>

<footer: issue refs, breaking changes>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

**Real-life scenario:** Your team uses a CI/CD pipeline. Every commit message with `fix:` triggers a patch version bump automatically. Every `feat:` bumps a minor version. Meaningful commit messages become release notes.

---

**`git log` — Explore history**

```bash
git log                        # Full history, verbose
git log --oneline              # One line per commit
git log --oneline --graph      # ASCII graph of branches
git log --oneline --graph --all  # Show all branches
git log -5                     # Last 5 commits only
git log --author="Priya"       # Filter by author
git log --since="2 weeks ago"  # Filter by date
git log -- auth/login.py       # History of a specific file
git log -S "password_reset"    # Find commits that added/removed this string
```

```bash
git log --oneline --graph --all
```

```
* a3f1c2e (HEAD -> feature/oauth) Add Google OAuth callback
* 9b2d4f1 Add OAuth dependency to requirements
| * 7e3a1b0 (main) Fix typo in README
|/
* 4c8d2e9 Initial project setup
```

This graph view is invaluable for understanding branch topology.

---

**`git diff` — See exactly what changed**

```bash
git diff                       # Working dir vs staging area (unstaged changes)
git diff --staged              # Staging area vs last commit (what will be committed)
git diff HEAD                  # Working dir vs last commit (all changes)
git diff main feature/oauth    # Compare two branches
git diff a3f1c2e 9b2d4f1       # Compare two commits
git diff HEAD~3 HEAD           # Last 3 commits worth of changes
```

```bash
git diff --staged
```

```diff
diff --git a/auth/login.py b/auth/login.py
index 3f4a2b1..8c9d3e2 100644
--- a/auth/login.py
+++ b/auth/login.py
@@ -45,6 +45,10 @@ def login(user, password):
+    if password is None:
+        return False
+
     hashed = hash_password(password)
```

Red lines (prefixed `-`) are removed. Green lines (prefixed `+`) are added.

---

### Undo and Recovery

This is where many developers struggle. Git gives you multiple levels of undo — understanding which tool to use when is critical.

---

**`git restore` — File-level undo (safe)**

```bash
# Discard working directory changes (unstaged edits)
git restore auth/login.py

# Unstage a file (move it back from staging to working dir)
git restore --staged auth/login.py

# Both at once: unstage AND discard working dir changes
git restore --staged --worktree auth/login.py

# Restore file to state from a specific commit
git restore --source=HEAD~2 auth/login.py
```

**Real-life scenario:** You accidentally deleted 200 lines of a function while refactoring and saved the file. `git restore auth/login.py` brings it back instantly to the last committed state.

⚠️ `git restore` on a working directory file is **not undoable** — that content is gone.

---

**`git reset` — Move the branch pointer (commit-level undo)**

`git reset` moves `HEAD` and the current branch pointer backward. The key difference is what happens to your changes:

```
Before reset:

A ── B ── C ── D   ← HEAD (main)
               ↑
         current commit

After: git reset HEAD~2 (go back 2 commits)

A ── B   ← HEAD (main)

C and D are now "unreachable" from this branch
```

Three modes:

```bash
# --soft: Move HEAD back. Staged area and working dir unchanged.
# Changes from C and D are now staged, ready to re-commit differently.
git reset --soft HEAD~1

# --mixed (default): Move HEAD back. Staged area cleared. Working dir unchanged.
# Changes from C and D are in your working dir as uncommitted modifications.
git reset HEAD~1
git reset --mixed HEAD~1   # same thing

# --hard: Move HEAD back. Staged area cleared. Working dir reverted.
# Changes from C and D are GONE. Working dir matches the target commit.
git reset --hard HEAD~1
```

**When to use each:**

| Mode      | Staged      | Working Dir | Use Case                                                    |
| --------- | ----------- | ----------- | ----------------------------------------------------------- |
| `--soft`  | Kept staged | Unchanged   | "I want to rewrite this commit message or squash it"        |
| `--mixed` | Cleared     | Unchanged   | "I committed too soon, want to re-stage things differently" |
| `--hard`  | Cleared     | Reverted    | "Throw everything away, go back to this point"              |

**Real-life scenario (--soft):** You made 4 small "wip" commits while experimenting. Before pushing, squash them into one clean commit:

```bash
git reset --soft HEAD~4    # Uncommit 4 commits, keep changes staged
git commit -m "feat: add complete OAuth flow"   # One clean commit
```

**Real-life scenario (--hard):** You pulled from main and it broke everything in your branch. Your branch was clean before the pull:

```bash
git reset --hard ORIG_HEAD   # Git stores previous HEAD in ORIG_HEAD before operations like pull/merge
```

---

**`git checkout` — The older Swiss army knife**

Historically, `git checkout` did too many things. Modern Git splits its duties:

```bash
# Switch branches (now prefer: git switch)
git checkout main
git checkout -b feature/payments    # Create and switch (now prefer: git switch -c)

# Restore a file from a specific commit (now prefer: git restore --source)
git checkout HEAD~2 -- auth/login.py

# Detach HEAD — examine old commit directly
git checkout a3f1c2e
```

**Detached HEAD** deserves explanation:

```
Normal state:
HEAD → main → commit_abc

Detached HEAD (after git checkout a3f1c2e):
HEAD → commit_a3f1c2e    (HEAD points to a commit directly, not a branch)
main → commit_abc
```

You're in a "read-only time machine." You can look around and even make commits, but they'll be orphaned unless you create a branch:

```bash
git checkout a3f1c2e        # Detached HEAD
# Look around, run tests...
git switch -c hotfix/investigate    # Save your position as a real branch
```

The modern equivalents are cleaner:

```bash
git switch main                         # replaces: git checkout main
git switch -c feature/payments          # replaces: git checkout -b feature/payments
git restore --source=HEAD~2 login.py    # replaces: git checkout HEAD~2 -- login.py
```

---

## Part 3: Branching and Merging

### Branch Management

A branch in Git is simply a **named pointer to a commit**. It's almost free to create — just 41 bytes (a commit hash). This is radically different from older VCS where branching was expensive and slow.

```bash
git branch                     # List local branches
git branch -a                  # List local + remote branches
git branch feature/login       # Create branch (stay on current branch)
git branch -d feature/login    # Delete (safe — won't delete unmerged branches)
git branch -D feature/login    # Force delete (even if unmerged)
git branch -m old-name new-name  # Rename branch
```

**`git switch` — Modern way to change branches**

```bash
git switch main                # Switch to existing branch
git switch -c feature/cart     # Create and switch
git switch -                   # Switch to previous branch (like cd -)
```

---

### HEAD Pointer Behavior

`HEAD` is a special pointer that always tells you "where you are right now":

```
main:     A ── B ── C
                    ↑
              HEAD (on main)

git switch -c feature/api

main:     A ── B ── C
                    ↑
feature/api:        ↑
              Both point here, HEAD now follows feature/api

(make a commit D on feature/api)

main:     A ── B ── C
                    ↑ main

feature/api:  A ── B ── C ── D
                             ↑ HEAD → feature/api
```

Every new commit advances the branch `HEAD` is pointing to. `main` stays at C until you merge.

---

### Merging

**Fast-Forward Merge** — The simple case

Happens when the target branch has no new commits since the feature branch was created. Git simply advances the pointer — no new commit needed:

```
Before:
main:        A ── B ── C
                       ↑ main
feature:     A ── B ── C ── D ── E
                                 ↑ feature

git switch main
git merge feature

After (fast-forward):
main:        A ── B ── C ── D ── E
                                 ↑ main (pointer just moved forward)
```

```bash
git switch main
git merge feature/login
# Output: Fast-forward
```

---

**Three-Way Merge** — When both branches have moved

When `main` has new commits that `feature` doesn't have, Git needs to create a **merge commit** that has two parents:

```
Before:
main:     A ── B ── C ── F
                          ↑ main (F is a new commit on main)
feature:  A ── B ── C ── D ── E
                                ↑ feature

Git looks at 3 things:
1. Common ancestor: C
2. What main changed since C: F
3. What feature changed since C: D, E

After (three-way merge):
main:  A ── B ── C ── D ── E ── M
                    └── F ──────┘ ↑ M is merge commit with 2 parents
```

```bash
git switch main
git merge feature/payments
# Output: Merge made by the 'ort' strategy.
```

The merge commit message is auto-generated as `Merge branch 'feature/payments' into main`.

**Forcing a merge commit even when fast-forward is possible:**

```bash
git merge --no-ff feature/login
```

Many teams prefer this — it preserves the visual record that a feature branch existed.

---

### Conflict Resolution

Conflicts occur when both branches modified the **same lines** of the same file. Git can't decide which version wins — it asks you:

```bash
git merge feature/payments
# AUTO-MERGING auth/login.py
# CONFLICT (content): Merge conflict in auth/login.py
# Automatic merge failed; fix conflicts and then commit the result.
```

Open `auth/login.py` — Git has marked the conflict:

```python
def process_payment(amount, user):
<<<<<<< HEAD
    # main branch version
    if amount <= 0:
        raise ValueError("Amount must be positive")
    return stripe.charge(amount, user.stripe_id)
=======
    # feature/payments version
    validated = validate_amount(amount)
    return paypal.charge(validated, user.paypal_email)
>>>>>>> feature/payments
```

The markers mean:

- `<<<<<<< HEAD` — Start of your current branch's version
- `=======` — Dividing line
- `>>>>>>> feature/payments` — End of the incoming branch's version

**Manual resolution — you decide the correct code:**

```python
def process_payment(amount, user):
    # Resolved: keep validation from feature branch,
    # but support both Stripe and PayPal
    if amount <= 0:
        raise ValueError("Amount must be positive")
    validated = validate_amount(amount)
    if user.payment_method == 'stripe':
        return stripe.charge(validated, user.stripe_id)
    return paypal.charge(validated, user.paypal_email)
```

Delete all conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`). Save the file. Then:

```bash
git add auth/login.py       # Mark conflict as resolved
git status                  # Verify no more conflicts
git commit                  # Complete the merge (message is pre-filled)
```

**Post-merge validation — don't skip this:**

```bash
# Run your test suite
python -m pytest

# Check the resulting history makes sense
git log --oneline --graph -10

# Review what actually changed in the merge commit
git diff HEAD~1 HEAD
```

**Real-life scenario:** Two developers worked on the same config file. One added a new database setting; the other changed a timeout value. They're on different lines — no conflict, Git auto-merges. But if both changed the same timeout line with different values, a conflict arises. The resolution is to pick the correct timeout, or discuss with the other developer.

---

### Rebase

Rebase **replays** your commits on top of another branch, rewriting history to create a linear sequence:

```
Before rebase:
main:     A ── B ── C ── F
                          ↑ main
feature:  A ── B ── C ── D ── E
                                ↑ feature (on feature branch)

git rebase main   (while on feature branch)

After rebase:
main:     A ── B ── C ── F
                          ↑ main
feature:  A ── B ── C ── F ── D' ── E'
                                      ↑ feature
```

D and E are rewritten as D' and E' — same changes, but new commit hashes, now based on F instead of C.

```bash
git switch feature/payments
git rebase main

# Interactive rebase: rewrite, squash, reorder last N commits
git rebase -i HEAD~4
```

Interactive rebase opens an editor:

```
pick a3f1c2e Add PayPal integration
pick 9b2d4f1 Fix typo in PayPal handler
pick 7e3a1b0 Add tests for PayPal
pick 4c8d2e9 WIP: debugging session

# Commands:
# p, pick   = use commit
# r, reword = use commit, but edit the message
# s, squash = meld into previous commit
# d, drop   = remove commit
```

Change it to:

```
pick a3f1c2e Add PayPal integration
squash 9b2d4f1 Fix typo in PayPal handler
squash 7e3a1b0 Add tests for PayPal
drop 4c8d2e9 WIP: debugging session
```

Result: one clean commit with a message you write, containing all three changes. The "WIP" commit is gone.

---

### Rebase vs Merge: The Fundamental Tradeoff

| Aspect                    | Merge                                  | Rebase                           |
| ------------------------- | -------------------------------------- | -------------------------------- |
| History shape             | Non-linear (preserves branch topology) | Linear (clean, straight line)    |
| Original commits          | Preserved exactly                      | Rewritten (new hashes)           |
| Merge commits             | Creates one                            | None                             |
| Conflict handling         | Resolve once at merge                  | Resolve per-commit during replay |
| Safety on shared branches | Safe                                   | **Dangerous**                    |

**When to use merge:**

- Bringing a feature branch into `main` (preserves feature branch existence)
- Any branch that others are working on
- When you want the full historical record of when things happened

**When to use rebase:**

- Cleaning up your local feature branch before a PR
- Incorporating latest `main` changes into your feature branch (so your branch stays current)
- Squashing WIP commits into logical units

---

### The Golden Rule of Rebase

> **Never rebase commits that have been pushed to a shared remote branch.**

Here's why this is catastrophic:

```
Shared state (everyone has this):
main:     A ── B ── C ── D
                          ↑ origin/main

Developer A runs: git rebase -i HEAD~2 (rewrites C and D)

Developer A's local:
main:     A ── B ── C' ── D'   ← new hashes!

Developer A force-pushes to main.

Developer B (who had D) now does git pull:
Git sees: B has commits C and D locally, but remote has C' and D'
Result: Duplicate commits, diverged history, chaos.
```

**Safe rebase workflow:**

```bash
# SAFE: Rebase your local feature branch on top of updated main
git switch feature/my-feature
git fetch origin
git rebase origin/main          # Replay your commits on latest main

# SAFE: Rebase before you've pushed anywhere
git rebase -i HEAD~3            # Squash your 3 local commits

# DANGEROUS: Never do this if others have pulled the branch
git push --force origin main    # Rewrites shared history
```

If you must force push your own feature branch (that only you work on):

```bash
git push --force-with-lease origin feature/my-feature
# --force-with-lease is safer: fails if someone else pushed since your last fetch
```

---

### Real-Life Project Management Scenario: Full Workflow

Let's put it all together. Your team is building an e-commerce platform:

```bash
# 1. Start your day: update main
git switch main
git pull origin main

# 2. Create a feature branch
git switch -c feature/product-search

# 3. Work — make several commits
git add search/engine.py
git commit -m "feat: implement Elasticsearch integration"

git add search/filters.py
git commit -m "feat: add price range and category filters"

git add tests/test_search.py
git commit -m "test: add search integration tests"

# 4. Before PR, rebase on latest main (teammates merged things while you worked)
git fetch origin
git rebase origin/main
# Resolve any conflicts per-commit, then: git rebase --continue

# 5. Clean up your commit history (optional but professional)
git rebase -i HEAD~3
# squash the 3 commits into 1 clean commit

# 6. Push your branch
git push origin feature/product-search

# 7. On GitHub: open a Pull Request from feature/product-search → main
# Team reviews, approves.

# 8. Merge into main (via GitHub PR, or locally)
git switch main
git merge --no-ff feature/product-search
git push origin main

# 9. Clean up
git branch -d feature/product-search
git push origin --delete feature/product-search
```

This workflow — sometimes called **feature branch workflow** — keeps `main` always in a deployable state, and every feature is isolated, reviewable, and mergeable independently.

---

### Quick Reference Card

```
SETUP          git init / git clone <url>
STATUS         git status / git status -s
STAGING        git add <file> / git add -p / git add .
COMMITTING     git commit -m "msg" / git commit --amend
HISTORY        git log --oneline --graph --all
DIFF           git diff / git diff --staged / git diff <branch1> <branch2>

UNDO (safe)    git restore <file>              ← discard working dir changes
               git restore --staged <file>     ← unstage
UNDO (commit)  git reset --soft HEAD~1         ← uncommit, keep staged
               git reset --mixed HEAD~1        ← uncommit, keep in working dir
               git reset --hard HEAD~1         ← uncommit, discard changes

BRANCHES       git branch / git switch <branch> / git switch -c <new>
MERGE          git merge <branch> / git merge --no-ff <branch>
REBASE         git rebase <branch> / git rebase -i HEAD~N
CONFLICT       edit → remove markers → git add → git commit
```

---

# Remote Repositories, GitHub Workflow & Advanced Git

---

## Part 4: Remote Repositories — GitHub Integration

### Remote Setup

A remote is simply a **named URL** pointing to another copy of your repository. You can have multiple remotes — this is what makes Git distributed.

```bash
git remote add origin https://github.com/org/project.git   # Add a remote
git remote -v                                               # List remotes with URLs
git remote rename origin upstream                           # Rename a remote
git remote remove upstream                                  # Remove a remote
git remote set-url origin git@github.com:org/project.git   # Change URL
```

The name `origin` is just a convention — the default name given to the remote you cloned from. Nothing magical about it.

**Multiple remotes in practice:**

```bash
git remote add origin  git@github.com:yourname/project.git    # Your fork
git remote add upstream git@github.com:orgname/project.git    # Original repo

git remote -v
# origin    git@github.com:yourname/project.git  (fetch)
# origin    git@github.com:yourname/project.git  (push)
# upstream  git@github.com:orgname/project.git   (fetch)
# upstream  git@github.com:orgname/project.git   (push)
```

This two-remote setup is standard when contributing to open source.

---

### Remote Tracking Branches

When you clone or fetch, Git creates **remote tracking branches** — local read-only references that mirror the last known state of the remote:

```
Local branches:          Remote tracking branches:
main                     origin/main
feature/auth             origin/feature/auth
                         origin/feature/payments   ← exists on remote, not locally yet
```

```bash
git branch -a            # Show local + remote tracking branches
git branch -r            # Show only remote tracking branches
```

```
* main
  feature/auth
  remotes/origin/HEAD → origin/main
  remotes/origin/main
  remotes/origin/feature/auth
  remotes/origin/feature/payments
```

Remote tracking branches update only when you `fetch` or `pull`. They represent the **last known state** of the remote — not necessarily the current live state.

```
Your local state after fetch:

origin/main ──────────────────────► (read-only snapshot of remote)
                                     ↑
                              git fetch updates this

main ────────────────────────────► (your local branch, you control this)
```

**Tracking relationship** — a local branch can "track" a remote branch, making push/pull know where to go automatically:

```bash
git branch --set-upstream-to=origin/main main     # Set tracking for existing branch
git push -u origin feature/auth                   # Push and set tracking simultaneously
git branch -vv                                    # Show tracking relationships
```

```
* feature/auth  a3f1c2e [origin/feature/auth: ahead 2] Add OAuth flow
  main          9b2d4f1 [origin/main] Update README
```

"ahead 2" means your local branch has 2 commits the remote doesn't have yet.

---

### Data Sync

**`git fetch` — Download without merging**

```bash
git fetch origin                   # Fetch all changes from origin
git fetch origin main              # Fetch only the main branch
git fetch --all                    # Fetch from all remotes
git fetch --prune                  # Also delete local refs to deleted remote branches
```

`fetch` updates your remote tracking branches (`origin/main`) but **never touches your local branches**. It's completely safe — no risk of conflicts or surprises.

```
Before fetch:
  Your local main:    A ── B ── C
  origin/main:        A ── B ── C   (last known state)
  Actual remote:      A ── B ── C ── D ── E   (teammates pushed)

After git fetch origin:
  Your local main:    A ── B ── C   (unchanged — you still need to merge)
  origin/main:        A ── B ── C ── D ── E   (now up to date)

After git merge origin/main (or git pull):
  Your local main:    A ── B ── C ── D ── E
```

**The professional habit — always fetch before you start working:**

```bash
git fetch origin
git log --oneline HEAD..origin/main    # See what teammates pushed that you don't have
git log --oneline origin/main..HEAD    # See your local commits the remote doesn't have
```

---

**`git pull` — Fetch + merge in one command**

```bash
git pull                           # Fetch origin + merge into current branch
git pull origin main               # Explicit remote and branch
git pull --rebase                  # Fetch + rebase instead of merge
git pull --rebase=interactive      # Fetch + interactive rebase
```

`git pull` is shorthand for:

```bash
git fetch origin
git merge origin/main
```

**`git pull --rebase` is almost always preferable:**

```
git pull (merge) creates:
A ── B ── C ── F ── M       ← M is a meaningless merge commit
              └─ D ─┘         "Merge branch 'main' of github.com..."

git pull --rebase creates:
A ── B ── C ── D ── F       ← clean linear history, your commit F replayed on top
```

Setting rebase as default for pull:

```bash
git config --global pull.rebase true
```

---

**`git push` — Upload local commits to remote**

```bash
git push origin main               # Push main to origin
git push -u origin feature/auth    # Push + set upstream tracking
git push                           # Push to tracked remote (once upstream set)
git push origin --delete feature/old-branch   # Delete remote branch
git push --force-with-lease        # Force push (safer than --force)
git push --tags                    # Push all tags
```

**What happens during push:**

```
Local:  A ── B ── C ── D ── E   ← you have these
Remote: A ── B ── C             ← remote has these

git push origin main
Remote: A ── B ── C ── D ── E   ← remote now matches
```

**Push rejection — the most common pain point:**

```bash
git push origin main
# ! [rejected] main → main (fetch first)
# error: failed to push some refs
# hint: Updates were rejected because the remote contains work you do not have locally.
```

This means the remote has commits you don't have. You must integrate them first:

```bash
git fetch origin
git rebase origin/main    # or: git merge origin/main
git push origin main      # Now succeeds
```

**Force push — use with extreme caution:**

```bash
# DANGEROUS: overwrites remote history unconditionally
git push --force origin feature/my-branch

# SAFER: fails if someone else pushed since your last fetch
git push --force-with-lease origin feature/my-branch
```

Only force push to **your own feature branches** that you alone work on, typically after a rebase that rewrites commit hashes.

---

### Authentication

**SSH Setup — Recommended for daily use**

SSH uses a public/private key pair. You keep the private key; GitHub stores the public key. No passwords needed.

```bash
# Step 1: Generate an SSH key pair
ssh-keygen -t ed25519 -C "your@email.com"
# Accept default location (~/.ssh/id_ed25519)
# Set a passphrase (optional but recommended)

# Step 2: Start the SSH agent and add your key
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Step 3: Copy your public key
cat ~/.ssh/id_ed25519.pub
# ssh-ed25519 AAAA...your key...

# Step 4: Add to GitHub
# GitHub → Settings → SSH and GPG keys → New SSH key → paste the public key

# Step 5: Test
ssh -T git@github.com
# Hi yourname! You've successfully authenticated.

# Step 6: Use SSH URLs for remotes
git remote set-url origin git@github.com:yourname/project.git
```

SSH config for multiple accounts (common when you have personal + work GitHub):

```
# ~/.ssh/config
Host github-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_personal

Host github-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_work
```

```bash
# Use the alias in remote URLs
git remote add origin git@github-personal:yourname/project.git
git remote add origin git@github-work:company/project.git
```

---

**HTTPS with Personal Access Tokens**

GitHub deprecated password authentication in 2021. HTTPS now requires tokens:

```bash
# GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
# Create token with: repo, workflow scopes
# Copy the token — you only see it once

# Use token as password when prompted
git push origin main
# Username: yourname
# Password: ghp_xxxxxxxxxxxxxxxxxxxx    ← paste token here

# Store token so you're not prompted every time
git config --global credential.helper store        # Stores in plaintext ~/.git-credentials
git config --global credential.helper cache        # Stores in memory (temporary)
git config --global credential.helper osxkeychain  # macOS Keychain (secure)
# On Linux with GUI:
git config --global credential.helper libsecret
```

**SSH vs HTTPS:**

|                     | SSH                          | HTTPS                         |
| ------------------- | ---------------------------- | ----------------------------- |
| Setup effort        | More upfront                 | Easier initially              |
| Daily use           | No passwords ever            | Token needed once (if cached) |
| Corporate firewalls | Sometimes blocked (port 22)  | Always works (port 443)       |
| Multiple accounts   | Manageable with config       | More complex                  |
| Recommendation      | **Preferred for developers** | Good fallback                 |

---

## Part 5: GitHub Workflow — Team Development

### Forking vs Cloning

These are fundamentally different operations for different situations:

```
CLONING:
GitHub: [org/project] ─── git clone ──► [your machine: full local copy]

You have write access to origin. Push directly.
Used when: You're a team member with repository access.


FORKING:
GitHub: [org/project] ──── fork ────► [yourname/project] (on GitHub)
                                             │
                                        git clone
                                             │
                                             ▼
                                   [your machine: local copy]

You own your fork. Submit changes via Pull Request.
Used when: Contributing to someone else's project.
```

```bash
# After forking on GitHub:
git clone git@github.com:yourname/project.git
cd project

# Add the original repo as "upstream"
git remote add upstream git@github.com:org/project.git

git remote -v
# origin    git@github.com:yourname/project.git (your fork)
# upstream  git@github.com:org/project.git      (original)
```

---

### Upstream Sync — Keeping Your Fork Current

Open source projects move fast. Your fork gets stale. Here's how to keep it updated:

```bash
# Fetch latest from the original project
git fetch upstream

# See what you're missing
git log --oneline HEAD..upstream/main

# Update your local main
git switch main
git rebase upstream/main     # or: git merge upstream/main

# Push updated main to your fork
git push origin main
```

**Automated with an alias:**

```bash
git config --global alias.sync '!git fetch upstream && git rebase upstream/main && git push origin main'
git sync   # One command to stay current
```

---

### Pull Requests

A Pull Request (PR) is a GitHub-level concept — it's a request to merge your branch into another branch, with a discussion thread attached.

**The complete PR lifecycle:**

```
1. Create feature branch locally
   git switch -c feature/user-notifications

2. Do the work, commit cleanly
   git add .
   git commit -m "feat: add email notifications for order updates"

3. Push branch to remote
   git push -u origin feature/user-notifications

4. Open PR on GitHub
   Base: main  ←  Compare: feature/user-notifications

5. Team reviews → feedback → you update
6. Approval → merge
7. Branch cleanup
```

**Creating PRs effectively — what makes a great PR:**

```markdown
## PR Title

feat: Add email notifications for order updates

## What this PR does

- Sends email when order status changes (pending → shipped → delivered)
- Uses SendGrid API for delivery
- Adds retry logic for failed sends (3 attempts, exponential backoff)

## Why

Closes #234 — Users want proactive order updates without polling the app.

## How to test

1. Create a test order via /api/orders
2. Change status via admin panel
3. Check inbox for notification

## Screenshots

[before/after if UI changes]

## Checklist

- [x] Tests added
- [x] Documentation updated
- [x] No breaking changes
```

---

**Reviewing Changes**

As a reviewer, your job is to be a collaborator, not a gatekeeper. GitHub gives you line-level commenting:

```
On GitHub PR → Files changed tab:
- Click [+] on any line to add a comment
- Use "Start a review" to batch all comments
- Submit as: Comment / Approve / Request Changes
```

**What good PR review checks:**

```
Correctness:    Does the logic actually solve the problem?
Edge cases:     What happens with null inputs, empty arrays, concurrent access?
Tests:          Are new behaviors tested? Do existing tests still pass?
Security:       SQL injection? Unvalidated inputs? Exposed secrets?
Performance:    N+1 queries? Missing indexes? Unnecessary loops?
Readability:    Will future-me understand this in 6 months?
Conventions:    Follows team style guide? Consistent naming?
```

---

**Handling Review Feedback**

```bash
# Reviewer requests changes. You update your branch:
git switch feature/user-notifications

# Make requested changes
git add notifications/email.py
git commit -m "fix: add retry logic per review feedback"

# Push — PR updates automatically
git push origin feature/user-notifications
```

**For multiple small fixes, amending and force-pushing keeps history clean:**

```bash
# Fix a typo pointed out in review (don't clutter history with "fix typo" commits)
git add notifications/email.py
git commit --amend --no-edit     # Amend last commit silently
git push --force-with-lease origin feature/user-notifications
```

**Resolving "resolve conversation" — mark discussions done on GitHub after addressing each comment.**

---

**Merging Strategies — the three options GitHub offers:**

```
1. MERGE COMMIT (--no-ff)
   main: A ── B ── C ── D ── E ── M
                    └─────────────┘
                    feature branch

   Creates a merge commit M. Preserves full branch history.
   Best for: Feature branches with meaningful history you want to keep.

2. SQUASH AND MERGE
   main: A ── B ── C ── S

   All feature commits squashed into one commit S.
   Best for: Messy WIP history ("fix", "wip", "try again") you want cleaned up.
   Tradeoff: Lose per-commit granularity.

3. REBASE AND MERGE
   main: A ── B ── C ── D' ── E'

   Feature commits replayed on top of main, linearly.
   Best for: Teams that want clean linear history.
   Tradeoff: Commit hashes change; harder to trace back to original branch.
```

**Team convention matters most** — pick one strategy and apply it consistently. Most teams use squash-and-merge for feature branches and merge commits for release branches.

---

### Issues — Tracking and Linking

Issues are GitHub's built-in project tracker. Used well, they form a permanent record of decisions.

**Creating a good issue:**

```markdown
## Bug: Order total shows wrong currency symbol

**Environment:** Production, Safari 16, macOS Ventura

**Steps to reproduce:**

1. Add items to cart
2. Switch locale from USD to EUR
3. Proceed to checkout

**Expected:** Total shows € symbol
**Actual:** Total still shows $

**Impact:** Medium — affects EU users, no data corruption

**Possible cause:** Locale context not passed to checkout component
```

**Labels** organize issues:

```
bug          p0-critical    p1-high      p2-medium
enhancement  documentation  good-first-issue
frontend     backend        infrastructure
```

**Milestones** group issues into releases:

```
v1.2.0 (Due: March 15) — 12 open, 34 closed
├── #234 Add email notifications
├── #241 Fix currency symbol bug
└── #256 Optimize search query
```

---

**Linking Commits and PRs to Issues**

GitHub's magic keywords — when used in commit messages or PR descriptions, they automatically close issues when merged to the default branch:

```bash
# In commit messages:
git commit -m "fix: correct currency symbol in checkout (closes #241)"
git commit -m "feat: email notifications for orders (resolves #234)"

# Also works: fixes, fixed, close, closed, resolve, resolved
```

```markdown
# In PR description:

Closes #234
Fixes #241
Resolves #256
```

When this PR merges to main, all three issues automatically close. The issue gets a reference link back to the PR and commit — complete traceability from bug report to exact code change.

**Cross-repository references:**

```bash
git commit -m "fix: workaround for upstream bug (ref: org/library#892)"
```

---

### Branching Strategy

**Feature Branches — The standard unit of work**

Every piece of work gets its own branch. Branch from the latest main; merge back when done.

```
main ──────────────────────────────────────────►
      │                        │
      └─ feature/search ───────┘
              │                     │
              └─ feature/payments ──┘
```

**Naming Conventions — clarity for your entire team:**

```bash
# Format: <type>/<ticket-or-description>

feature/user-authentication
feature/PROJ-142-email-notifications
fix/login-null-pointer
fix/PROJ-241-currency-symbol
hotfix/critical-payment-bug
hotfix/v2.1.1-session-timeout
refactor/extract-auth-service
chore/update-dependencies
docs/api-reference-update
test/improve-search-coverage
release/v2.2.0
```

The ticket number prefix (like `PROJ-142`) is especially valuable on larger teams — anyone can immediately look up context in Jira/Linear.

---

**Hotfix Branches — Emergency production fixes**

```
main (production) ──── v2.1.0 ────────────────────────────────► v2.1.1
                                  │                         │
                                  └─ hotfix/payment-crash ──┘
                                                            │
                                                      also merge back to:
develop ──────────────────────────────────────────────────► develop
```

```bash
# Critical bug found in production!
git switch main
git pull origin main

git switch -c hotfix/payment-processing-crash

# Make minimal targeted fix
git add payments/processor.py
git commit -m "fix: handle None response from payment gateway

Stripe occasionally returns None for declined cards in certain
regions. Previous code raised AttributeError on .status access.

Closes #312"

# Test thoroughly
python -m pytest tests/test_payments.py

# Merge to main
git switch main
git merge --no-ff hotfix/payment-processing-crash
git tag -a v2.1.1 -m "Emergency fix: payment processing crash"
git push origin main --tags

# Critical: also merge to develop so fix isn't lost
git switch develop
git merge --no-ff hotfix/payment-processing-crash
git push origin develop

# Cleanup
git branch -d hotfix/payment-processing-crash
```

---

## Part 6: Advanced Git Operations

### History Manipulation

**`git commit --amend` — Fix the last commit**

```bash
# Fix the commit message
git commit --amend -m "feat: add OAuth2 Google login support"

# Add a forgotten file to the last commit
git add forgotten_file.py
git commit --amend --no-edit    # Keep the same message

# Change both content and message
git add auth/oauth.py
git commit --amend -m "feat: add OAuth2 with proper error handling"
```

⚠️ Amend rewrites the commit (new hash). Never amend commits already pushed to shared branches.

---

**`git rebase -i` — The history sculptor**

Interactive rebase lets you rewrite any sequence of recent commits before they're shared:

```bash
git rebase -i HEAD~5    # Rewrite last 5 commits
git rebase -i origin/main   # Rewrite all commits not yet on main
```

The editor shows commits in **chronological order** (oldest first — opposite of `git log`):

```
pick 1a2b3c4 Initial search implementation
pick 5d6e7f8 Fix typo in search
pick 9a0b1c2 Add filter by category
pick 3d4e5f6 WIP debugging
pick 7a8b9c0 Add filter by price range

# Commands:
# p, pick    = use commit as-is
# r, reword  = change commit message
# e, edit    = pause and amend this commit
# s, squash  = meld into previous commit (keeps both messages)
# f, fixup   = meld into previous commit (discard this message)
# d, drop    = remove this commit entirely
# b, break   = pause here for manual work
```

**Squashing WIP commits into clean history:**

```
Change to:
pick 1a2b3c4 Initial search implementation
fixup 5d6e7f8 Fix typo in search
pick 9a0b1c2 Add filter by category
drop 3d4e5f6 WIP debugging
fixup 7a8b9c0 Add filter by price range
```

Result: 2 clean commits — "Initial search implementation" and "Add filter by category" (which absorbs the price range work).

**Reordering commits:**

```
Before:
pick aaa Add login page
pick bbb Add signup page
pick ccc Hotfix: fix auth bug

Reorder:
pick ccc Hotfix: fix auth bug    ← move this first
pick aaa Add login page
pick bbb Add signup page
```

**Editing a specific old commit:**

```bash
git rebase -i HEAD~4
# Mark the target commit as "edit"

# Git pauses at that commit. Make your changes:
git add auth/login.py
git commit --amend

# Continue the rebase
git rebase --continue
```

**If rebase goes wrong:**

```bash
git rebase --abort    # Cancel entire rebase, return to original state
```

---

### Selective Changes — `git cherry-pick`

Cherry-pick applies the changes from a specific commit onto your current branch — copying just that commit's changes without bringing its entire branch.

```bash
git cherry-pick a3f1c2e                    # Apply one commit
git cherry-pick a3f1c2e 9b2d4f1            # Apply multiple specific commits
git cherry-pick a3f1c2e..7e3a1b0           # Apply a range (exclusive start)
git cherry-pick a3f1c2e^..7e3a1b0          # Apply a range (inclusive start)
git cherry-pick -n a3f1c2e                 # Apply changes but don't commit (stage only)
```

**Real-life scenario 1 — Backporting a fix:**

```
main: ─────────── A ─── B ─── C (contains critical fix)

release/v1.8: ─── A ─── D ─── E    ← old release, still deployed

You need commit C's fix in the old release branch:

git switch release/v1.8
git cherry-pick C
```

**Real-life scenario 2 — Rescuing work from a wrong branch:**

```bash
# You accidentally committed to main instead of your feature branch
git log --oneline -3
# a3f1c2e (HEAD → main) feat: add search caching
# 9b2d4f1 Previous release

# Save that commit to the right place
git switch feature/search
git cherry-pick a3f1c2e    # Apply the commit here

# Remove it from main
git switch main
git reset --hard HEAD~1    # Remove the accidental commit from main
```

Cherry-pick creates a **new commit** with a new hash — the changes are the same, but it's a distinct commit in history.

---

### Temporary Work — `git stash`

Stash is a clipboard for uncommitted work. You're mid-task when something urgent comes up — stash saves your in-progress work without committing it.

```bash
git stash                          # Stash tracked modified files
git stash push -m "WIP: search filter logic"   # With descriptive name
git stash --include-untracked      # Also stash untracked (new) files
git stash --all                    # Stash everything including ignored files

git stash list                     # See all stashes
# stash@{0}: On feature/search: WIP: search filter logic
# stash@{1}: WIP on main: 9b2d4f1 Previous release

git stash show stash@{0}           # See what's in a stash (summary)
git stash show -p stash@{0}        # See full diff of stash

git stash pop                      # Apply most recent stash and remove it from list
git stash apply stash@{1}          # Apply specific stash (keep it in list)
git stash drop stash@{1}           # Delete a specific stash
git stash clear                    # Delete all stashes
```

**Real-life scenario — interrupted by an urgent bug:**

```bash
# You're in the middle of building a feature
git status
# modified: search/engine.py
# modified: search/filters.py

# Urgent bug report comes in!
git stash push -m "WIP: search filters, half done"

# Switch to fix the bug
git switch -c hotfix/search-crash
# ... fix it, commit, merge ...

# Return to your feature work
git switch feature/search
git stash pop
# Working directory restored exactly as you left it
```

**Stash to a new branch (when stash causes conflicts on current branch):**

```bash
git stash branch feature/recovered-work stash@{0}
# Creates new branch, checks it out, applies the stash, drops it
```

---

### Tagging

Tags mark specific points in history as significant — almost always used for **release versions**.

**Lightweight tags** — just a pointer to a commit, like a branch that doesn't move:

```bash
git tag v1.0.0                     # Tag current commit
git tag v1.0.0 a3f1c2e             # Tag a specific commit
```

**Annotated tags** — a full Git object with metadata, message, author, date, and optionally GPG signature. **Always use these for releases:**

```bash
git tag -a v1.0.0 -m "Release v1.0.0: Initial stable release"
git tag -a v1.2.1 -m "Hotfix: payment processing crash" a3f1c2e
git tag -s v1.0.0 -m "Signed release"     # GPG-signed tag
```

**Working with tags:**

```bash
git tag                            # List all tags
git tag -l "v1.*"                  # List tags matching pattern
git show v1.0.0                    # Show tag details + commit
git push origin v1.0.0             # Push a specific tag
git push origin --tags             # Push all tags
git push origin --follow-tags      # Push commits + their annotated tags

git checkout v1.0.0                # Go to that point in history (detached HEAD)
git switch -c hotfix/v1.0.1 v1.0.0  # Branch from a tag

git tag -d v1.0.0                  # Delete local tag
git push origin --delete v1.0.0   # Delete remote tag
```

**Semantic versioning with tags:**

```
v1.0.0   ← Major.Minor.Patch
  │  │  └── Patch: backward-compatible bug fixes
  │  └───── Minor: new backward-compatible features
  └──────── Major: breaking changes

v1.0.0 → v1.0.1 (hotfix)
v1.0.1 → v1.1.0 (new feature)
v1.1.0 → v2.0.0 (breaking API change)

Pre-release: v2.0.0-alpha.1, v2.0.0-beta.3, v2.0.0-rc.1
```

**Real-life scenario — Release workflow:**

```bash
# All features merged to main. Time to release.
git switch main
git pull origin main

# Run tests one final time
python -m pytest

# Tag the release
git tag -a v2.3.0 -m "Release v2.3.0

Features:
- Email notifications for order updates (#234)
- Product search with filters (#198)
- PayPal payment support (#267)

Bug fixes:
- Currency symbol in checkout (#241)
- Session timeout issue (#255)"

git push origin main --follow-tags
# GitHub automatically creates a release draft from the tag
```

---

## Part 7: Debugging and Inspection

### `git blame` — Line-Level History

`git blame` shows who last changed each line of a file, and in which commit. Despite the name, it's a discovery tool, not an accusation tool.

```bash
git blame auth/login.py
git blame -L 40,60 auth/login.py          # Only lines 40–60
git blame --since="3 months ago" auth/login.py
git blame -w auth/login.py                # Ignore whitespace changes
git blame -C auth/login.py                # Detect lines moved from other files
```

```bash
git blame -L 45,52 auth/login.py
```

```
^4c8d2e9 (Priya  2024-01-15 10:23:11 +0530 45)  def login(user, password):
a3f1c2e8 (Rohan  2024-02-20 14:15:33 +0530 46)      if password is None:
a3f1c2e8 (Rohan  2024-02-20 14:15:33 +0530 47)          return False
^4c8d2e9 (Priya  2024-01-15 10:23:11 +0530 48)      hashed = hash_password(password)
7e3a1b04 (Arjun  2024-03-05 09:44:22 +0530 49)      user_record = db.get_user(user)
7e3a1b04 (Arjun  2024-03-05 09:44:22 +0530 50)      return hmac.compare(hashed, user_record.pw)
```

Each line shows: commit hash | author | date | line number | code

**Real-life scenario:** A security audit flags line 50 in `auth/login.py` as suspicious. You blame the file, see Arjun added it in commit `7e3a1b04`, then:

```bash
git show 7e3a1b04                  # See the full context of that change
git log --oneline 7e3a1b04         # What PR was this part of?
git log --oneline -1 --format="%B" 7e3a1b04  # Read the commit message
```

You find the commit message says "refactor: use constant-time comparison to prevent timing attacks" — it's intentional and correct. Mystery solved without interrupting anyone.

---

### `git bisect` — Binary Search for a Broken Commit

You know a bug exists in the current code but wasn't there three weeks ago. There are 200 commits in between. `git bisect` finds the exact commit that introduced the bug in O(log n) steps — ~8 tests for 200 commits.

```bash
git bisect start

git bisect bad                     # Current state is broken (HEAD)
git bisect good v2.1.0             # This tag/commit was known good

# Git checks out the commit halfway between good and bad:
# Bisecting: 100 revisions left to test after this (roughly 7 steps)
# [a3f1c2e] Add payment processing module
```

Now you test. Does the bug exist in this checkout?

```bash
# Test your code (run tests, manual check, whatever is appropriate)
python -m pytest tests/test_search.py

# If bug is present:
git bisect bad

# If bug is absent:
git bisect good

# Git keeps halving the range...
# Eventually:
# a3f1c2e is the first bad commit
# commit a3f1c2e
# Author: Rohan <rohan@company.com>
# Date:   2024-03-10
#     refactor: move search indexing to background worker
```

```bash
git bisect reset                   # Return to original HEAD, end bisect session
```

**Automated bisect** — if you can write a script that exits 0 for good and non-0 for bad:

```bash
git bisect start
git bisect bad HEAD
git bisect good v2.1.0
git bisect run python -m pytest tests/test_search.py -q
# Git runs this automatically on each candidate commit
# Finds the bad commit with zero interaction from you
```

**Real-life scenario:** Search results were perfect in the v2.1.0 release. Now in v2.3.0 they're subtly wrong — relevance ranking is off. There are 156 commits between the versions. Automated bisect with a focused test finds the breaking commit in under 2 minutes. The commit message reveals a "performance optimization" changed the scoring algorithm's sort order. Fix is straightforward.

---

### Log Filtering — Finding Exactly What You Need

```bash
# ── Shape of output ──────────────────────────────────────
git log --oneline                  # Hash + first line of message
git log --oneline --graph          # + ASCII branch graph
git log --oneline --graph --all    # + all branches, not just current
git log --stat                     # Show files changed per commit
git log --patch                    # Full diff for every commit (very verbose)
git log -p -2                      # Full diff, last 2 commits only
git log --shortstat                # Summary: N files changed, X insertions

# ── Filter by person ────────────────────────────────────
git log --author="Priya"           # Exact or partial match
git log --author="priya@company.com"

# ── Filter by time ──────────────────────────────────────
git log --since="2024-01-01"
git log --until="2 weeks ago"
git log --since="yesterday" --until="now"
git log --after="2024-03-01" --before="2024-03-31"  # March 2024

# ── Filter by content ───────────────────────────────────
git log --grep="payment"           # Commits whose message contains "payment"
git log --grep="fix" --grep="auth" --all-match  # Both words in message
git log -S "password_reset"        # Commits that added/removed this string (pickaxe)
git log -G "def process_payment"   # Commits where this regex changed

# ── Filter by file ──────────────────────────────────────
git log -- auth/login.py           # History of one file
git log -- "*.py"                  # History of all Python files
git log -- src/ tests/             # History touching these directories

# ── Filter by commit range ──────────────────────────────
git log main..feature/search       # Commits on feature not yet in main
git log feature/search..main       # Commits in main not yet in feature
git log HEAD~10..HEAD              # Last 10 commits
git log v2.1.0..v2.3.0            # Commits between two tags

# ── Combining filters ───────────────────────────────────
git log --oneline --author="Priya" --since="1 month ago" -- src/auth/
# "All of Priya's commits touching auth in the last month, one line each"
```

**Real-life scenarios:**

```bash
# "What changed in the auth module since last release?"
git log --oneline v2.2.0..HEAD -- src/auth/

# "Did anyone touch the payment processor this week?"
git log --since="7 days ago" --stat -- payments/

# "Find when this function was deleted"
git log -S "def calculate_discount" --patch

# "Generate a changelog between two releases"
git log --oneline v2.2.0..v2.3.0 --no-merges
# --no-merges filters out the merge commits, shows only feature commits

# "Who has been most active this sprint?"
git log --since="2 weeks ago" --format="%an" | sort | uniq -c | sort -rn
# 47 Priya Sharma
# 31 Rohan Verma
# 28 Arjun Patel
```

---

### Bonus: `git reflog` — Your Ultimate Safety Net

Reflog records every movement of `HEAD` — even resets, rebases, and amends. It's a local-only, time-limited (default 90 days) history of everything that happened in your repo.

```bash
git reflog                         # Full reflog
git reflog --since="2 hours ago"   # Recent entries
```

```
a3f1c2e HEAD@{0}: rebase (finish): returning to refs/heads/feature/search
9b2d4f1 HEAD@{1}: rebase (pick): Add price filter
7e3a1b0 HEAD@{2}: rebase (pick): Add category filter
4c8d2e9 HEAD@{3}: checkout: moving from main to feature/search
f8a2b1d HEAD@{4}: reset --hard HEAD~3    ← dangerous operation recorded here
```

**You ran `git reset --hard` and lost commits — recover them:**

```bash
git reflog
# f8a2b1d HEAD@{4}: commit: Add crucial feature (before the reset)

git switch -c recovery-branch f8a2b1d   # Recover! Create branch at that point
# Or:
git reset --hard f8a2b1d               # Restore HEAD to before the mistake
```

Reflog has saved countless developers from "I just destroyed hours of work" moments. When something goes catastrophically wrong — check reflog first, panic second.

---

### Complete Scenario: A Full Sprint in Practice

```bash
# ── Monday: Start sprint ───────────────────────────────────
git fetch origin
git switch main && git rebase origin/main
git switch -c feature/PROJ-301-order-tracking

# ── Build the feature across multiple work sessions ────────
git commit -m "feat: add order status model"
git commit -m "feat: implement tracking API endpoint"
git commit -m "test: add order tracking tests"
git stash push -m "WIP: webhook handler, half done"  # EOD, not ready to commit

# ── Tuesday: Urgent hotfix needed ─────────────────────────
git switch main
git switch -c hotfix/PROJ-315-payment-timeout
# fix it...
git commit -m "fix: increase payment gateway timeout to 30s (closes #315)"
git switch main
git merge --no-ff hotfix/PROJ-315-payment-timeout
git tag -a v2.3.1 -m "Hotfix: payment gateway timeout"
git push origin main --follow-tags

# ── Back to feature work ──────────────────────────────────
git switch feature/PROJ-301-order-tracking
git stash pop
git commit -m "feat: add webhook handler for shipment updates"

# ── Rebase on latest main before PR ──────────────────────
git fetch origin
git rebase origin/main
# (resolve any conflicts, git rebase --continue)

# ── Clean up commit history ────────────────────────────────
git rebase -i origin/main
# squash small commits into logical units

# ── Push and open PR ──────────────────────────────────────
git push -u origin feature/PROJ-301-order-tracking

# ── Review feedback: add input validation ─────────────────
git add tracking/validators.py
git commit -m "fix: add input validation per code review"
git push origin feature/PROJ-301-order-tracking

# ── PR approved, merged via GitHub (squash and merge) ─────

# ── Post-merge cleanup ────────────────────────────────────
git switch main
git pull origin main
git branch -d feature/PROJ-301-order-tracking

# ── End of sprint: verify with log ───────────────────────
git log --oneline --graph --since="1 week ago"
git log --oneline --author="$(git config user.name)" --since="1 week ago"
```

---

### Master Quick Reference

```
REMOTES         git remote add <name> <url>
                git remote -v / rename / remove / set-url

SYNC            git fetch origin           ← safe, download only
                git pull --rebase          ← fetch + rebase (preferred)
                git push -u origin <branch>

STASH           git stash / git stash pop / git stash list

CHERRY-PICK     git cherry-pick <hash>     ← copy a specific commit

HISTORY EDIT    git commit --amend
                git rebase -i HEAD~N       ← pick, squash, fixup, drop, reword

TAGS            git tag -a v1.0.0 -m "msg" / git push --follow-tags

DEBUG           git blame -L 30,45 file.py    ← who wrote which line
                git bisect start/good/bad/run  ← binary search for bug
                git log -S "string"            ← find when code appeared
                git log --oneline --graph --all --author --since

SAFETY NET      git reflog                 ← recover anything from last 90 days
```

---

# Git Internals, Best Practices & Collaboration at Scale

---

## Part 8: Git Internals — How Git Actually Works

Understanding Git's internals transforms you from someone who memorizes commands to someone who _reasons_ about them. Every Git command is just a manipulation of a small set of simple data structures.

---

### The Git Object Model

Everything Git stores lives in `.git/objects/`. There are exactly **four object types**. Three form the core model: blob, tree, commit.

```
.git/
└── objects/
    ├── 4b/
    │   └── 825dc642cb6eb9a060e54bf8d69288fbee4904   ← blob
    ├── 9d/
    │   └── f32c4f8a8b72d5c2b8e3a1f0d9e6b4c7a2e1d3   ← tree
    ├── a3/
    │   └── f1c2e8b9d4f7a2c5e0b3d6f9a1c4e7b2d5f8a0   ← commit
    └── pack/                                          ← packed objects (efficiency)
```

Every object is identified by a **SHA-1 hash** of its content — 40 hexadecimal characters. The first 2 chars become the directory name; the remaining 38 become the filename. This is content-addressable storage: the name _is_ the content.

---

### SHA-1 Hashing — Content Addressing

```bash
# Git computes: SHA1("blob <size>\0<content>")
echo "Hello, Git" | git hash-object --stdin
# 8ab686eafeb1f44702738c8b0f24f2567c36da6d

# Write it to the object store
echo "Hello, Git" | git hash-object --stdin -w

# Verify it's there
ls .git/objects/8a/
# b686eafeb1f44702738c8b0f24f2567c36da6d

# Read it back
git cat-file -p 8ab686eafeb1f44702738c8b0f24f2567c36da6d
# Hello, Git

git cat-file -t 8ab686eafeb1f44702738c8b0f24f2567c36da6d
# blob
```

**Properties of SHA-1 content addressing:**

```
Same content → always same hash (deterministic)
  "Hello, Git" → 8ab686... on your machine
  "Hello, Git" → 8ab686... on any machine in the world

Different content → different hash (collision-resistant)
  "Hello, Git"  → 8ab686...
  "Hello, Git!" → 3b18e5...    ← completely different

Hash verifies integrity
  If .git/objects/8a/b686... contains corrupted data,
  re-hashing it produces a different hash → Git detects corruption
```

This is why Git is a trustworthy system. You cannot silently corrupt history — the hashes would break.

---

### Object Type 1: Blob — File Content

A **blob** (Binary Large Object) stores the raw content of a file — nothing else. No filename. No permissions. Just bytes.

```bash
# Create a file and hash it
echo "def login(user, password):" > auth.py
git hash-object -w auth.py
# 3f4a2b1c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a

git cat-file -p 3f4a2b1c
# def login(user, password):
```

```
Blob object structure:
┌────────────────────────────────┐
│ blob <size>\0                  │  ← header
│ def login(user, password):\n   │  ← raw file content
│ ...                            │
└────────────────────────────────┘

SHA1 of the above → 3f4a2b1c...
```

Two files with identical content share one blob — Git deduplicates automatically. If you have 100 copies of the same config file across your project, Git stores one blob.

---

### Object Type 2: Tree — Directory Structure

A **tree** maps names and permissions to blobs (files) and other trees (subdirectories). Trees give blobs their names.

```bash
git cat-file -p HEAD^{tree}      # Look at the tree of the current commit
```

```
100644 blob 3f4a2b1c  auth.py
100644 blob 8ab686ea  README.md
040000 tree 9d7f3c2a  src/
100755 blob b2c4d6e8  run.sh
```

Each line is: `<mode> <type> <hash>  <name>`

Modes:

```
100644   Regular file
100755   Executable file
120000   Symbolic link
040000   Directory (another tree)
160000   Gitlink (submodule)
```

```
Tree structure mirrors your filesystem:

Commit
  └── Tree (root)
        ├── blob: README.md
        ├── blob: auth.py
        └── Tree: src/
              ├── blob: models.py
              └── Tree: utils/
                    └── blob: helpers.py
```

```bash
# Inspect nested trees
git cat-file -p HEAD^{tree}
# 040000 tree 9d7f3c2a  src

git cat-file -p 9d7f3c2a
# 100644 blob f2a4c6e8  models.py
# 040000 tree b1d3e5f7  utils

git cat-file -p b1d3e5f7
# 100644 blob a0c2e4f6  helpers.py
```

---

### Object Type 3: Commit — Snapshot + Metadata

A **commit** object ties everything together. It points to a root tree (the entire project snapshot), lists parent commits, and records metadata.

```bash
git cat-file -p HEAD
```

```
tree 9d7f3c2ab4e1d6f8a2c5b7e0d3f6a9c2e5b8d1f4
parent a3f1c2e8b9d4f7a2c5e0b3d6f9a1c4e7b2d5f8a0
author Priya Sharma <priya@company.com> 1709634933 +0530
committer Priya Sharma <priya@company.com> 1709634933 +0530

feat: add OAuth2 Google login support

Implements OAuth2 flow using Google as identity provider.
Stores tokens in Redis with 1-hour TTL.

Closes #142
```

```
Commit object structure:
┌──────────────────────────────────────────────┐
│ tree     → SHA of root tree (full snapshot)  │
│ parent   → SHA of previous commit            │  ← 0 for initial commit
│ parent   → SHA of second parent              │  ← only in merge commits
│ author   → name, email, timestamp            │
│ committer→ name, email, timestamp            │  ← differs after rebase/amend
│ message  → the commit message                │
└──────────────────────────────────────────────┘
SHA1 of all the above → commit hash
```

The `author` is who wrote the change. The `committer` is who applied it to the repo. They differ after cherry-pick, rebase, or `git am` — the original author is preserved.

---

### The Complete Object Graph — Everything Connected

```
git log --oneline
# a3f1c2e (HEAD → main) feat: add OAuth2 login
# 9b2d4f1 Initial commit

Full internal picture:

COMMIT a3f1c2e ──────────────────────────────────────┐
│ tree:   9d7f3c2a                                    │
│ parent: 9b2d4f1                                     │
│ author: Priya                                       │
│ message: feat: add OAuth2...                        │
└─────────┬───────────────────────────────────────────┘
          │
          ▼
TREE 9d7f3c2a (root snapshot) ───────────────────────┐
│ blob  3f4a2b1c  auth.py                             │
│ blob  8ab686ea  README.md                           │
│ tree  b1d3e5f7  src/                                │
└──────┬──────────┬──────────────────────────────────-┘
       │          │
       ▼          ▼
BLOB 3f4a2b1c   TREE b1d3e5f7 (src/)
"def login..."  │ blob f2a4c6e8  models.py
                │ blob a0c2e4f6  helpers.py
                └──────────────────────────

COMMIT 9b2d4f1 (Initial commit) ─────────────────────┐
│ tree:   4c8d2e9a                                    │
│ parent: (none — root commit)                        │
│ author: Priya                                       │
│ message: Initial commit                             │
└─────────┬───────────────────────────────────────────┘
          │
          ▼
TREE 4c8d2e9a (earlier snapshot)
│ blob 8ab686ea  README.md  ← same blob! same hash, deduplicated
│ blob c7d9e1f3  auth.py    ← different blob (earlier version)
```

Notice: `README.md` hasn't changed between commits — both commits point to the same blob `8ab686ea`. This is Git's storage efficiency at work.

---

### Directed Acyclic Graph (DAG)

Git's commit history is a **DAG** — each commit points to its parent(s), forming edges that only go backward in time, and there are no cycles.

```
Directed:   Each edge has direction (child → parent)
Acyclic:    No commit can be its own ancestor
Graph:      Commits are nodes; parent references are edges

Simple linear history (no branches):
A ← B ← C ← D
                ↑ HEAD → main

After branching and merging:
A ← B ← C ← F ← M     ← merge commit M has two parents: F and E
              ↑   ↑
          main    feature
         before   A ← B ← C ← D ← E
         merge                      ↑
                              feature branch

DAG properties enable:
- git log (traverse from HEAD backward)
- git merge (find common ancestor)
- git rebase (replay commits along different path)
- git bisect (binary search the graph)
```

**Finding the common ancestor manually:**

```bash
git merge-base main feature/search
# 4c8d2e9a...    ← this is the commit both branches share
```

Git's three-way merge uses this: it diffs both branches against the common ancestor, then combines the two sets of changes.

---

### HEAD Reference — The Pointer to Your Location

`HEAD` is a file in `.git/HEAD` that tells Git where you are right now.

```bash
cat .git/HEAD
# ref: refs/heads/main         ← symbolic ref: pointing to a branch

cat .git/refs/heads/main
# a3f1c2e8b9d4f7a2c5e0b3d6f9a1c4e7b2d5f8a0   ← that branch's commit hash
```

**The indirection chain:**

```
HEAD → refs/heads/main → a3f1c2e (commit) → tree → blobs
 ↑          ↑                 ↑
.git/HEAD  .git/refs/      .git/objects/
           heads/main
```

When you commit, Git:

1. Creates a new blob for each changed file
2. Creates new trees reflecting the directory structure
3. Creates a new commit object pointing to the root tree and the previous HEAD
4. Updates the branch ref (`refs/heads/main`) to the new commit hash
5. `HEAD` still points to the branch, which now points to the new commit

**Detached HEAD:**

```bash
git checkout a3f1c2e

cat .git/HEAD
# a3f1c2e8b9d4f7a2c5e0b3d6f9a1c4e7b2d5f8a0   ← direct hash, not a branch ref
```

HEAD points directly to a commit instead of through a branch. New commits are made, but no branch moves — so they become unreachable (and eventually garbage collected) if you don't create a branch.

---

### Index (Staging Area) Internals

The index is a binary file at `.git/index` — a flat list of every file Git is tracking, along with their current staged content.

```bash
git ls-files --stage               # Inspect the index
```

```
100644 3f4a2b1c 0  auth/login.py
100644 8ab686ea 0  README.md
100644 f2a4c6e8 0  src/models.py
```

Format: `<mode> <blob-hash> <stage-number>  <path>`

**Stage numbers reveal conflict state:**

```
0 = Normal (no conflict)
1 = Common ancestor version (during conflict)
2 = "Ours" version (HEAD)
3 = "Theirs" version (branch being merged)

During a merge conflict in auth/login.py:
100644 c7d9e1f3 1  auth/login.py   ← base (common ancestor)
100644 3f4a2b1c 2  auth/login.py   ← our version
100644 a9b2c4d6 3  auth/login.py   ← their version

After you resolve and git add:
100644 9e1f3a5b 0  auth/login.py   ← resolved version, back to stage 0
```

**The three-way relationship between index, working tree, and HEAD:**

```
HEAD commit     Index (staging)      Working directory
─────────────   ─────────────────    ──────────────────────
auth.py v1      auth.py v1           auth.py v1        → "Unmodified"
auth.py v1      auth.py v1           auth.py v2        → "Modified, unstaged"
auth.py v1      auth.py v2           auth.py v2        → "Staged"
auth.py v1      auth.py v2           auth.py v3        → "Staged v2, also modified"
(absent)        (absent)             new_file.py       → "Untracked"
auth.py v1      (absent)             (absent)          → "Deleted, staged"
```

`git status` compares two pairs:

- **Index vs HEAD** → "Changes to be committed"
- **Working dir vs Index** → "Changes not staged for commit"

```bash
# Watch the index live as you work
git ls-files --stage               # Before anything
git add auth/login.py
git ls-files --stage               # Hash updates to staged version
git commit
git ls-files --stage               # Now matches HEAD
```

---

## Part 9: Best Practices — Production Standards

### Commit Discipline — Atomic Commits

An **atomic commit** does exactly one logical thing. It should be:

```
Self-contained:   Makes sense in isolation
Reversible:       Can be reverted without side effects on other work
Describable:      One commit message captures the entire change
Deployable:       Codebase works correctly at this commit
```

**Non-atomic (bad):**

```bash
git add .
git commit -m "various fixes and new features"
# This commit touches: a bug fix, a new API endpoint,
# a config change, some refactoring, and a typo fix.
# Impossible to revert just the bug fix.
# Impossible to cherry-pick just the new endpoint.
# git blame is useless — everything points to this commit.
```

**Atomic (good):**

```bash
git add auth/login.py tests/test_login.py
git commit -m "fix: handle None password in login handler"

git add api/orders.py tests/test_orders.py
git commit -m "feat: add order status endpoint GET /api/orders/:id"

git add config/settings.py
git commit -m "chore: increase DB connection pool size to 20"
```

**Logical grouping in practice — using `-p` to split a messy editing session:**

```bash
# You edited auth.py and api.py in one sitting, fixing two unrelated things
git add -p auth.py
# Stage only the login fix hunks → y
# Skip the unrelated refactor hunks → n
git commit -m "fix: handle None password in login"

git add -p auth.py api.py
# Stage the remaining changes
git commit -m "refactor: extract validation into separate module"
```

---

### Commit Messages — Conventional Commits

The **Conventional Commits** specification creates machine-readable, human-meaningful commit history. It powers automated changelogs, semantic versioning, and release tooling.

**Full format:**

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types and when to use them:**

```
feat      New feature for the user (triggers MINOR version bump)
fix       Bug fix for the user (triggers PATCH version bump)
docs      Documentation only
style     Formatting, whitespace (no logic change)
refactor  Code restructure (no feature change, no bug fix)
perf      Performance improvement
test      Adding or correcting tests
build     Build system, dependency changes
ci        CI/CD configuration changes
chore     Routine tasks, maintenance
revert    Reverting a previous commit
```

**Scope** — optional, names the part of the codebase:

```bash
feat(auth): add OAuth2 Google login
fix(payments): handle timeout from Stripe API
refactor(search): extract scoring into separate module
docs(api): add endpoint documentation for /orders
test(auth): add integration tests for OAuth flow
```

**Breaking changes** — two ways to signal:

```bash
# In the footer:
feat(api): change order endpoint response structure

Consolidates address fields into a nested object.

BREAKING CHANGE: `street`, `city`, `zip` are now nested under `address`

# Or with ! in the type line:
feat(api)!: change order endpoint response structure
```

**Real commit message examples:**

```
# Too short — no context
fix: bug fix

# Too long / wrong format
Fixed the thing where users couldn't log in when their password had
special characters by adding proper URL encoding

# Just right
fix(auth): URL-encode password before hashing

Special characters (!, @, #) in passwords were not encoded before
being passed to the hash function, causing authentication failures
for ~8% of users.

Root cause: bcrypt expects raw bytes; urllib.parse.quote was applied
at the wrong layer.

Closes #312
```

**Automated tooling that reads conventional commits:**

```bash
# commitlint: enforce the format in CI
npx commitlint --from HEAD~1

# standard-version: auto-generate CHANGELOG.md and bump version
npx standard-version

# semantic-release: fully automated releases based on commit history
npx semantic-release
```

---

### Repository Hygiene

**`.gitignore` — Comprehensive patterns**

```gitignore
# ── Language: Python ────────────────────────────────
__pycache__/
*.py[cod]
*.pyo
*.pyd
.Python
*.egg-info/
dist/
build/
.eggs/
.pytest_cache/
.mypy_cache/
.ruff_cache/
htmlcov/
.coverage
*.cover

# ── Language: Node.js ────────────────────────────────
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.npm
dist/
.next/
.nuxt/
.cache/

# ── Environment & Secrets ────────────────────────────
.env
.env.local
.env.*.local
.env.production
*.pem
*.key
secrets.yml
credentials.json

# ── IDEs ─────────────────────────────────────────────
.idea/
.vscode/
*.swp
*.swo
.DS_Store
Thumbs.db

# ── Infrastructure ────────────────────────────────────
*.tfstate
*.tfstate.backup
.terraform/
*.tfvars           ← often contain secrets

# ── Logs & Databases ─────────────────────────────────
*.log
*.sqlite
*.db
logs/

# ── OS ───────────────────────────────────────────────
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
```

**Global gitignore** — for patterns that apply to all your repos:

```bash
git config --global core.excludesfile ~/.gitignore_global

# ~/.gitignore_global
.DS_Store
.idea/
.vscode/
*.swp
Thumbs.db
```

**Avoid large binary files:**

```bash
# Check what's large before committing
find . -size +1M -not -path "./.git/*"

# See what's making your repo large
git ls-files | xargs ls -la | sort -k5 -rn | head -20

# .gitattributes to mark binary types
*.png binary
*.jpg binary
*.pdf binary
*.zip binary
```

Large binaries committed to Git cause permanent bloat — they live in `.git/objects/` forever even after deletion. For genuinely large assets use:

```
Git LFS (Large File Storage):    Images, videos, ML models, design files
External storage (S3, GCS):      Build artifacts, release binaries
Package registries (npm, PyPI):  Dependencies — never commit node_modules/
```

---

## Part 10: Security Considerations

### Prevent Committing Secrets

Secrets in git history are **permanently exposed** — even if you delete the file in the next commit, the secret lives in the object store and any clone ever made.

**Pre-commit hooks — catch secrets before they're committed:**

```bash
# Install pre-commit framework
pip install pre-commit

# .pre-commit-config.yaml in repo root
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks

  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: detect-private-key
      - id: check-added-large-files
        args: ['--maxkb=1000']
      - id: check-merge-conflict
      - id: no-commit-to-branch
        args: ['--branch', 'main', '--branch', 'production']

pre-commit install    # Installs the hook into .git/hooks/pre-commit
```

Now `git commit` runs these checks automatically before every commit.

**Using `.env` files correctly:**

```bash
# .env (never committed — in .gitignore)
DATABASE_URL=postgresql://user:secret@localhost/mydb
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxx
JWT_SECRET=my-super-secret-jwt-key

# .env.example (committed — template with no real values)
DATABASE_URL=postgresql://user:password@localhost/dbname
STRIPE_SECRET_KEY=sk_live_your_key_here
JWT_SECRET=your-jwt-secret-here
```

The `.env.example` documents what variables are needed without exposing values. New team members copy it: `cp .env.example .env` then fill in real values.

---

### GitHub Secret Scanning

GitHub automatically scans all pushes for known secret patterns (API keys, tokens, private keys) from 200+ service providers.

```
GitHub → Repository → Settings → Security → Secret scanning

When triggered:
1. GitHub alerts the repository admin by email
2. GitHub notifies the service provider (Stripe, AWS, etc.)
3. The provider may auto-revoke the exposed credential
4. Alert appears in Security tab: "Secret scanning alerts"
```

**Push protection** — block secrets before they reach the remote:

```
Settings → Security → Secret scanning → Push protection → Enable

Now if you try to push a commit containing a secret:
! [rejected]  feature → feature (push declined due to repository rule violations)
  - Push cannot contain secrets.
  - Secret: GitHub Personal Access Token detected
  - Location: config/settings.py:12
```

---

### Removing Secrets from History — Emergency Response

Someone committed an API key three commits ago. Even if you delete it now, the key is in the object store. **Immediate actions:**

**Step 1: Revoke the secret first.** Rotate the key/token in the service provider immediately — before rewriting history. Assume it's already been compromised.

**Step 2: Remove from history using `git filter-repo` (preferred over deprecated `filter-branch`):**

```bash
# Install git-filter-repo
pip install git-filter-repo

# Remove a specific file entirely from all history
git filter-repo --path config/secrets.py --invert-paths

# Replace a specific secret string throughout all history
git filter-repo --replace-text <(echo 'sk_live_xxxx==>REMOVED_SECRET')

# Remove a pattern from all files in all commits
git filter-repo --replace-text expressions.txt
# expressions.txt:
# sk_live_xxxxxxxxxxxx==>REMOVED_SECRET
# my-db-password==>REMOVED_SECRET
```

**Step 3: Force push all branches:**

```bash
git push origin --force --all
git push origin --force --tags
```

**Step 4: Notify all collaborators** — their local clones still have the old history. Everyone must re-clone:

```bash
git clone https://github.com/org/project.git project-clean
```

**Step 5: Contact GitHub support** to purge cached views if the commit was public.

---

### Token Management

**Personal Access Tokens (PAT):**

```
GitHub → Settings → Developer settings → Personal access tokens

Best practices:
- Use fine-grained tokens (repo-specific, not account-wide)
- Set expiration (90 days max; shorter is better)
- Grant minimum required scopes only
- One token per machine/application — makes revocation surgical
- Store in OS keychain, password manager, or secrets manager
- Never in code, config files, or environment variables in CI without masking
```

**SSH key hygiene:**

```bash
# Use different keys for different contexts
~/.ssh/id_ed25519_github_personal
~/.ssh/id_ed25519_github_work
~/.ssh/id_ed25519_deploy_production

# Rotate keys annually or when a device is lost/compromised
# Remove old public keys from GitHub: Settings → SSH keys

# Require passphrase on private keys
ssh-keygen -t ed25519 -C "work laptop 2024" -f ~/.ssh/id_ed25519_work
# Enter passphrase: ← always set this

# Add to agent so you don't type it constantly
ssh-add ~/.ssh/id_ed25519_work
```

---

## Part 11: Collaboration at Scale

### Protected Branches

Protected branches enforce rules on important branches (`main`, `production`, `release/*`) — no direct pushes, required reviews, required CI passes.

```
GitHub → Repository → Settings → Branches → Add branch ruleset

Key protection rules:

Restrict pushes:
  ✓ Require pull request before merging
  ✓ Required approvals: 2
  ✓ Dismiss stale reviews when new commits pushed
  ✓ Require review from code owners

Status checks:
  ✓ Require status checks to pass before merging
  ✓ Required checks: [ci/build, ci/test, ci/lint, security/scan]
  ✓ Require branches to be up to date before merging

History:
  ✓ Require linear history (no merge commits — forces squash or rebase)
  ✓ Require signed commits (GPG-verified)

Admin bypass:
  □ Do not allow bypassing the above settings
  ← Even admins can't force-push to main
```

**Rulesets vs Branch Protection Rules:**

```
Branch Protection Rules: older system, per-branch configuration
Rulesets (2023+):        newer system, can apply to multiple branches
                         by pattern, can apply to tags, more granular
```

---

### Required Reviewers and Review Patterns

```
Settings → Branches → main:
  Required approving reviews: 2

For effective code review at scale:

Review assignment strategies:
  Round robin:    Evenly distributes load across all reviewers
  Load balance:   Assigns to reviewer with fewest pending reviews
  Manual:         PR author chooses reviewers

Review SLAs (team agreement, not GitHub feature):
  p0 (critical bug fix):  Review within 2 hours
  p1 (feature):           Review within 24 hours
  p2 (docs, chore):       Review within 48 hours

Draft PRs:
  Opened as "Draft" — signals "not ready for review, but visible"
  git push origin feature/payments
  → Open PR as Draft for early visibility
  → Mark "Ready for review" when complete
  → Reviewers are notified only then
```

---

### CODEOWNERS — Automatic Review Assignment

`CODEOWNERS` defines who owns which parts of the codebase. When a PR touches owned files, those owners are automatically added as required reviewers.

```bash
# .github/CODEOWNERS

# Global fallback — catches everything not matched below
*                           @org/platform-team

# Specific directories
/src/auth/                  @priya-sharma @rohan-verma
/src/payments/              @payments-team
/infrastructure/            @devops-team @arjun-patel
/docs/                      @tech-writers

# Specific file types
*.sql                       @database-team
*.tf                        @devops-team          # Terraform files

# Specific files
/package.json               @frontend-lead
/requirements.txt           @backend-lead
/.github/                   @platform-team
/Makefile                   @platform-team

# Nested patterns
/src/api/v2/                @api-team
```

**How it works in practice:**

```
Developer submits PR touching:
  - src/auth/login.py           → @priya-sharma and @rohan-verma auto-assigned
  - src/payments/processor.py   → @payments-team auto-assigned
  - infrastructure/k8s/         → @devops-team and @arjun-patel auto-assigned

All three teams must approve before PR can merge to main.
This is enforced — not optional.
```

---

### Monorepo vs Polyrepo

This is one of the most consequential architectural decisions for a growing engineering team.

**Polyrepo — One repository per service/library:**

```
github.com/company/
├── frontend-app          (React SPA)
├── api-gateway           (Node.js)
├── auth-service          (Python)
├── payment-service       (Go)
├── notification-service  (Python)
├── shared-ui-library     (React components)
└── shared-python-utils   (Python utilities)
```

```
Advantages:
  ✓ Clear ownership and autonomy per team
  ✓ Independent deployment pipelines
  ✓ Independent versioning and release cadence
  ✓ Smaller repos are faster to clone, CI is scoped
  ✓ Access control is natural (per-repo permissions)

Disadvantages:
  ✗ Cross-service changes require multiple PRs and coordination
  ✗ Shared library versioning hell ("which version of shared-utils?")
  ✗ Tooling and standards drift between repos
  ✗ Hard to do atomic refactors across service boundaries
  ✗ Dependency management becomes a full-time job
```

**Monorepo — All code in one repository:**

```
github.com/company/platform/
├── apps/
│   ├── frontend/
│   ├── api-gateway/
│   └── admin-panel/
├── services/
│   ├── auth/
│   ├── payments/
│   └── notifications/
├── packages/
│   ├── shared-ui/
│   ├── shared-utils/
│   └── api-contracts/
├── infrastructure/
└── tools/
```

```
Advantages:
  ✓ Atomic cross-service changes in one PR
  ✓ Shared libraries at head — no version lag
  ✓ Consistent tooling, linting, testing standards
  ✓ Easier refactoring across boundaries
  ✓ One place to search, one CI system

Disadvantages:
  ✗ CI must be scoped carefully (build only what changed)
  ✗ Git operations slow at extreme scale (millions of files)
  ✗ Access control is coarser (mitigated by CODEOWNERS)
  ✗ Requires investment in monorepo tooling
```

**Monorepo tooling that solves the scaling problems:**

```bash
# Nx — Smart build system with computation caching
npx create-nx-workspace company-platform
nx affected:build   # Build only services affected by current changes
nx affected:test    # Test only what's affected

# Turborepo — Fast monorepo build system (Vercel)
npx create-turbo
turbo run build --filter=@company/auth-service...

# Bazel — Google's build system (used at extreme scale)
bazel build //services/auth:server
bazel test //services/auth/...

# Changesets — Manages versioning in JS/TS monorepos
npx changeset          # Declare what changed and impact
npx changeset version  # Bump versions
npx changeset publish  # Publish to npm
```

**Affected-only CI — critical for monorepo performance:**

```yaml
# .github/workflows/ci.yml
jobs:
  determine-changes:
    outputs:
      auth-changed: ${{ steps.changes.outputs.auth }}
      payments-changed: ${{ steps.changes.outputs.payments }}
    steps:
      - uses: dorny/paths-filter@v2
        id: changes
        with:
          filters: |
            auth:
              - 'services/auth/**'
            payments:
              - 'services/payments/**'

  test-auth:
    needs: determine-changes
    if: needs.determine-changes.outputs.auth-changed == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: cd services/auth && pytest

  test-payments:
    needs: determine-changes
    if: needs.determine-changes.outputs.payments-changed == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: cd services/payments && go test ./...
```

**Who uses what:**

```
Monorepo:   Google, Meta, Twitter/X, Microsoft, Airbnb, Uber (internal tools)
Polyrepo:   Most startups and mid-size companies, Netflix (microservices)
Hybrid:     Amazon (monorepos per team/domain, not whole company)

Decision framework:
  < 5 engineers:       Single repo, don't over-engineer
  5–50 engineers:      Polyrepo usually fine; consider monorepo if shared libs
  50+ engineers:       Monorepo shows its value; requires tooling investment
  Tight coupling:      Monorepo (auth + payments call each other constantly)
  Loose coupling:      Polyrepo (independent services, separate teams)
```

---

### Production Git Configuration — Complete Setup

```bash
# Identity
git config --global user.name "Priya Sharma"
git config --global user.email "priya@company.com"
git config --global user.signingkey <gpg-key-id>   # For signed commits

# Defaults
git config --global init.defaultBranch main
git config --global pull.rebase true               # Always rebase on pull
git config --global rebase.autoStash true          # Auto-stash before rebase
git config --global push.default current           # Push current branch by default
git config --global merge.ff false                 # Always create merge commits

# Safety
git config --global push.autoSetupRemote true      # Auto-create remote branch

# Quality of life
git config --global core.editor "code --wait"      # VS Code as editor
git config --global diff.tool vscode
git config --global rerere.enabled true            # Remember conflict resolutions

# Useful aliases
git config --global alias.lg "log --oneline --graph --all"
git config --global alias.st "status -s"
git config --global alias.undo "reset --soft HEAD~1"
git config --global alias.aliases "config --get-regexp alias"
git config --global alias.wip '!git add -A && git commit -m "WIP"'
git config --global alias.unwip 'reset HEAD~1'
git config --global alias.recent 'branch --sort=-committerdate --format="%(refname:short)" -10'
```

---

### The Full Mental Model — Everything Together

```
┌─────────────────────── Git Internals ─────────────────────────┐
│                                                                │
│  Working Dir ──add──► Index ──commit──► Object Store          │
│                                         (blobs/trees/commits) │
│                                              │                │
│  HEAD → branch ref → commit → tree → blobs  │                │
│                                         DAG of commits        │
└────────────────────────────────────────────────────────────────┘

┌────────────────── Local Workflow ─────────────────────────────┐
│  init/clone → branch → add (-p) → commit (conventional)       │
│  → rebase -i (clean history) → push                           │
└────────────────────────────────────────────────────────────────┘

┌────────────────── Team Workflow ──────────────────────────────┐
│  fork/clone → feature branch → PR → review → merge           │
│  CODEOWNERS → protected main → CI must pass → squash merge    │
└────────────────────────────────────────────────────────────────┘

┌────────────────── Security Layer ─────────────────────────────┐
│  pre-commit hooks → secret scanning → .gitignore              │
│  no secrets in history → PAT rotation → SSH passphrases       │
└────────────────────────────────────────────────────────────────┘

┌────────────────── Scale Layer ────────────────────────────────┐
│  protected branches → CODEOWNERS → required reviews           │
│  monorepo tooling → affected-only CI → conventional commits   │
│  → automated changelog → semantic versioning → signed tags    │
└────────────────────────────────────────────────────────────────┘
```

---
