# Roblox TypeScript Project Knowledge

## Project Structure

This is a multi-place roblox-ts project using Flamework:

```
places/
  common/src/shared/          # Shared types, network event contracts
    network/events.ts         # GlobalEvents (Flamework Networking)
    types/                    # Shared type definitions
  main/src/
    client/                   # StarterPlayerScripts
      controllers/            # Flamework Controllers (client singletons)
      components/             # Flamework Components (client-side)
      networking/events.ts    # Client event re-exports (createClient)
      main.client.ts          # Client entry point
    server/                   # ServerScriptService
      services/               # Flamework Services (server singletons)
      components/             # Flamework Components (server-side)
      networking/events.ts    # Server event re-exports (createServer)
      main.server.ts          # Server entry point
    shared/                   # Place-specific shared code
```

## Build Toolchain

| Tool | Command | Purpose |
|------|---------|---------|
| rbxtsc | `pnpm run build` | Compile TypeScript to Luau (`out/`) |
| rbxtsc --watch | `pnpm run watch` | Watch mode compilation |
| rojo serve | `pnpm run serve` | Sync `out/` to Roblox Studio |
| rojo build | `pnpm run build:place` | Create `.rbxlx` place files |
| eslint | `pnpm run lint` | TypeScript linting |

## Rojo Mapping (default.project.json)

| Roblox Location | File Path |
|-----------------|-----------|
| ReplicatedStorage/TS | out/main/src/shared |
| ReplicatedStorage/Common | out/common/src/shared |
| ServerScriptService/TS | out/main/src/server |
| StarterPlayer/StarterPlayerScripts/TS | out/main/src/client |
| ReplicatedStorage/rbxts_include/node_modules | node_modules/@rbxts, @flamework |

## Key Constraints

- **No Node.js APIs** in game code (runs in Luau VM)
- **No `.js` extensions** in imports
- `tsconfig.json` has `noLib: true` (only @rbxts types)
- Decorators: `experimentalDecorators: true`
- Module system: CommonJS (Roblox modules use `require`)
- Type roots: `@rbxts`, `@flamework`, `@types`
- TypeScript strict mode, no `any`
- Package manager: pnpm

## File Placement Rules

| Content | Location |
|---------|----------|
| Server services | `places/main/src/server/services/` |
| Server components | `places/main/src/server/components/` |
| Client controllers | `places/main/src/client/controllers/` |
| Client components | `places/main/src/client/components/` |
| Network contracts | `places/common/src/shared/network/` |
| Shared types | `places/common/src/shared/types/` |
| Place-specific shared | `places/main/src/shared/` |

## Entry Points

- Server: `places/main/src/server/main.server.ts`
- Client: `places/main/src/client/main.client.ts`
- Both call `Flamework.addPaths()` to register services/controllers/components.
