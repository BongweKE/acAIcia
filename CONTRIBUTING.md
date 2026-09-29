# acAIcia Contributing Guidelines & Standard Operating Procedures (SOPs)

Welcome to the **acAIcia** project! Due to our unique architecture, strict uptime requirements, and complex multi-agent structure, all contributions must strictly adhere to this SOP.

> [!CAUTION]
> **DIRECT PUSHES TO `main` OR `staging` ARE STRICTLY PROHIBITED.**
> All commits to protected branches MUST arrive via merged Pull Requests. Direct pushes trigger `.github/workflows/main-guard.yml` and will be flagged as security/governance violations.
> Full operating details: see [SOP 001: Branching, Pull Request & Deployment Governance](docs/sops/branch-and-pr-governance.md).

## 1. Governance & CI/CD Lifecycle

We enforce a strict branching and environment progression strategy:
- **`main`**: The production branch. Protected by `main-guard.yml`. Pushes must only originate from merged PRs.
- **`staging`**: The pre-production testing branch. Direct pushes are prohibited.
- **Feature Branches**: `feat/<issue-id>-<name>`, `fix/<issue-id>-<name>`, or `docs/<name>`.

### Workflow
1. **GitHub Issues**: Every change must map to a tracked GitHub Issue (`gh issue list`).
2. **Solution Planning & ADRs**: Significant changes (e.g., adding Langfuse, pgvector caches, or changing LLM gateways) require an Architecture Decision Record (ADR) stored in `docs/adrs/`. 
3. **Branching**: Branch from latest `main` or `staging` (`git checkout -b feat/...`).
4. **Local Verification**: Pass all 125+ tests (`.venv/bin/pytest tests/`) and frontend typecheck (`npm run build`).
5. **Pull Request (PR)**: Open PR targeting `staging` (`gh pr create`). This triggers automated CI gates (`pr.yml`, `eval-gate.yml`).
6. **PR Review & Merge**: Once CI passes, merge via `gh pr merge --squash` or `gh pr merge --merge`.
7. **Promotion to Prod**: Merge `staging` into `main` via PR to trigger the production deployment.

## 2. ADR Requirements

Before implementing a complex feature (e.g., Issue #19 Multi-Replica Shared Query Status Store, Issue #6 Native pgvector Semantic Cache), you MUST write an ADR:
- **Format**: Follow the standard format (Title, Context, Decision, Consequences).
- **Review**: The ADR must be peer-reviewed before implementation begins.

## 3. Development Guidelines

- **Environment**: Always use `.venv/` for Python commands. Frontend commands must be run within `frontend/` using Node.js v20+.
- **Tests**: Do not weaken or delete existing tests to make changes look successful.
- **Security**: Zero hardcoded secrets. Use environment variables. Do not alter RLS deny-by-default rules on public tables without an ADR.

## 4. Specific Rollout Plans (Next Phases)

### Phase 1: Streaming & Gateway
- **Issue #1**: Ensure SSE Streaming works perfectly in staging before prod.
- **Issue #2 (LiteLLM)**: Gateway must default to `mistral`, with `modal` as a backup.

### Phase 2: State & Storage
- **Issue #19**: Multi-replica shared store MUST be deployed to staging and proven safe *before* we scale Railway replicas.
- **Issue #6**: pgvector must run alongside in-memory caches in a shadow-mode before hard cutover.

### Phase 3: Observability & Quality
- **Issue #8**: Automated CI Gate runs all `tests/`. Must block PRs if score drops.
- **Issue #7**: Langfuse tracing must be implemented cleanly across all agents without adding latency to the main critical path.
