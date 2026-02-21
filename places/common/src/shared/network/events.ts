import { Networking } from "@flamework/networking";

export interface ClientToServerEvents {
  requestPing(message: string): void;
}

export interface ServerToClientEvents {
  notifyPong(message: string): void;
}

export const GlobalEvents = Networking.createEvent<ClientToServerEvents, ServerToClientEvents>();
