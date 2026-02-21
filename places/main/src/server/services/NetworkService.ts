import { OnStart, Service } from "@flamework/core";
import { ServerEvents } from "@main/server/networking/events";

@Service({})
export class NetworkService implements OnStart {
  onStart(): void {
    ServerEvents.requestPing.connect((player, message) => {
      print(`[server] ping from ${player.Name}: ${message}`);
      ServerEvents.notifyPong.fire(player, `pong:${message}`);
    });
  }
}
