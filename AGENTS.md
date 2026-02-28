# AGENTS.md

Agent instructions and environment requirements for **po-npr** – the push-only, no-pull-request automated conflict resolver.

---

## Language & Runtime

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | 22 LTS (≥ 22.0.0) | Current Long-Term Support line |
| **TypeScript** | 5.9.x | Strict mode enabled |
| **npm** | 10.x or 11.x | Bundled with Node.js 22 LTS |
| **Bash** | 5.x | Required for the entry-point script |
| **Git** | 2.43+ | Must be on `PATH` |

> [!NOTE]
> The project was developed and tested against Node.js **v24** and TypeScript **5.9.3**.  
> Any Node.js ≥ 22 LTS release will work.

---

## Project Layout

```
po-npr/
├── src/
│   └── resolve-conflicts.ts   # TypeScript source – core logic
├── scripts/
│   └── auto-push.sh           # Bash entry-point (build + run)
├── dist/                      # Compiled JS output (git-ignored)
├── package.json
├── tsconfig.json
├── AGENTS.md                  # ← you are here
└── README.md
```

---

## How It Works

`auto-push.sh` compiles the TypeScript source (if needed) and executes the compiled resolver.  
The resolver follows this workflow:

```
git fetch origin
   └─▶ fast-forward / merge
         └─▶ auto-resolve conflicts (--ours or --theirs)
               └─▶ git commit
                     └─▶ git push origin <branch>
                           └─▶ ✅ done – no pull request
```

---

## Quick Start

```bash
# First time – install dependencies
npm install

# Build TypeScript
npm run build

# Run via bash script (builds automatically if needed)
./scripts/auto-push.sh

# Choose conflict strategy
./scripts/auto-push.sh --strategy theirs

# Override remote and commit message
./scripts/auto-push.sh --remote upstream --message "fix: auto-resolved"
```

---

## Configuration (Environment Variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `CONFLICT_STRATEGY` | `ours` | `ours` keeps local changes; `theirs` accepts incoming |
| `GIT_REMOTE` | `origin` | Name of the git remote to push to |
| `COMMIT_MESSAGE` | `chore: auto-resolve conflicts [skip ci]` | Commit message used when auto-resolving |

---

## Agent Usage

When an AI agent calls this script to resolve conflicts automatically:

1. **Checkout** the working branch (never operate in detached HEAD).
2. **Set environment variables** as needed (e.g. `CONFLICT_STRATEGY=ours`).
3. **Run** `./scripts/auto-push.sh`.
4. The script will **push directly** to the remote branch – no pull request is created.
5. Check the exit code: `0` = success, non-zero = failure with message on stderr.

### Example (CI / agent invocation)

```bash
export CONFLICT_STRATEGY=ours
export COMMIT_MESSAGE="chore: agent auto-resolved conflicts [skip ci]"
./scripts/auto-push.sh
```

---

## Build & Development

```bash
# Install deps
npm install

# Compile TypeScript → dist/
npm run build

# Run compiled output directly
npm start
```

---

## Security Notes

- The script **only pushes to the branch it is currently on**; it never changes branches or creates new ones.
- `COMMIT_MESSAGE` is passed as a CLI argument to `git commit -m`; avoid untrusted user input in that variable.
- No tokens or credentials are managed by this script – rely on the ambient git credential store or SSH keys.
