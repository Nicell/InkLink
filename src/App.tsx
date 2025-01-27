import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaintBucket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PxBrush from "../shared/PxBrush";
import { CanvasAction } from "../shared/Actions";
import { fill, draw, colors, brushSizes } from "../shared/Utilities";

const DrawingApp = () => {
  const [tool, setTool] = useState<keyof typeof brushSizes | "fill">("brush-medium");
  const [color, setColor] = useState(colors.black);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const wsRef = useRef<WebSocket>(null);
  const currentLineRef = useRef<{ x: number; y: number }[]>([]);
  const brushRef = useRef<PxBrush>(null);
  const disconnectTimeoutRef = useRef<Timer>(undefined);
  const reconnectTimeoutRef = useRef<Timer>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const INITIAL_RECONNECT_DELAY = 1000;

  const connectWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      return wsRef.current;
    }

    if (disconnectTimeoutRef.current) {
      clearTimeout(disconnectTimeoutRef.current);
    }

    disconnectTimeoutRef.current = setTimeout(() => {
      setIsDisconnected(true);
    }, 500);

    console.log("Connecting to WebSocket server...");

    const ws = new WebSocket(
      `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host
      }/ws`
    );

    ws.onopen = () => {
      console.log("Connected to WebSocket server");
      clearTimeout(disconnectTimeoutRef.current);
      reconnectAttemptsRef.current = 0;
      setIsDisconnected(false);
      clearTimeout(reconnectTimeoutRef.current);
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      setIsDisconnected(true);

      // Only attempt reconnection if we haven't exceeded max attempts
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
        console.log(`Attempting to reconnect in ${delay}ms...`);

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connectWebSocket();
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    wsRef.current = ws;
    return ws;
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    brushRef.current = new PxBrush(canvas);

    // Initialize canvas with white background
    clearCanvas();

    // Create WebSocket connection
    const ws = connectWebSocket();

    return () => {
      // Clear any pending reconnection attempts
      clearTimeout(reconnectTimeoutRef.current);
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    const context = canvas.getContext("2d")!;
    context.fillStyle = colors.white;
    context.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleClear = () => {
    setShowClearConfirm(true);
  };

  const confirmClear = () => {
    clearCanvas();
    sendUpdate({
      type: "clear",
    });
    setShowClearConfirm(false);
  };

  const sendUpdate = (updateData: CanvasAction) => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify(updateData));
    }
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    let offsetX = 0,
      offsetY = 0;
    const target = e.target as HTMLCanvasElement;
    if (e.nativeEvent instanceof MouseEvent) {
      // Mouse event
      const rect = target.getBoundingClientRect();
      offsetX = e.nativeEvent.clientX - rect.left;
      offsetY = e.nativeEvent.clientY - rect.top;
    } else {
      // Touch event
      const rect = target.getBoundingClientRect();
      offsetX = e.nativeEvent.touches[0].clientX - rect.left;
      offsetY = e.nativeEvent.touches[0].clientY - rect.top;
    }

    // Scale coordinates
    offsetX /= target.clientWidth / 800;
    offsetY /= target.clientHeight / 480;
    return {
      x: Math.round(offsetX),
      y: Math.round(offsetY),
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!(e.nativeEvent instanceof MouseEvent)) {
      if (e.nativeEvent.touches && e.nativeEvent.touches.length > 1) return;
    }
    isDrawingRef.current = true;
    const { x, y } = getCoordinates(e);
    currentLineRef.current = [{ x, y }];
  };

  const drawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current) return;
    if (tool === "fill") return;
    if (!(e.nativeEvent instanceof MouseEvent)) {
      if (e.nativeEvent.touches && e.nativeEvent.touches.length > 1) return;
    }

    try {
      e.preventDefault();
    } catch {
      // prevent default doesn't work on touch events
    }

    const { x, y } = getCoordinates(e);

    brushRef.current?.draw({
      from: currentLineRef.current[currentLineRef.current.length - 1],
      to: { x, y },
      color: color,
      size: brushSizes[tool],
    });

    currentLineRef.current = [...currentLineRef.current, { x, y }];
  };

  const endDrawing = () => {
    if (!isDrawingRef.current) return;
    if (tool === "fill") return;
    isDrawingRef.current = false;

    if (currentLineRef.current.length > 0) {
      if (currentLineRef.current.length === 1) {
        // Draw a single point
        brushRef.current?.draw({
          from: currentLineRef.current[0],
          to: currentLineRef.current[0],
          color: color,
          size: brushSizes[tool],
        });
      }
      sendUpdate({
        type: "draw",
        points: currentLineRef.current,
        color: color,
        brushSize: brushSizes[tool],
      });
    }

    currentLineRef.current = [];
  };

  const handleFill = (e: React.MouseEvent | React.TouchEvent) => {
    if (tool !== "fill") return;

    const { x, y } = getCoordinates(e);

    floodFill(x, y, color);

    sendUpdate({
      type: "fill",
      x,
      y,
      color: color,
    });
  };

  const floodFill = (startX: number, startY: number, fillColor: string) => {
    const canvas = canvasRef.current!;
    const context = canvas.getContext("2d")!;
    fill(context, canvas.width, canvas.height, startX, startY, fillColor);
  };

  const drawLine = (
    points: { x: number; y: number }[],
    color: string,
    brushSize: number
  ) => {
    draw(brushRef.current!, points, color, brushSize);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleDrawingUpdate = (
    data: CanvasAction,
    context: CanvasRenderingContext2D
  ) => {
    switch (data.type) {
      case "init": {
        // Load the initial canvas state
        const img = new Image();
        img.onload = () => {
          context.drawImage(img, 0, 0);
          // Redraw current line if one is in progress
          if (currentLineRef.current.length > 0 && tool !== "fill") {
            drawLine(currentLineRef.current, color, brushSizes[tool]);
          }
        };
        img.src = `data:image/png;base64,${data.image}`;
        break;
      }
      case "draw": {
        drawLine(data.points, data.color, data.brushSize);
        break;
      }
      case "fill":
        floodFill(data.x, data.y, data.color);
        break;
      case "clear":
        clearCanvas();
        break;
    }
  };

  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const canvas = canvasRef.current!;
        const context = canvas.getContext("2d")!;
        handleDrawingUpdate(data, context);
      };
    }
  }, [handleDrawingUpdate]);

  return (
    <div className="mx-auto flex flex-col items-center p-2 sm:p-3 md:p-4 max-w-full">
      <div className="flex gap-4 mb-2 md:mb-4 items-center w-full flex-wrap max-w-screen-md">
        <h1 className="text-2xl font-bold text-slate-900">
          🎉 {import.meta.env.VITE_WEB_TITLE}
        </h1>
        <div className="flex gap-4 items-center flex-wrap justify-end flex-grow">
          <div className="flex gap-2 items-center">
            {Object.entries(brushSizes).map(([toolType, toolSize]) => {
              return (
                <button
                  key={toolType}
                  className={`transition-colors w-8 h-8 rounded-full flex items-center justify-center ${tool === toolType
                    ? "bg-blue-500"
                    : "bg-slate-200 hover:bg-slate-300"
                    }`}
                  onClick={() => setTool(toolType as keyof typeof brushSizes)}
                >
                  <div
                    className="rounded-full bg-black"
                    style={{
                      width: `${toolSize}px`,
                      height: `${toolSize}px`,
                    }}
                  />
                </button>
              );
            })}
            <button
              className={`transition-colors w-8 h-8 rounded-full flex items-center justify-center ${tool === "fill"
                ? "bg-blue-500 text-white"
                : "bg-slate-200 hover:bg-slate-300"
                }`}
              onClick={() => setTool("fill")}
            >
              <PaintBucket size={16} />
            </button>
          </div>

          <div className="flex gap-2 items-center">
            {Object.entries(colors).map(([name, colorValue]) => (
              <button
                key={colorValue}
                aria-label={name}
                className={`transition-colors w-8 h-8 rounded-full border-4 ${color === colorValue
                  ? "border-blue-500"
                  : "border-slate-200 hover:border-slate-300"
                  }`}
                style={{ backgroundColor: colorValue }}
                onClick={() => setColor(colorValue)}
              />
            ))}
          </div>

          <Button variant="outline" onClick={handleClear}>
            Clear
          </Button>
        </div>
      </div>
      <Card className="p-3 sm:p-5 md:p-7 flex-col rounded-b-none bg-slate-400">
        <canvas
          ref={canvasRef}
          width={800}
          height={480}
          style={{ imageRendering: "pixelated" }}
          className="cursor-crosshair max-w-full touch-pinch-zoom"
          onMouseDown={(e) => {
            if (tool === "fill") {
              handleFill(e);
            } else {
              startDrawing(e);
            }
          }}
          onTouchStart={(e) => {
            if (tool === "fill") {
              handleFill(e);
            } else {
              startDrawing(e);
            }
          }}
          onMouseMove={drawing}
          onTouchMove={drawing}
          onMouseUp={endDrawing}
          onMouseOut={endDrawing}
          onTouchEnd={endDrawing}
          onTouchCancel={endDrawing}
        />
        <div className="flex justify-center pt-5 sm:pt-8 md:pt-12 pb-1 sm:pb-2 md:pb-3 h-10 sm:h-16 md:h-24">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="100%"
            fillRule="evenodd"
            viewBox="0 0 27 8.31"
          >
            <g fillOpacity=".2">
              <path d="M5.1 4.82v.04c-.01.03 0 .08.02.16.02.07.09.18.2.32.12.15.35.34.67.6s.82.53 1.46.85a14.4 14.4 0 0 0 7.4 1.48A12.93 12.93 0 0 0 21.17 6c.43-.32.73-.6.9-.84s.18-.42.07-.53c-.12-.1-.37-.15-.75-.13-.39.01-.89.07-1.5.16-.61.1-1.31.19-2.1.29a33.82 33.82 0 0 1-5.18.23c-.9-.04-1.77-.1-2.6-.2s-1.58-.2-2.26-.29c-.67-.1-1.2-.15-1.55-.18a2.88 2.88 0 0 0-.76.01c-.14.03-.23.08-.27.12s-.06.1-.06.12l-.01.05M0 1.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0zM24 1.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0z" />
            </g>
          </svg>
        </div>
      </Card>

      <Dialog
        open={isDisconnected}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Server Disconnected</DialogTitle>
            <DialogDescription>
              Lost connection to the drawing server.
              {reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
                ? " Attempting to reconnect..."
                : " Maximum reconnection attempts reached."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Canvas?</DialogTitle>
            <DialogDescription>
              Are you sure you want to clear the entire canvas? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearConfirm(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmClear}>
              Clear Canvas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DrawingApp;
