import { OnInit, Service } from "@flamework/core";

@Service({})
export class BootService implements OnInit {
  onInit(): void {
    print("[server] BootService initialized");
  }
}
