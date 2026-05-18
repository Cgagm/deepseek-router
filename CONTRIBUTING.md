# Contributing to DeepSeek Router

Thanks for contributing. This document covers how to get set up and what standards we follow.

## Setup

```bash
git clone https://github.com/chengang/deepseek-router.git
cd deepseek-router
pnpm install
pnpm run build
```

## Development workflow

```bash
# Start TypeScript in watch mode
pnpm run dev

# Run tests (must pass before PR)
pnpm run test

# Type check
pnpm run typecheck

# Format (Prettier)
pnpm run format

# Lint
pnpm run lint
```

## Commit style

- `feat:` new feature
- `fix:` bug fix
- `refactor:` code change that neither fixes a bug nor adds a feature
- `test:` adding or updating tests
- `docs:` documentation only
- `chore:` tooling, CI, dependencies

## Code standards

- TypeScript strict mode — `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`
- No semicolons, single quotes, trailing commas (Prettier)
- No default exports — named exports only
- Typed errors — use the error classes in `src/types/index.ts`, never throw string errors
- Circuit breaker state machine must be tested for all transitions
- New adapters must handle: system prompt, tool_use, tool_result, tool_choice, stop_sequences
- SSE processing must preserve block index ordering

## Testing

- Unit tests use Vitest
- Coverage threshold: 70% (branches, functions, lines, statements)
- Run with coverage: `cd packages/core && npx vitest run --coverage`
- Test files live in `packages/core/__tests__/`

## PR checklist

- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run test` passes
- [ ] `pnpm run format` passes
- [ ] Coverage stays above 70%
- [ ] New public API is exported from `src/index.ts`
- [ ] New error types extend `RouterError`

## Adding a new provider

1. Add default config in `src/config/loader.ts` (`DEFAULT_PROVIDERS`)
2. If the provider uses a new format, add translation in `src/providers/adapter.ts`
3. If the provider uses a new auth type, handle it in both `anthropicToOpenAI` and `prepareAnthropicRequest`
4. Add the provider to `router.config.example.json`
5. Add a setup guide in `docs/providers/`
6. Update the provider table in `README.md`
