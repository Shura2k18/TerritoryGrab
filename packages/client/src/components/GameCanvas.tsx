import { useRef, useEffect, useState } from 'react';
import type { Player } from '@territory/shared';

interface GameCanvasProps {
  grid: (string | null)[][]; 
  players: Player[];
  cellSize: number;
  activeRect: { w: number, h: number } | null;
  onCellClick: (x: number, y: number) => void;
  checkValidity?: (x: number, y: number) => boolean; // Зробив опціональним, щоб не ламалось якщо не передали
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

    // 1. ЗАХИСТ: Якщо grid ще не завантажився або прийшов битим
    if (!grid || grid.length === 0) {
        // Можна очистити канвас або просто нічого не робити
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Безпечне визначення розмірів
    const rows = grid.length;
    const cols = grid[0]?.length || 0; // Захист від grid[0] === undefined

    // Встановлюємо розмір canvas
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;

    // 2. Очищення перед малюванням
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 3. Малюємо поле (Grid)
    for (let r = 0; r < rows; r++) {
      // ЗАХИСТ: Якщо раптом рядок відсутній (біті дані)
      if (!grid[r]) continue;

      for (let c = 0; c < cols; c++) {
        // Малюємо сітку
        ctx.strokeStyle = '#334155'; // Slate-700
        ctx.lineWidth = 1;
        ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
        
        // Безпечний доступ до клітинки
        const cellOwnerId = grid[r][c];

        // ЯКЩО КЛІТИНКА ЗАЙНЯТА
        if (cellOwnerId) {
           // Шукаємо гравця. Додано 'players?.find' на випадок, якщо players undefined
           const owner = players?.find(p => p.id === cellOwnerId);
           
           // Беремо колір (або сірий, якщо гравця вже немає в кімнаті)
           ctx.fillStyle = owner?.color || '#64748b'; 
           
           // Малюємо квадрат
           ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
           
           // Трохи світліша рамка для краси (ефект плитки)
           ctx.strokeStyle = 'rgba(255,255,255,0.1)';
           ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
        }
      }
    }

    // 4. Малюємо курсор (Preview)
    // Додаємо перевірку, щоб курсор не малювався за межами поля
    if (hoverPos && activeRect) {
      const { x, y } = hoverPos;
      const { w, h } = activeRect;

      // Перевірка, чи курсор взагалі валідний (чи не вийшов за межі масиву)
      if (x >= 0 && y >= 0 && x < cols && y < rows) {
          let isValid = true;
          if (checkValidity) {
            try {
                isValid = checkValidity(x, y);
            } catch (e) {
                console.warn("Validation error:", e);
                isValid = false;
            }
          }

          // Зелений або Червоний (напівпрозорий)
          ctx.fillStyle = isValid ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)';
          ctx.fillRect(x * cellSize, y * cellSize, w * cellSize, h * cellSize);
          
          // Рамка курсора
          ctx.strokeStyle = isValid ? '#16a34a' : '#dc2626';
          ctx.lineWidth = 2;
          ctx.strokeRect(x * cellSize, y * cellSize, w * cellSize, h * cellSize);
      }
    } 

  }, [grid, players, hoverPos, activeRect, cellSize, checkValidity]);

  const handleMouseMove = (e: React.MouseEvent) => {
    // ЗАХИСТ: Якщо grid немає, не рахуємо координати
    if (!grid || !grid.length) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);
    
    // Перевірка меж, щоб не ставити ховер за межами поля
    const rows = grid.length;
    const cols = grid[0]?.length || 0;

    if (x >= 0 && y >= 0 && x < cols && y < rows) {
        setHoverPos({ x, y });
    } else {
        setHoverPos(null);
    }
  };

  const handleMouseLeave = () => setHoverPos(null);

  const handleClick = () => {
    if (hoverPos) {
        // Додатковий захист при кліку
        onCellClick(hoverPos.x, hoverPos.y);
    }
  };

  return (
    <canvas 
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className="cursor-pointer block touch-none" // touch-none для кращої роботи на планшетах
    />
  );
};