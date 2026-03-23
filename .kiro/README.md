# Kiro specifications

Each feature spec is a folder under `specs/` containing:

| File | Purpose |
|------|---------|
| `.config.kiro` | Spec id, `workflowType`, `specType` |
| `requirements.md` | User stories and acceptance criteria |
| `design.md` | Architecture, components, correctness **properties** |
| `tasks.md` | Checkbox implementation plan with requirement traceability |

## Active specs

| Spec | Description |
|------|-------------|
| `github-classroom-support/` | Core inQspace GitHub Classroom workflow |
| `xapi-lrs-integration/` | xAPI / Tin Can statements to external LRS |
| `iframe-embed-guided-lectures/` | Embed inQspace in third-party lecture pages |

Workflow: **requirements-first** — refine requirements, then design (properties), then tasks, then implement in task order.
