import { useRef, useEffect, useState, useCallback } from 'react';
import type { Player } from '@territory/shared';

interface GameCanvasProps {
  grid: (string | null)[][]; 
  players: Player[];
  cellSize: number;
  activeRect: { w: number, h: number } | null;
  onCellClick: (x: number, y: number) => void;
  checkValidity?: (x: number, y: number) => boolean;
  phantomPos?: { x: number, y: number } | null;
  disableHover?: boolean;
}

export const GameCanvas = ({ 
  grid, 
  players, 
  cellSize: baseCellSize,
  activeRect, 
  onCellClick, 
  checkValidity,
  phantomPos,
  disableHover = false 
}: GameCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Стан камери
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  
  // Стан миші/тача
  const [isDragging, setIsDragging] = useState(false);
  const [startPan, setStartPan] = useState<{x: number, y: number} | null>(null);
  const [hoverPos, setHoverPos] = useState<{x: number, y: number} | null>(null);

  // Очищення hoverPos, якщо ми перейшли в режим disableHover (мобільний)
  useEffect(() => {
      if (disableHover) {
          setHoverPos(null);
      }
  }, [disableHover]);

  // --- 1. АВТО-МАСШТАБУВАННЯ ---
  const fitToScreen = useCallback(() => {
      const canvas = canvasRef.current;
      const parent = canvas?.parentElement;
      
      if (canvas && parent && grid && grid.length > 0) {
          canvas.width = parent.clientWidth;
          canvas.height = parent.clientHeight;

          const rows = grid.length;
          const cols = grid[0].length;
          const gridW = cols * baseCellSize;
          const gridH = rows * baseCellSize;

          const scaleX = canvas.width / gridW;
          const scaleY = canvas.height / gridH;
          const fitScale = Math.min(scaleX, scaleY) * 0.95; 
          
          const offX = (canvas.width - gridW * fitScale) / 2;
          const offY = (canvas.height - gridH * fitScale) / 2;

          setScale(fitScale);
          setOffset({ x: offX, y: offY });
      }
  }, [grid, baseCellSize]);

  useEffect(() => {
      fitToScreen();
      window.addEventListener('resize', fitToScreen);
      return () => window.removeEventListener('resize', fitToScreen);
  }, [fitToScreen]);

  // --- 2. ZOOM (WHEEL) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
        e.preventDefault(); 
        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        setScale(prevScale => Math.min(Math.max(0.1, prevScale + delta), 5));
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  // --- 3. КОНВЕРТАЦІЯ КООРДИНАТ ---
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
      const worldX = (screenX - offset.x) / scale;
      const worldY = (screenY - offset.y) / scale;
      return {
          x: Math.floor(worldX / baseCellSize),
          y: Math.floor(worldY / baseCellSize)
      };
  }, [offset, scale, baseCellSize]);

  // --- 4. МАЛЮВАННЯ ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid || grid.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (parent && (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight)) {
         canvas.width = parent.clientWidth;
         canvas.height = parent.clientHeight;
    }

    const rows = grid.length;
    const cols = grid[0]?.length || 0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Тінь та Фон
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cols * baseCellSize, rows * baseCellSize);
    ctx.shadowColor = 'transparent'; 

    // Сітка та Клітинки
    for (let r = 0; r < rows; r++) {
      if (!grid[r]) continue;
      for (let c = 0; c < cols; c++) {
        ctx.strokeStyle = '#e2e8f0'; 
        ctx.lineWidth = 1; 
        ctx.strokeRect(c * baseCellSize, r * baseCellSize, baseCellSize, baseCellSize);
        
        const cellOwnerId = grid[r][c];
        if (cellOwnerId) {
           const owner = players?.find(p => p.id === cellOwnerId);
           ctx.fillStyle = owner?.color || '#94a3b8'; 
           ctx.fillRect(c * baseCellSize, r * baseCellSize, baseCellSize, baseCellSize);
           ctx.strokeStyle = 'rgba(0,0,0,0.1)';
           ctx.strokeRect(c * baseCellSize, r * baseCellSize, baseCellSize, baseCellSize);
        }
      }
    }

    // КУРСОР / ФАНТОМ
    const targetPos = phantomPos || (!disableHover ? hoverPos : null);

    if (targetPos && activeRect) {
      const { x, y } = targetPos;
      const { w, h } = activeRect;

      if (x >= 0 && y >= 0 && x < cols && y < rows) {
          let isValid = true;
          if (checkValidity) {
            try { isValid = checkValidity(x, y); } catch(e) { isValid = false; }
          }

          ctx.fillStyle = isValid ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)';
          ctx.fillRect(x * baseCellSize, y * baseCellSize, w * baseCellSize, h * baseCellSize);
          
          ctx.strokeStyle = isValid ? '#15803d' : '#b91c1c';
          ctx.lineWidth = 2 / scale; 
          ctx.strokeRect(x * baseCellSize, y * baseCellSize, w * baseCellSize, h * baseCellSize);
      }
    } 

    ctx.restore();
  }, [grid, players, hoverPos, phantomPos, activeRect, baseCellSize, checkValidity, offset, scale, disableHover]);


  // --- ОБРОБНИКИ ПОДІЙ ---

  const handlePointerDown = (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(false);
      // Важливо: перевіряємо, чи це ліва кнопка, чи середня/права для драгу
      // Але для простоти ми дозволяємо починати драг будь-якою, а клік тільки лівою
      setStartPan({ x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      // 1. Drag (Pan)
      if (startPan && e.buttons > 0) { 
          const dx = e.clientX - startPan.x;
          const dy = e.clientY - startPan.y;
          
          if (Math.abs(dx) > 2 || Math.abs(dy) > 2 || isDragging) {
             setIsDragging(true);
             setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
             setStartPan({ x: e.clientX, y: e.clientY });
          }
          return;
      }

      // 2. Hover logic
      if (!disableHover) {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
              const { x, y } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
              const rows = grid?.length || 0;
              const cols = grid?.[0]?.length || 0;
              if (x >= 0 && y >= 0 && x < cols && y < rows) {
                  setHoverPos({ x, y });
              } else {
                  setHoverPos(null);
              }
          }
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      e.currentTarget.releasePointerCapture(e.pointerId);
      
      // FIX: Перевіряємо, що це саме ЛІВА кнопка миші (button === 0)
      // Права кнопка (2) проігнорується тут і піде далі (для повороту в ActiveGame)
      if (!isDragging && e.button === 0) {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
              const { x, y } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
              onCellClick(x, y);
          }
      }
      setStartPan(null);
      setIsDragging(false);
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-900/50 rounded-xl shadow-inner border border-slate-700">
        <canvas 
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          // preventDefault на contextmenu тут не ставимо, щоб подія спливала до ActiveGame
          className={`block touch-none w-full h-full ${isDragging ? "cursor-grabbing" : "cursor-crosshair"}`}
        />
        
        {/* Кнопки зуму */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10 opacity-50 hover:opacity-100 transition-opacity">
            <button onClick={() => setScale(s => Math.min(s + 0.2, 5))} className="w-8 h-8 bg-slate-800 text-white rounded font-bold border border-slate-600">+</button>
            <button onClick={() => setScale(s => Math.max(s - 0.2, 0.1))} className="w-8 h-8 bg-slate-800 text-white rounded font-bold border border-slate-600">-</button>
            <button onClick={fitToScreen} className="w-8 h-8 bg-slate-800 text-white rounded font-bold border border-slate-600 text-xs" title="Reset View">⤢</button>
        </div>
    </div>
  );
};