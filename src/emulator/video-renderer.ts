import { OVERSCAN_PX, SCREEN_HEIGHT, SCREEN_WIDTH, VISIBLE_HEIGHT, VISIBLE_WIDTH } from "./constants";

const OPAQUE_BLACK = 0xff000000;

export class VideoRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly imageData: ImageData;
  private readonly pixels: Uint32Array;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = VISIBLE_WIDTH;
    canvas.height = VISIBLE_HEIGHT;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas 2D context is not available");

    this.context = context;
    this.imageData = context.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
    this.pixels = new Uint32Array(this.imageData.data.buffer);
    this.clear();
  }

  readonly writeFrame = (frameBuffer: ArrayLike<number>): void => {
    for (let index = 0; index < this.pixels.length; index++) {
      this.pixels[index] = OPAQUE_BLACK | frameBuffer[index]!;
    }
  };

  readonly present = (): void => {
    this.context.putImageData(this.imageData, -OVERSCAN_PX, -OVERSCAN_PX);
  };

  clear(): void {
    this.pixels.fill(OPAQUE_BLACK);
    this.present();
  }
}
