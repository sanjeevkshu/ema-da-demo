---
name: prompt-library
description: Keep reference/delivery-playbook/PROMPT-LIBRARY.md current. Use without being asked at the end of a working session (or when the user wraps up, e.g. "we will conclude here"), and whenever a prompt pattern proves reusable, a new kind of work appears (new ADLC phase activity, role or integration), or the user asks to capture, review or reuse prompts.
---

# Prompt library (sanjeevkshu / ema-da-demo)

`reference/delivery-playbook/PROMPT-LIBRARY.md` holds the reusable prompts from
PULSE delivery work. Each prompt is mapped to an ADLC phase (P0–P8), a Frontier
Engineering level (F1–F4) and the engineering roles that use it.

## When to update (no request needed)

| Trigger | Do |
|---|---|
| A session wraps up | Review that session's prompts and add or refine patterns |
| A prompt worked first time for a new kind of task | Add it as a template |
| A prompt needed several rounds to land | Refine the existing template with the missing constraint or definition of done, e.g. "ensure no regression", "advise and ask for confirmation" |
| A standing rule was created (AGENTS.md or a skill) | Record the prompt that created it, at level F4 |
| Prompt mix shifts noticeably (e.g. release handoffs drop once PRs are automated) | Update "What the prompts show" |

Skip one-off chatter: confirmations ("yes, go ahead"), status replies and
single-use questions.

## How to write an entry

- **ID:** `P{phase}.{n}`, the next free number in its phase. Never renumber existing IDs; other docs may cite them.
- **Template:** the user's wording, generalised with `{placeholders}`. Keep their guardrail phrases.
- **Role:** codes from the Frameworks section. **Level:** F1–F4, meaning how much the agent did unasked.
- **Seen:** the session code, e.g. S4. When a session adds entries, add a row to "Source sessions" and a line to the changelog.
- Change a row in place rather than duplicating a pattern.

## Rules

- The repo is **public**. Never add prices, credit rates, margins, client names,
  credentials, emails, org IDs or datastream IDs. The AI-credit cost model is kept
  outside git on purpose.
- Docs only. The file isn't served (`*.md` is in `.hlxignore`) and needs no tests.
- Tell the user in one line what changed ("Prompt library: added P3.7, refined P4.4").
