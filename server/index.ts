import { createCanvas, Canvas, SKRSContext2D } from "@napi-rs/canvas";
import PxBrush from "../shared/PxBrush";
import { CronJob } from "cron";
import { CanvasAction } from "../shared/Actions";
import { brushSizes, colors, draw, fill } from "../shared/Utilities";

// Server-side canvas
let canvas: Canvas;
let ctx: SKRSContext2D;
let saveTimeout: NodeJS.Timeout | null = null;
let lastSave = Date.now();
let brush: PxBrush;

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 480;
const SAVE_THROTTLE = 5000;
const SAVE_PATH = "./drawings/current.bmp";

const initialize = async () => {
  // Initialize canvas and ensure drawings directory exists
  try {
    canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx = canvas.getContext("2d");
    brush = new PxBrush(canvas as unknown as HTMLCanvasElement);

    // Set initial white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Load existing drawing if it exists
    try {
      console.log("Attempting to load:", SAVE_PATH);
      const file = Bun.file(SAVE_PATH);
      const exists = await file.exists();

      if (exists) {
        console.log("File exists, loading...");
        const buffer = await file.arrayBuffer();
        console.log("Buffer loaded, size:", buffer.byteLength);

        // Skip BMP headers (14 + 40 bytes) and color palette (16 bytes)
        const pixelData = Buffer.from(buffer.slice(70));
        const stride = Math.ceil(CANVAS_WIDTH / 4);

        // Create RGBA buffer
        const imageData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);

        // Color palette (matches the one used in save)
        const palette = [
          { r: 255, g: 255, b: 255, a: 255 }, // White
          { r: 0, g: 0, b: 0, a: 255 }, // Black
          { r: 255, g: 0, b: 0, a: 255 }, // Red
          { r: 0, g: 0, b: 0, a: 0 }, // Unused
        ];

        // Convert 2-bit indexed color back to RGBA
        for (let y = 0; y < CANVAS_HEIGHT; y++) {
          for (let x = 0; x < CANVAS_WIDTH; x++) {
            const byteIndex = Math.floor(x / 4) + y * stride;
            const bitPosition = (3 - (x % 4)) * 2;
            const colorIndex = (pixelData[byteIndex] >> bitPosition) & 0b11;

            const i = (y * CANVAS_WIDTH + x) * 4;
            const color = palette[colorIndex];

            imageData.data[i] = color.r; // R
            imageData.data[i + 1] = color.g; // G
            imageData.data[i + 2] = color.b; // B
            imageData.data[i + 3] = color.a; // A
          }
        }

        ctx.putImageData(imageData, 0, 0);
        console.log("Drawing complete");
      } else {
        console.log("No existing drawing file found");
      }
    } catch (e) {
      console.error("Error loading existing drawing:", e);
      console.log("Starting with blank canvas");
    }

    if (process.env.CLEAR_CRON) {
      new CronJob(
        process.env.CLEAR_CRON,
        () => {
          console.log("Clearing drawing...");
          handleClear();
        },
        null,
        true
      );
    }
  } catch (e) {
    console.error("Failed to initialize:", e);
  }
};

initialize();

const createBmpBuffer = (imageData: ImageData) => {
  // Create color palette (4 colors: white, black, red, unused)
  const palette = Buffer.alloc(16); // 4 colors * 4 bytes (BGRA)
  // White
  palette.writeUInt32LE(0xffffffff, 0);
  // Black
  palette.writeUInt32LE(0xff000000, 4);
  // Red
  palette.writeUInt32LE(0xffff0000, 8);
  // Unused (transparent)
  palette.writeUInt32LE(0xffffff00, 12);

  // Convert RGBA pixels to 2-bit indexed color
  const stride = Math.ceil(CANVAS_WIDTH / 4); // 4 pixels per byte
  const pixelData = Buffer.alloc(stride * CANVAS_HEIGHT);

  for (let y = 0; y < CANVAS_HEIGHT; y++) {
    for (let x = 0; x < CANVAS_WIDTH; x++) {
      const i = (y * CANVAS_WIDTH + x) * 4;
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];

      // Determine closest color (0=white, 1=black, 2=red, 3=unused)
      let colorIndex;
      // Find closest color by checking which has smallest difference
      const whiteDistance =
        Math.abs(r - 255) + Math.abs(g - 255) + Math.abs(b - 255);
      const redDistance = Math.abs(r - 255) + Math.abs(g - 0) + Math.abs(b - 0);
      const blackDistance = Math.abs(r - 0) + Math.abs(g - 0) + Math.abs(b - 0);

      if (whiteDistance <= redDistance && whiteDistance <= blackDistance) {
        colorIndex = 0; // White is closest
      } else if (redDistance <= blackDistance) {
        colorIndex = 2; // Red is closest
      } else {
        colorIndex = 1; // Black is closest
      }

      // Calculate position in output buffer
      const byteIndex = Math.floor(x / 4) + y * stride;
      const bitPosition = (3 - (x % 4)) * 2;

      // Set 2 bits for this pixel
      pixelData[byteIndex] |= colorIndex << bitPosition;
    }
  }

  // Create BMP headers
  const bmpHeader = Buffer.alloc(14);
  bmpHeader.write("BM", 0);
  bmpHeader.writeUInt32LE(14 + 40 + 16 + pixelData.length, 2); // Total size
  bmpHeader.writeUInt32LE(14 + 40 + 16, 10); // Offset to pixel data

  const dibHeader = Buffer.alloc(40);
  dibHeader.writeUInt32LE(40, 0); // DIB header size
  dibHeader.writeInt32LE(CANVAS_WIDTH, 4);
  dibHeader.writeInt32LE(-CANVAS_HEIGHT, 8); // Negative for top-down
  dibHeader.writeUInt16LE(1, 12); // Color planes
  dibHeader.writeUInt16LE(2, 14); // Bits per pixel (2 bits = 4 colors)
  dibHeader.writeUInt32LE(0, 16); // No compression
  dibHeader.writeUInt32LE(pixelData.length, 20);
  dibHeader.writeUInt32LE(0, 24); // X pixels per meter
  dibHeader.writeUInt32LE(0, 28); // Y pixels per meter
  dibHeader.writeUInt32LE(4, 32); // Number of colors in palette
  dibHeader.writeUInt32LE(0, 36); // Important colors

  return Buffer.concat([bmpHeader, dibHeader, palette, pixelData]);
};

const saveDrawing = async () => {
  try {
    const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const bmpBuffer = createBmpBuffer(imageData);
    await Bun.write(SAVE_PATH, bmpBuffer);
  } catch (e) {
    console.error("Failed to save drawing:", e);
  }
};

const throttledSave = () => {
  const now = Date.now();

  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }

  if (now - lastSave >= SAVE_THROTTLE) {
    saveDrawing();
    lastSave = now;
  } else {
    saveTimeout = setTimeout(() => {
      saveDrawing();
      lastSave = Date.now();
    }, SAVE_THROTTLE) as unknown as NodeJS.Timeout;
  }
};

const handleClear = () => {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  throttledSave();
};

// Create a function to broadcast the current state
const broadcastState = () => {
  const pngBuffer = canvas.toBuffer("image/png");
  server.publish(
    "drawing",
    JSON.stringify({
      type: "init",
      image: pngBuffer.toString("base64"),
    })
  );
};

// Set up periodic broadcast
setInterval(broadcastState, 5000);

const server = Bun.serve({
  port: 3001,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("Upgrade failed", { status: 400 });
      }
      return;
    } else if (url.pathname === "/drawing.bmp") {
      const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      const bmpBuffer = createBmpBuffer(imageData);

      return new Response(bmpBuffer, {
        headers: {
          "Content-Type": "image/bmp",
          "Content-Disposition": "attachment; filename=drawing.bmp",
        },
      });
    } else if (url.pathname === "/health") {
      return new Response("OK");
    }

    return new Response("Bun WebSocket Server");
  },
  websocket: {
    open(ws) {
      ws.subscribe("drawing");

      // Send initial state to new client
      const pngBuffer = canvas.toBuffer("image/png");
      ws.send(
        JSON.stringify({
          type: "init",
          image: pngBuffer.toString("base64"),
        })
      );
    },
    message(ws, message) {
      const data = JSON.parse(message.toString()) as CanvasAction;

      // Update server-side canvas
      switch (data.type) {
        case "draw":
          if (
            !Object.values(colors).includes(data.color) ||
            !Object.values(brushSizes).includes(data.brushSize)
          )
            return;
          draw(brush, data.points, data.color, data.brushSize);
          throttledSave();
          break;
        case "fill":
          if (!Object.values(colors).includes(data.color)) return;
          fill(
            ctx as unknown as CanvasRenderingContext2D,
            CANVAS_WIDTH,
            CANVAS_HEIGHT,
            data.x,
            data.y,
            data.color
          );
          throttledSave();
          break;
        case "clear":
          handleClear();
          break;
      }

      // Broadcast to all clients
      ws.publish("drawing", message);
    },
    close(ws) {
      ws.unsubscribe("drawing");
    },
  },
});

console.log(`WebSocket server listening on port ${server.port}`);
