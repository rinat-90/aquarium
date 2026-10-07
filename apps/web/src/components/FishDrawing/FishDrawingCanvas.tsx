import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';

type FishDrawingCanvasProps = {
  onDone: (image: string) => void;
  onCancel: () => void;
};

export function FishDrawingCanvas({
                                    onDone,
                                    onCancel,
                                  }: FishDrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ff6b35');
  const [brushSize, setBrushSize] = useState(12);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    context.lineCap = 'round';
    context.lineJoin = 'round';
  }, []);

  const getPosition = (
    event: PointerEvent<HTMLCanvasElement>,
  ) => {
    const canvas = canvasRef.current!;

    const rect = canvas.getBoundingClientRect();

    return {
      x:
        (event.clientX - rect.left) *
        (canvas.width / rect.width),

      y:
        (event.clientY - rect.top) *
        (canvas.height / rect.height),
    };
  };

  const startDrawing = (
    event: PointerEvent<HTMLCanvasElement>,
  ) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const position = getPosition(event);

    canvas.setPointerCapture(event.pointerId);

    context.beginPath();
    context.moveTo(position.x, position.y);

    setIsDrawing(true);
  };

  const draw = (
    event: PointerEvent<HTMLCanvasElement>,
  ) => {
    if (!isDrawing) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const position = getPosition(event);

    context.strokeStyle = color;
    context.lineWidth = brushSize;

    context.lineTo(position.x, position.y);
    context.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height,
    );
  };

  const finish = () => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const image = canvas.toDataURL('image/png');

    onDone(image);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <h2>Draw your fish 🐟</h2>

        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          style={styles.canvas}
        />

        <div style={styles.controls}>
          <input
            type="color"
            value={color}
            onChange={(event) =>
              setColor(event.target.value)
            }
          />

          <input
            type="range"
            min={2}
            max={40}
            value={brushSize}
            onChange={(event) =>
              setBrushSize(Number(event.target.value))
            }
          />

          <button onClick={clear}>
            Clear
          </button>

          <button onClick={onCancel}>
            Cancel
          </button>

          <button onClick={finish}>
            Add to Aquarium
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.55)',
  },

  panel: {
    background: '#ffffff',
    borderRadius: 20,
    padding: 24,
    maxWidth: '90vw',
  },

  canvas: {
    width: 600,
    maxWidth: '100%',
    aspectRatio: '3 / 2',
    border: '2px solid #ddd',
    borderRadius: 12,
    cursor: 'crosshair',
    touchAction: 'none',

    background: '#ffffff',
  },

  controls: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    marginTop: 16,
    flexWrap: 'wrap',
  },
} as const;