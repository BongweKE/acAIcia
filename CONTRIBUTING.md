# acAIcia Contributing Guidelines & Standard Operating Procedures (SOPs)

Welcome to the **acAIcia** project! Due to our unique architecture, strict uptime requirements, and complex multi-agent structure, all contributions must strictly adhere to this SOP.

## 1. Governance & CI/CD Lifecycle

We enforce a strict branching and environment progression strategy:
- **`main`**: The production branch. Direct pushes are restricted.
- **`staging`**: The pre-production testing branch.
- **Feature Branches**: `feat/issue-ID-name` or `fix/issue-ID-name`.

### Workflow
1. **GitHub Issues**: Every change must map to a tracked GitHub Issue.
2. **Solution Planning & ADRs**: Significant changes (e.g., adding Langfuse, pgvector caches, or changing LLM gateways) require an Architecture Decision Record (ADR) stored in `docs/adrs/`. 
3. **Implementation**: Code locally on your feature branch. Write comprehensive tests (all 117+ tests must pass).
4. **Pull Request (PR)**: Target the `staging` branch. This triggers the Automated CI Evaluation Gate (.github/workflows/ci.yml).
5. **Staging Review**: Once CI passes, review on the staging environment.
6. **Promotion to Prod**: Merge `staging` into `main` to trigger the production deployment via Railway.

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
