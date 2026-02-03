import React, { useRef, useEffect, useState } from 'react';

type CellOwner = 'p1' | 'p2' | null;

interface GameCanvasProps {
  grid: CellOwner[][];
  cellSize?: number;
  // Нова пропса: розміри фігури, яку гравець зараз тримає в руках
  activeRect?: { w: number, h: number } | null; 
  onCellClick?: (x: number, y: number) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ 
  grid, 
  cellSize = 20, 
  activeRect, 
  onCellClick 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverPos, setHoverPos] = useState<{x: number, y: number} | null>(null);

  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const width = cols * cellSize;
  const height = rows * cellSize;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Очищення
    ctx.clearRect(0, 0, width, height);

    // 2. Малювання існуючої сітки (шар 1)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = grid[y][x];
        const posX = x * cellSize;
        const posY = y * cellSize;

        // Фон зайнятих
        if (cell) {
          ctx.fillStyle = cell === 'p1' ? '#ef4444' : '#3b82f6';
          ctx.fillRect(posX, posY, cellSize, cellSize);
        }

        // Сітка
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.strokeRect(posX, posY, cellSize, cellSize);
      }
    }

    // 3. Малювання "Примарної фігури" (Ghost Piece) (шар 2)
    if (hoverPos && activeRect) {
      const { x, y } = hoverPos;
      const { w, h } = activeRect;

      // Перевіряємо валіданість (візуально)
      let isValid = true;
      
      // Перевірка меж
      if (x + w > cols || y + h > rows) {
        isValid = false;
      } else {
        // Перевірка накладання
        for (let ry = 0; ry < h; ry++) {
          for (let rx = 0; rx < w; rx++) {
            if (grid[y + ry][x + rx] !== null) {
              isValid = false;
              break;
            }
          }
        }
      }

      // Вибір кольору: Зелений (OK) або Червоний (Error)
      // Використовуємо rgba для прозорості
      ctx.fillStyle = isValid ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'; 
      ctx.strokeStyle = isValid ? '#15803d' : '#b91c1c';
      
      // Малюємо прямокутник "привида"
      // Примітка: ми малюємо не по клітинках, а одразу великий прямокутник
      // Але щоб було гарно, краще все ж таки по клітинках або просто рамку
      ctx.fillRect(x * cellSize, y * cellSize, w * cellSize, h * cellSize);
      ctx.strokeRect(x * cellSize, y * cellSize, w * cellSize, h * cellSize);
    }
    // Якщо фігури немає, але мишка на полі — малюємо просто курсор
    else if (hoverPos) {
       ctx.fillStyle = 'rgba(0,0,0,0.1)';
       ctx.fillRect(hoverPos.x * cellSize, hoverPos.y * cellSize, cellSize, cellSize);
    }

  }, [grid, hoverPos, activeRect, cellSize, rows, cols]); 

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);

    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      setHoverPos({ x: col, y: row });
    } else {
      setHoverPos(null);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverPos(null)}
      onClick={() => hoverPos && onCellClick?.(hoverPos.x, hoverPos.y)}
      // Забираємо дефолтне меню на правий клік, щоб використати його для повороту
      onContextMenu={(e) => e.preventDefault()} 
      style={{ cursor: 'none', border: '1px solid #ccc' }} // cursor: none, бо ми малюємо свій
    />
  );
};