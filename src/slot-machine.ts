import { inject, injectable } from "inversify";
import * as PIXI from "pixi.js";
import { SlotSymbol, SYMBOL_HEIGHT, SYMBOL_WIDTH } from "./slot-symbol";
import { GAME_TYPES, GameEventBus, GameEventType } from "./types";

export interface SlotReel {
  container: PIXI.Container;
  symbols: SlotSymbol[];
  position: number;
  previousPosition: number;
}

export interface SlotTexture {
  name: string;
  texture: PIXI.Texture;
}

export const REEL_X_OFFSET = 10;
export const REEL_COUNT = 3;
export const VISIBLE_SYMBOLS = 3;
export const EXTRA_SYMBOL_ROWS = 2; // 1 extra on top, 1 on bottom

@injectable()
export class SlotMachine extends PIXI.Container {
  public slotReelsContainer: PIXI.Container;
  private _reels: SlotReel[] = [];
  private _running = false;
  private _tweening: any[] = [];
  private _slotTextures: SlotTexture[];

  constructor(
    @inject(GAME_TYPES.PixiApp) private _app: PIXI.Application,
    @inject(GAME_TYPES.GameEventBus) private _eventBus: GameEventBus,
    @inject(GAME_TYPES.SlotTextures) slotTextures: SlotTexture[]
  ) {
    super();

    this.name = "slot-machine-container";

    this._slotTextures = slotTextures;
    this.slotReelsContainer = new PIXI.Container();
    this.addChild(this.slotReelsContainer);

    this.initReels();
    this.addMask();

    const updateReels = () => {
      for (let i = 0; i < this._reels.length; i++) {
        const r = this._reels[i];
        r.previousPosition = r.position;
        for (let j = 0; j < r.symbols.length; j++) {
          const s = r.symbols[j];
          const prevy = s.y;
          s.y = ((r.position + j) % r.symbols.length) * SYMBOL_HEIGHT;
          if (s.y >= (VISIBLE_SYMBOLS + EXTRA_SYMBOL_ROWS) * SYMBOL_HEIGHT) {
            s.y -= r.symbols.length * SYMBOL_HEIGHT;
          }

          const rowCandidate = Math.round(s.y / SYMBOL_HEIGHT) - 1;
          s.setRow(rowCandidate);

          if (s.y < 0 && prevy > 0) {
            const texture = this.getRandomTexture();
            s.setTexture(texture.texture);
          }
        }
      }
    };

    const updateTweens = () => {
      const now = Date.now();
      const remove: any[] = [];
      for (let i = 0; i < this._tweening.length; i++) {
        const t = this._tweening[i];
        const phase = Math.min(1, (now - t.start) / t.time);
        t.object[t.property] = this.lerp(
          t.propertyBeginValue,
          t.target,
          t.easing(phase)
        );
        if (t.change) t.change(t);
        if (phase === 1) {
          t.object[t.property] = t.target;
          if (t.complete) t.complete(t);
          remove.push(t);
        }
      }
      for (let i = 0; i < remove.length; i++) {
        this._tweening.splice(this._tweening.indexOf(remove[i]), 1);
      }
    };

    this._app.ticker.add(updateReels);
    this._app.ticker.add(updateTweens);
  }

  public spin(): void {
    if (this._running) return;
    this._running = true;
    this._eventBus.emit({ type: GameEventType.SPIN_START });

    // Randomize the symbol textures for each symbol in each reel before spinning
    for (let i = 0; i < this._reels.length; i++) {
      const r = this._reels[i];
      for (let j = 0; j < r.symbols.length; j++) {
        const randomTexture = this.getRandomTexture();
        r.symbols[j].setTexture(randomTexture.texture);
        r.symbols[j].name = randomTexture.name;
      }
      r.position = 0;
    }

    for (let i = 0; i < this._reels.length; i++) {
      const r = this._reels[i];
      const target = r.position + 10 + i * 5;
      const time = 2500 + i * 600;
      this.tweenTo(
        r,
        "position",
        target,
        time,
        this.backout(0.5),
        null,
        i === this._reels.length - 1
          ? () => {
              this.spinComplete();
            }
          : null
      );
    }
  }

  private spinComplete = (): void => {
    this._running = false;
    this._eventBus.emit({ type: GameEventType.SPIN_END });

    this.checkWin();

    const animateWinningSymbol = (
      symbol: SlotSymbol,
      spinDuration: number = 700,
      turns: number = 2,
      scalePulse: number = 0.4
    ) => {
      symbol.scale.set(1, 1);
      symbol.rotation = 0;
      const ticker = PIXI.Ticker.shared;
      const start = performance.now();
      // in case some transform is already applied, will mess up and restore wrong size in case another animation is ongoing
      const originalScale = symbol.scale.x;

      let animationComplete = false;
      let animationTick = () => {
        const elapsed = ticker.lastTime - start;
        let t = elapsed / spinDuration;
        if (t > 1) t = 1;

        // cubic ease out
        const calcEase = (t: number): number => {
          if (t < 0.5) {
            return 4 * Math.pow(t, 3);
          } else {
            return 1 - Math.pow(-2 * t + 2, 3) / 2;
          }
        };

        const setSymbolTransform = (symbol: SlotSymbol, ease: number) => {
          symbol.rotation = ease * Math.PI * 2 * turns;
          symbol.scale.set(
            originalScale + scalePulse * Math.sin(ease * Math.PI)
          );
        };

        const ease = calcEase(t);
        setSymbolTransform(symbol, ease);

        if (t >= 1) {
          symbol.scale.set(originalScale);
          symbol.rotation = 0;
          animationComplete = true;
        }
      };

      const update = () => {
        if (!animationComplete) {
          animationTick();
        } else {
          ticker.remove(update);
        }
      };

      ticker.add(update);
    };

    for (let row = 0; row < VISIBLE_SYMBOLS; row++) {
      const rowSymbols = this.getSymbolsByRow(row);
      const isWinningRow =
        rowSymbols.length === this._reels.length &&
        rowSymbols.every((s, _, arr) => s.name === arr[0].name);

      if (isWinningRow) {
        rowSymbols.forEach((symbol) => animateWinningSymbol(symbol));
      }
    }
  };

  // Initialization
  private initReels(): void {
    for (let i = 0; i < REEL_COUNT; i++) {
      const reelColumnContainer = new PIXI.Container();
      reelColumnContainer.x = i * (SYMBOL_WIDTH + REEL_X_OFFSET);
      this.slotReelsContainer.addChild(reelColumnContainer);
      const reel: SlotReel = {
        container: reelColumnContainer,
        symbols: [],
        position: 0,
        previousPosition: 0,
      };

      for (let j = 0; j < VISIBLE_SYMBOLS + EXTRA_SYMBOL_ROWS; j++) {
        const texture = this.getRandomTexture();
        const symbol = new SlotSymbol(j, texture.name, texture.texture);
        reel.symbols.push(symbol);
        reelColumnContainer.addChild(symbol);
      }
      this._reels.push(reel);
    }

    // Center the slotReelsContainer horizontally and vertically, accounting for anchor
    const totalWidth =
      REEL_COUNT * SYMBOL_WIDTH + (REEL_COUNT - 1) * REEL_X_OFFSET;
    const totalHeight = VISIBLE_SYMBOLS * SYMBOL_HEIGHT;

    // Since symbols are anchored to center, offset by half a symbol
    this.slotReelsContainer.x = Math.round(
      (this._app.screen.width - totalWidth) / 2 + SYMBOL_WIDTH / 2
    );
    // Move up by one symbol height so the visible area aligns with the mask
    this.slotReelsContainer.y = Math.round(
      (this._app.screen.height - totalHeight) / 2 +
        SYMBOL_HEIGHT / 2 -
        SYMBOL_HEIGHT
    );
  }

  private addMask(): void {
    const mask = new PIXI.Graphics();
    const width = REEL_COUNT * SYMBOL_WIDTH + (REEL_COUNT - 1) * REEL_X_OFFSET;
    const height = VISIBLE_SYMBOLS * SYMBOL_HEIGHT;
    mask.beginFill(0xffffff);
    mask.drawRect(0, 0, width, height);
    mask.endFill();
    this.slotReelsContainer.mask = mask;
    this.addChild(mask);

    // Position the mask to always cover the visible rows, matching the slotReelsContainer
    mask.x = this.slotReelsContainer.x - SYMBOL_WIDTH / 2;
    mask.y = this.slotReelsContainer.y + SYMBOL_HEIGHT / 2;
  }

  // Helper functions

  private getSymbolsByRow(row: number): SlotSymbol[] {
    return this._reels
      .map((reel) => reel.symbols.find((s) => s.row === row))
      .filter((s): s is SlotSymbol => !!s);
  }

  private checkWin(): void {
    for (let row = 0; row < VISIBLE_SYMBOLS; row++) {
      const rowSymbols = this.getSymbolsByRow(row);
      if (
        rowSymbols.length === this._reels.length && // All reels have a symbol in this row
        rowSymbols.every((s, _, arr) => s.name === arr[0].name) // All symbols names matched
      ) {
        this._eventBus.emit({
          type: GameEventType.WIN,
          payload: {
            row,
            symbols: rowSymbols,
          },
        });
      }
    }
  }

  private getRandomTexture(): SlotTexture {
    return this._slotTextures[
      Math.floor(Math.random() * this._slotTextures.length)
    ];
  }

  private lerp(a1: number, a2: number, t: number): number {
    return a1 * (1 - t) + a2 * t;
  }

  private backout(amount: number): (t: number) => number {
    return (t: number) => --t * t * ((amount + 1) * t + amount) + 1;
  }

  private tweenTo(
    object: any,
    property: string,
    target: number,
    time: number,
    easing: (t: number) => number,
    onchange: ((t: any) => void) | null,
    oncomplete: ((t: any) => void) | null
  ) {
    const tween = {
      object,
      property,
      propertyBeginValue: object[property],
      target,
      easing,
      time,
      change: onchange,
      complete: oncomplete,
      start: Date.now(),
    };
    this._tweening.push(tween);
    return tween;
  }
}
