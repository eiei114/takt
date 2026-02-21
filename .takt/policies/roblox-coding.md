# Roblox TypeScript Coding Policy

## Absolute Rules (Violation = REJECT)

| Rule | Criteria |
|------|----------|
| Client/Server separation | Code must be in the correct realm directory |
| Network events in common/shared | All event contracts in `places/common/src/shared/network/` |
| Server-side validation | Never trust client-sent data without validation |
| No Node.js APIs in game code | `fs`, `path`, `process`, etc. are prohibited |
| No `.js` import extensions | roblox-ts convention |
| Type-safe remotes | No untyped RemoteEvents; use Flamework Networking |
| No `any` type | Strict TypeScript mode; use proper types |

## Warnings (Should fix, but not blocking)

| Rule | Criteria |
|------|----------|
| Use `@rbxts/services` | Prefer over `game.GetService()` |
| File length | Consider splitting files over 300 lines |
| Missing lifecycle hooks | Use `OnStart`/`OnInit`, not constructor side effects |

## Build Verification

- Always run `pnpm run build` after changes
- Always run `pnpm run lint` after changes
- Build errors are blockers, not warnings

## Entry Point Updates

When adding new services/controllers/components, ensure the corresponding
`Flamework.addPaths()` call includes the directory in:
- `places/main/src/server/main.server.ts` (for server)
- `places/main/src/client/main.client.ts` (for client)

## Rojo Mapping

When creating files in new directories, verify the Rojo mapping in
`default.project.json` covers the path. Unmapped directories won't
appear in Roblox Studio.
