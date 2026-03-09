# Claude CTO Review Prompt

Read these files first:
- `/Users/sanchal/pixelport-launchpad/AGENTS.md`
- `/Users/sanchal/pixelport-launchpad/docs/SESSION-LOG.md`
- `/Users/sanchal/pixelport-launchpad/docs/ACTIVE-PLAN.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-workflow.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-08-workspace-canonical-architecture.md`
- `/Users/sanchal/pixelport-launchpad/docs/build-briefs/2026-03-08-foundation-slice.md`

Context:
- This is a high-risk architecture replacement for PixelPort’s runtime/dashboard/control-plane model.
- The goal is to replace the earlier Supabase-canonical runtime/admin direction with a technically grounded architecture based on actual repo truth and real OpenClaw capabilities.
- The brief intentionally redesigns some earlier founder preferences where they were operationally weak.

Your task:
- Review the architecture brief and the proposed first implementation slice like a strict CTO reviewer.
- Focus on technical correctness, breakage risk, incorrect OpenClaw assumptions, hidden complexity, and sequencing risk.
- Treat this as a pre-implementation architecture gate.

Please answer in this exact format:

```md
Verdict: APPROVED
```

or

```md
Verdict: BLOCKED
```

Then include:
- findings first, ordered by severity
- file references for each real finding
- which OpenClaw assumptions are valid vs weak
- truth-model risks
- projection drift risks
- durability and recovery risks
- admin-surface safety risks
- whether the first foundation slice is truly the smallest correct slice
- what you checked
- residual risks

If approved, end with this exact line:

`Approved to merge and use as the next implementation basis.`
