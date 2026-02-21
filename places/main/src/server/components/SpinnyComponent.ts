import { BaseComponent, Component } from "@flamework/components";

type Attributes = Record<string, never>;

@Component({
  tag: "Spinny"
})
export class SpinnyComponent extends BaseComponent<Attributes, BasePart> {
  onStart(): void {
    this.instance.SetAttribute("InitializedBy", "SpinnyComponent");
  }
}
