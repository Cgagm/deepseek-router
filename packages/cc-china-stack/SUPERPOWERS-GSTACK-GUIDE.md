# Superpowers + gstack Guide for CC China Stack Users

CC China Stack saves you money on API costs (~$0.14/M vs $15/M on official Claude). To boost code quality alongside cost savings, pair it with two free engineering frameworks.

## The 9-Step Collaborative Workflow

### Phase 1: Plan (gstack)
1. **CEO Review** — `/plan-ceo-review` validates your idea against business goals
2. **Engineering Review** — `/plan-eng-review` designs the technical approach
3. **Design Review** — `/design-consultation` ensures UI/UX consistency

### Phase 2: Build (Superpowers)
4. **TDD** — Write failing tests first, then implement
5. **Brainstorming** — Explore edge cases before coding
6. **Systematic Debugging** — Isolate variables, find root cause

### Phase 3: Review (gstack + Superpowers)
7. **Code Review** — `/review` checks for bugs, security, architecture
8. **QA Testing** — `/qa` tests the feature in a real browser
9. **Ship** — `/ship` prepares the PR, runs checks, deploys

## Installation

### gstack
```bash
git clone https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
```

### Superpowers
In Claude Code: `/plugin install superpowers@claude-plugins-official`

## Cost Comparison

| | Without CC China Stack | With CC China Stack |
|---|---|---|
| API cost (Claude) | $15/M tokens | - |
| API cost (DeepSeek) | - | $0.14/M tokens |
| Code review (manual) | 30 min | 2 min (gstack) |
| QA testing (manual) | 30 min | 5 min (gstack) |
| **Total per feature** | **~$5 + 60 min** | **~$0.05 + 7 min** |

## Recommended Default Stack

```
CC China Stack (API savings)
  + gstack (engineering team automation)
  + Superpowers (engineering discipline)
  = 100x cheaper API + automated code review + TDD enforcement
```

All three are free or one-time purchase. No subscriptions.
