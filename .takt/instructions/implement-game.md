Implement the game feature according to the plan.
Refer only to files within the Report Directory shown in the Piece Context.

**Reports to reference:**
- Plan: {report:00-plan.md}

**Roblox-TS implementation checklist:**
1. Identify whether the feature is client-side, server-side, or both
2. Define any new network events in `places/common/src/shared/network/events.ts`
3. Create server services in `places/main/src/server/services/`
4. Create client controllers in `places/main/src/client/controllers/`
5. Create components in appropriate `components/` directory with correct tags
6. Update `Flamework.addPaths()` if new directories are introduced
7. Verify Rojo mapping in `default.project.json` if new paths are needed
8. Run `pnpm run build` and `pnpm run lint` to verify

**Required output (include headings):**

## Work results
- {Summary of actions taken}

## Changes made
- {List of files created/modified with brief description}

## Build verification
- {Output of pnpm run build}

## Lint verification
- {Output of pnpm run lint}
