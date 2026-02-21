# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

Roblox TypeScript game project using Flamework (DI framework), Rojo (file sync), and roblox-ts (TS->Luau compiler). Multi-place architecture with shared networking.

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm run build` | Compile TypeScript to Luau via rbxtsc |
| `pnpm run watch` | Watch mode compilation |
| `pnpm run serve` | Start Rojo dev server for Studio sync |
| `pnpm run build:place` | Build .rbxlx place file |
| `pnpm run lint` | ESLint on places/**/*.ts |

## Architecture

- `places/common/src/shared/` - Shared types and network event contracts
- `places/main/src/client/` - Client code (controllers, components)
- `places/main/src/server/` - Server code (services, components)
- `places/main/src/shared/` - Place-specific shared code
- `default.project.json` - Rojo file-to-Roblox mapping

## Key Rules

1. **No Node.js APIs** in game code (runs in Luau VM)
2. **No `.js` extensions** in imports
3. **Client/server separation** is absolute
4. **Network events** defined only in `places/common/src/shared/network/events.ts`
5. **Flamework.addPaths()** must include directories for new services/controllers
6. Always verify builds: `pnpm run build && pnpm run lint`
7. Use `@rbxts/services` for Roblox service access
8. TypeScript strict mode, no `any`

## Takt Integration

This project uses takt for AI orchestration. Run `npx takt` for interactive mode.
Custom pieces are in `.takt/pieces/`. See AGENTS.md for details.
