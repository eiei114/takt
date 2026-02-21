import { Controller, OnStart } from "@flamework/core";

@Controller({})
export class BootController implements OnStart {
  onStart(): void {
    print("[client] BootController started");
  }
}
