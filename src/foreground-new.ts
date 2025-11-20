import { inject, injectable } from "inversify";
import * as PIXI from "pixi.js";
import { SlotMachine } from "./slot-machine";
import { GAME_TYPES, GameEventBus, GameEventType } from "./types";

@injectable()
export class ForegroundNew extends PIXI.Container {
  public playButton: PIXI.Container;
  public headerText: PIXI.Text;

  constructor(
    @inject(GAME_TYPES.PixiApp) private _app: PIXI.Application,
    @inject(GAME_TYPES.GameEventBus) private _eventBus: GameEventBus,
    @inject(GAME_TYPES.SlotMachine) private _slotMachine: SlotMachine
  ) {
    super();
    const margin = Math.round(
      (this._app.screen.height - 150 * 3) / 2 // fallback for symbol height/visible
    );

    const style = new PIXI.TextStyle({
      fontFamily: "Inter, Helvetica, Arial, sans-serif",
      fontSize: 38,
      fontWeight: "bold",
      fill: 0xffffff,
      align: "center",
      letterSpacing: 1.5,
    });

    const buttonConfig = {
      width: 120,
      height: 120,
      radius: 80,
      bgColor: 0x4459fb,
      bgColorHover: 0x3650c7,
      textStyle: new PIXI.TextStyle({
        fontFamily: "Inter, Helvetica, Arial, sans-serif",
        fontSize: 20,
        fontWeight: "bold",
        fill: 0xffffff,
        align: "center",
        letterSpacing: 1.5,
      }),
    };

    const playButton = new PIXI.Container();

    const buttonBackground = new PIXI.Graphics();
    function renderButtonBackground(color: number) {
      buttonBackground.clear();
      buttonBackground.beginFill(color);
      buttonBackground.drawRoundedRect(
        0,
        0,
        buttonConfig.width,
        buttonConfig.height,
        buttonConfig.radius
      );
      buttonBackground.endFill();
    }
    renderButtonBackground(buttonConfig.bgColor);

    const playText = new PIXI.Text("SPIN", buttonConfig.textStyle);
    playText.anchor.set(0.5, 0.5);
    playText.x = buttonConfig.width / 2;
    playText.y = buttonConfig.height / 2;

    playButton.addChild(buttonBackground);
    playButton.addChild(playText);

    playButton.x = Math.round(this._app.screen.width / 2);
    playButton.y = this._app.screen.height - margin + Math.round(margin / 2);

    playButton.interactive = true;
    playButton.cursor = "pointer";
    playButton.pivot.set(buttonConfig.width / 2, buttonConfig.height / 2);

    playButton.on("pointerover", () => {
      renderButtonBackground(buttonConfig.bgColorHover);
    });
    playButton.on("pointerout", () => {
      renderButtonBackground(buttonConfig.bgColor);
    });
    playButton.on("pointerdown", () => {
      playButton.scale.set(0.95, 0.95);
    });
    playButton.on("pointerup", () => {
      playButton.scale.set(1, 1);
      renderButtonBackground(buttonConfig.bgColor);
      this._slotMachine.spin();
    });
    playButton.on("pointerupoutside", () => {
      playButton.scale.set(1, 1);
    });

    this.playButton = playButton;

    this.headerText = new PIXI.Text("Richard test", style);
    this.headerText.x = Math.round(
      (this._app.screen.width - this.headerText.width) / 2
    );
    this.headerText.y = Math.round((margin - this.headerText.height) / 2);

    this.addChild(this.headerText);
    this.addChild(this.playButton);

    this._eventBus.on((event) => {
      if (event.type === GameEventType.SPIN_START) {
        this.playButton.interactive = false;
        this.playButton.alpha = 0.4;
      } else if (event.type === GameEventType.SPIN_END) {
        this.playButton.interactive = true;
        this.playButton.alpha = 1.0;
      }
    });
  }
}
