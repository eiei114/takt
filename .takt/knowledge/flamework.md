# Flamework Framework Knowledge

## Core Concepts

Flamework provides dependency injection and lifecycle management for roblox-ts.

### Services (Server-only)

```typescript
import { OnStart, Service } from "@flamework/core";

@Service({})
export class MyService implements OnStart {
  onStart(): void {
    // Runs after all services are initialized
  }
}
```

- Registered in `main.server.ts` via `Flamework.addPaths("places/main/src/server/services")`
- Singletons: one instance per server

### Controllers (Client-only)

```typescript
import { Controller, OnStart } from "@flamework/core";

@Controller({})
export class MyController implements OnStart {
  onStart(): void {
    // Runs after all controllers are initialized
  }
}
```

- Registered in `main.client.ts` via `Flamework.addPaths("places/main/src/client/controllers")`
- Singletons: one instance per client

### Components (Both sides)

```typescript
import { BaseComponent, Component } from "@flamework/components";

interface Attributes {
  speed: number;
}

@Component({ tag: "MyTag" })
export class MyComponent extends BaseComponent<Attributes, Instance> implements OnStart {
  onStart(): void {
    // Attached when Instance gets the "MyTag" CollectionService tag
  }
}
```

- Attached to Instances via CollectionService tags
- Type-safe attributes via generics
- Register via `Flamework.addPaths("places/main/src/{client,server}/components")`

### Networking

```typescript
// places/common/src/shared/network/events.ts
import { Networking } from "@flamework/networking";

interface ClientToServerEvents {
  requestAction(data: string): void;
}

interface ServerToClientEvents {
  notifyResult(data: string): void;
}

export const GlobalEvents = Networking.createEvent<
  ClientToServerEvents,
  ServerToClientEvents
>();
```

**Server side** (`places/main/src/server/networking/events.ts`):
```typescript
import { GlobalEvents } from "common/shared/network/events";
export const serverEvents = GlobalEvents.createServer({});
```

**Client side** (`places/main/src/client/networking/events.ts`):
```typescript
import { GlobalEvents } from "common/shared/network/events";
export const clientEvents = GlobalEvents.createClient({});
```

### Dependency Injection

```typescript
import { Dependency } from "@flamework/core";

// Inside a Service/Controller/Component
const otherService = Dependency<OtherService>();
```

## Lifecycle Order

1. `OnInit` - Synchronous initialization (all inits complete before any starts)
2. `OnStart` - Async startup (safe to use other services/controllers)

## Security Rules

- **NEVER trust client-sent data.** Validate all inputs on the server side.
- Use runtime type checks (via `@rbxts/t`) for all RemoteEvent payloads.
- Keep event names descriptive: `requestX` (client->server), `notifyX` (server->client).
- Server is authoritative; client is for display only.
