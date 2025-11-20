import { Container } from "inversify";
import * as PIXI from "pixi.js";
import { Foreground } from "./foreground";
import { SlotMachine, SlotTexture } from "./slot-machine";
import {
  GAME_TYPES,
  GameEvent,
  GameEventBus,
  GameEventType,
  SetupParams,
} from "./types";
import { ForegroundNew } from "./foreground-new";

export function bootstrap(baseDI: Container): void {
  const app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x1099bb,
    resizeTo: window,
    antialias: true,
  });
  document.body.appendChild(app.view);
  //@ts-ignore
  globalThis.__PIXI_APP__ = app; // For debugging purposes

  const loader = PIXI.Loader.shared;
  loader
    .add("eggHead", "https://pixijs.com/assets/eggHead.png")
    .add("flowerTop", "https://pixijs.com/assets/flowerTop.png")
    .add("helmlok", "https://pixijs.com/assets/helmlok.png")
    .add("skully", "https://pixijs.com/assets/skully.png");

  loader.load((_, resources) => {
    setup({ container: baseDI, app, resources });
  });
}

function setup(params: SetupParams): void {
  const { container, app, resources } = params;

  const slotTextures: SlotTexture[] = [
    { name: "eggHead", texture: resources.eggHead!.texture! },
    { name: "flowerTop", texture: resources.flowerTop!.texture! },
    { name: "helmlok", texture: resources.helmlok!.texture! },
    { name: "skully", texture: resources.skully!.texture! },
  ];

  container.bind(GAME_TYPES.SlotTextures).toConstantValue(slotTextures);
  container.bind<PIXI.Application>(GAME_TYPES.PixiApp).toConstantValue(app);
  container
    .bind<SlotMachine>(GAME_TYPES.SlotMachine)
    .to(SlotMachine)
    .inSingletonScope();
  container
    .bind<ForegroundNew>(GAME_TYPES.Foreground)
    .to(ForegroundNew)
    .inSingletonScope();

  // Add the containers to the stage
  const slotMachine = container.get<SlotMachine>(GAME_TYPES.SlotMachine);
  app.stage.addChild(slotMachine);
  const foreground = container.get<ForegroundNew>(GAME_TYPES.Foreground);
  app.stage.addChild(foreground);

  setupEvents(container);
}

function setupEvents(container: Container): void {
  const gameEventBus = container.get<GameEventBus>(GAME_TYPES.GameEventBus);

  // Example event listeners
  gameEventBus.on((event: GameEvent) => {
    if (event.type === GameEventType.SPIN_START) {
      console.log("Spin started");
    } else if (event.type === GameEventType.SPIN_END) {
      console.log("Spin ended");
    } else if (event.type === GameEventType.WIN) {
      console.log(`Win on row ${event.payload.row}`);
    }
  });
}
