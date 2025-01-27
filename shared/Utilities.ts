import PxBrush from "./PxBrush";

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

export const colors = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
}
export const brushSizes = {
  "brush-small": 2,
  "brush-medium": 5,
  "brush-large": 10,
}

export function fill(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  x: number,
  y: number,
  color: string
) {
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  const startX = x;
  const startY = y;
  const startPos = (startY * width + startX) * 4;
  const startR = pixels[startPos];
  const startG = pixels[startPos + 1];
  const startB = pixels[startPos + 2];

  const fillColorRGB = hexToRgb(color);
  if (!fillColorRGB) return;

  if (
    startR === fillColorRGB.r &&
    startG === fillColorRGB.g &&
    startB === fillColorRGB.b
  )
    return;

  const queue = [[startX, startY]];
  const visited = new Set();

  const matchesStartColor = (x: number, y: number) => {
    const pos = (y * width + x) * 4;
    return (
      pixels[pos] === startR &&
      pixels[pos + 1] === startG &&
      pixels[pos + 2] === startB
    );
  };

  const setPixel = (x: number, y: number) => {
    const pos = (y * width + x) * 4;
    pixels[pos] = fillColorRGB.r;
    pixels[pos + 1] = fillColorRGB.g;
    pixels[pos + 2] = fillColorRGB.b;
    pixels[pos + 3] = 255;
  };

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const key = `${x},${y}`;

    if (visited.has(key)) continue;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (!matchesStartColor(x, y)) continue;

    setPixel(x, y);
    visited.add(key);

    if (x > 0) queue.push([x - 1, y]);
    if (x < width - 1) queue.push([x + 1, y]);
    if (y > 0) queue.push([x, y - 1]);
    if (y < height - 1) queue.push([x, y + 1]);

    if (queue.length > 10000) break;
  }

  context.putImageData(imageData, 0, 0);
}

export function draw(
  brush: PxBrush,
  points: { x: number; y: number }[],
  color: string,
  brushSize: number
) {
  if (points.length < 1) return;

  if (points.length === 1) {
    brush.draw({
      from: points[0],
      to: points[0],
      color: color,
      size: brushSize,
    });
  } else {
    for (let i = 1; i < points.length; i++) {
      brush.draw({
        from: points[i - 1],
        to: points[i],
        color: color,
        size: brushSize,
      });
    }
  }
}
