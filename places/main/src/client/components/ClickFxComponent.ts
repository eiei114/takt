import { BaseComponent, Component } from "@flamework/components";

type Attributes = Record<string, never>;

@Component({
  tag: "ClickFx"
})
export class ClickFxComponent extends BaseComponent<Attributes, GuiObject> {
  onStart(): void {
    this.instance.SetAttribute("InitializedBy", "ClickFxComponent");
  }
}
