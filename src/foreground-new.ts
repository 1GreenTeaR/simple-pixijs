import { inject, injectable } from "inversify";
import * as PIXI from "pixi.js";
import { SlotMachine } from "./slot-machine";
import { GAME_TYPES } from "./types";

@injectable()
export class ForegroundNew extends PIXI.Container {
  public playText: PIXI.Text;
  public headerText: PIXI.Text;

  constructor(
    @inject(GAME_TYPES.PixiApp) private _app: PIXI.Application,
    @inject(GAME_TYPES.SlotMachine) private _slotMachine: SlotMachine
  ) {
    super();
    const margin = Math.round(
      (this._app.screen.height - 150 * 3) / 2 // fallback for symbol height/visible
    );

    const style = new PIXI.TextStyle({
      fontFamily: "Arial",
      fontSize: 36,
      fontStyle: "italic",
      fontWeight: "bold",
      fill: 0xffffff,
      stroke: "red",
      strokeThickness: 2,
      wordWrap: true,
      wordWrapWidth: 440,
    });

    this.playText = new PIXI.Text("SPIN", style);
    this.playText.x = Math.round(
      (this._app.screen.width - this.playText.width) / 2
    );
    this.playText.y =
      this._app.screen.height -
      margin +
      Math.round((margin - this.playText.height) / 2);
    this.playText.interactive = true;
    this.playText.buttonMode = true;
    this.playText.on("pointerdown", () => this._slotMachine.spin());

    this.headerText = new PIXI.Text("Richard test", style);
    this.headerText.x = Math.round(
      (this._app.screen.width - this.headerText.width) / 2
    );
    this.headerText.y = Math.round((margin - this.headerText.height) / 2);

    this.addChild(this.headerText);
    this.addChild(this.playText);
  }
}
