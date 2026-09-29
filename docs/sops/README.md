# Standard Operating Procedures (SOPs)

This directory contains binding operational standards for the **acAIcia** platform, multi-agent RAG pipeline, and development infrastructure.

## Catalog of SOPs

| SOP ID | Title | Status | Scope |
| :--- | :--- | :--- | :--- |
| [SOP 001](branch-and-pr-governance.md) | **Branching, Pull Request & Deployment Governance** | **ACTIVE & MANDATORY** | Git branching, PR requirements, CI evaluation gate, promotion protocol, zero direct pushes. |

---

## SOP Lifecycle & Rules

1. **Mandatory Compliance**: All human contributors and autonomous AI coding agents MUST follow active SOPs.
2. **Updates & Amendments**: Any change to an SOP must be proposed via a feature branch and merged via Pull Request with peer review.
3. **Relation to ADRs**:
   - **ADRs (`docs/adrs/`)**: Record *why* architectural, data, and design decisions were made.
   - **SOPs (`docs/sops/`)**: Define *how* operations, deployments, and development practices must be executed.
