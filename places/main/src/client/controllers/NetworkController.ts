import { Controller, OnStart } from "@flamework/core";
import { ClientEvents } from "@main/client/networking/events";

@Controller({})
export class NetworkController implements OnStart {
  onStart(): void {
    ClientEvents.notifyPong.connect((message) => {
      print(`[client] got ${message}`);
    });

    ClientEvents.requestPing.fire("hello-from-client");
  }
}
