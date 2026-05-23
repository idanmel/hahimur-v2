Slice a feature into thin, vertical, deployable steps using the principles from CLAUDE.md.

The user describes a feature they want to build. Your job is to produce a sliced plan — not to implement it yet.

---

## Step 0 — Align before planning

Ask questions until you are 90% confident you understand what needs to be built. Do not start slicing until you reach that threshold.

Focus questions on:
- What user problem does this solve?
- What does success look like from the user's perspective?
- What are the must-haves vs. nice-to-haves?
- Are there constraints (tech, time, scope) you need to know about?

Ask one round of questions at a time. Wait for answers before asking more. Once you are 90% confident, say so and move on to slicing.

## Step 1 — Understand the feature

Summarize your understanding of the feature in 2-3 sentences before slicing.

## Step 2 — Identify the thinnest vertical slice

A vertical slice touches every layer (UI → logic → storage/API) but does the minimum in each. Ask:
- What is the one happy-path scenario that proves the feature works end-to-end?
- What can be hardcoded, stubbed, or left ugly for now without losing the learning?
- Can this slice be deployed and shown to a real user today?

## Step 3 — Slice the rest

Split the remaining work into subsequent slices. Each slice must:
- Stand alone as deployable, working software
- Add one new capability or remove one constraint from the previous slice
- Take less than 3 minutes (if it feels bigger, cut it again)
- Start with a failing test that defines done

Order slices by what teaches us the most first, not by technical convenience.

## Step 4 — Review against CLAUDE.md

Before presenting the plan, check each slice:
- [ ] Is it vertical (UI → logic → data), not horizontal (all-DB, all-UI)?
- [ ] Is it thin enough to ship alone?
- [ ] Does it end with working software a user can touch?
- [ ] Does it start with a failing test?
- [ ] Does it take <3 minutes? If not, cut smaller.
- [ ] Does each slice answer: "what will we learn that we don't know yet?"

If any slice fails a check, cut it smaller before presenting.

## Output format

Present the plan as an ordered list:

**Slice N — [Name]**
- What it does (one sentence, user-visible)
- What it skips / stubs out
- The failing test that defines done (BDD format):
  - Given [starting context]
  - When [action]
  - Then [observable outcome]
- What we'll learn from it

End with: "Here are the slices for your review."
