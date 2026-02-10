import { useRef, useEffect, useState } from 'react';
import type { Player } from '@territory/shared';

interface GameCanvasProps {
  grid: (string | null)[][]; 
  players: Player[]; // <--- Переконайся, що цей пропс тут є
  cellSize: number;
  activeRect: { w: number, h: number } | null;
  onCellClick: (x: number, y: number) => void;
  checkValidity?: (x: number, y: number) => boolean;
}

export const GameCanvas = ({ 
  grid, 
  players, 
  cellSize, 
  activeRect, 
  onCellClick, 
  checkValidity 
}: GameCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverPos, setHoverPos] = useState<{x: number, y: number} | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rows = grid.length;
    const cols = grid[0].length;

    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;

    // 1. Очищення
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 2. Малюємо поле
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Сітка
        ctx.strokeStyle = '#334155'; // Slate-700
        ctx.lineWidth = 1;
        ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
        
        const cellOwnerId = grid[r][c];

        // ЯКЩО КЛІТИНКА ЗАЙНЯТА
        if (cellOwnerId) {
           // Шукаємо гравця у списку за ID
           const owner = players.find(p => p.id === cellOwnerId);
           
           // Беремо його колір (або сірий, якщо раптом не знайшли)
           ctx.fillStyle = owner?.color || '#94a3b8'; 
           
           // Малюємо квадрат
           ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
           
           // Трохи світліша рамка для краси
           ctx.strokeStyle = 'rgba(255,255,255,0.2)';
           ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
        }
      }
    }

    // 3. Малюємо курсор (Preview)
    if (hoverPos && activeRect) {
      const { x, y } = hoverPos;
      const { w, h } = activeRect;

      let isValid = true;
      if (checkValidity) {
        isValid = checkValidity(x, y);
      }

      // Зелений або Червоний (напівпрозорий)
      ctx.fillStyle = isValid ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)';
      ctx.fillRect(x * cellSize, y * cellSize, w * cellSize, h * cellSize);
      
      // Рамка курсора
      ctx.strokeStyle = isValid ? '#16a34a' : '#dc2626';
      ctx.lineWidth = 2;
      ctx.strokeRect(x * cellSize, y * cellSize, w * cellSize, h * cellSize);
    } 

  }, [grid, players, hoverPos, activeRect, cellSize, checkValidity]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);
    setHoverPos({ x, y });
  };

  const handleMouseLeave = () => setHoverPos(null);

  const handleClick = () => {
    if (hoverPos) onCellClick(hoverPos.x, hoverPos.y);
  };

  return (
    <canvas 
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className="cursor-pointer block"
    />
  );
};