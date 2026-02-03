import { useState } from 'react';
import { GameCanvas } from './components/GameCanvas';

type CellOwner = 'p1' | 'p2' | null;

// Константи розміру поля
const GRID_ROWS = 20;
const GRID_COLS = 30;

const generateEmptyGrid = (rows: number, cols: number) => 
  Array(rows).fill(null).map(() => Array(cols).fill(null));

function App() {
  const [grid, setGrid] = useState<CellOwner[][]>(generateEmptyGrid(GRID_ROWS, GRID_COLS));
  const [dice, setDice] = useState<[number, number]>([2, 3]);
  const [isPlacing, setIsPlacing] = useState(true);

  // ... логіка rollDice, rotateDice, handleCellClick залишається такою ж ...
  // (я скоротив код логіки, щоб показати верстку, встав сюди свої старі функції)
  const rotateDice = () => setDice(([w, h]) => [h, w]);
  const rollDice = () => {
    setDice([Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1]);
    setIsPlacing(true);
  };
  const handleCellClick = (x: number, y: number) => {
     // ... твоя стара логіка ...
     // Тільки не забудь перевіряти GRID_ROWS/GRID_COLS замість grid.length
     // або бери grid.length як раніше
     const [w, h] = dice;
     // Перевірка (спрощена для прикладу)
     if (y + h > grid.length || x + w > grid[0].length) return alert("Не влазить!");
     
     const newGrid = grid.map(row => [...row]);
     for(let r = 0; r < h; r++) {
        for(let c = 0; c < w; c++) {
           if(newGrid[y+r][x+c]) return alert("Зайнято!");
           newGrid[y+r][x+c] = 'p1';
        }
     }
     setGrid(newGrid);
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    rotateDice();
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-8 font-sans"
      onContextMenu={handleRightClick}
    >
      <h1 className="text-4xl font-bold mb-8 text-blue-400 tracking-wider">
        TERRITORY GRAB
      </h1>
      
      {/* Панель керування */}
      <div className="flex gap-6 items-center mb-6 bg-slate-800 p-4 rounded-xl shadow-xl border border-slate-700">
        
        {/* Кубики */}
        <div className="flex flex-col items-center">
          <span className="text-xs text-slate-400 uppercase font-bold mb-1">Current Roll</span>
          <div className="flex items-center gap-2 text-3xl font-mono font-bold text-yellow-400 bg-slate-900 px-4 py-2 rounded-lg border border-slate-600">
            <span>{dice[0]}</span>
            <span className="text-slate-500 text-xl">x</span>
            <span>{dice[1]}</span>
          </div>
        </div>

        <div className="h-12 w-px bg-slate-600 mx-2"></div>

        {/* Інформація про поле */}
        <div className="flex flex-col items-center">
             <span className="text-xs text-slate-400 uppercase font-bold mb-1">Map Size</span>
             <span className="text-lg font-mono text-slate-200">
               {GRID_COLS} x {GRID_ROWS}
             </span>
        </div>

        <div className="h-12 w-px bg-slate-600 mx-2"></div>

        {/* Кнопки */}
        <div className="flex gap-3">
            <button 
              onClick={rollDice}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition shadow-lg hover:shadow-blue-500/20 active:scale-95"
            >
              Roll Dice
            </button>
            <button 
              onClick={rotateDice}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-lg transition active:scale-95"
            >
              Rotate
            </button>
        </div>
      </div>

      {/* Контейнер для Канвасу */}
      {/* Додаємо border, щоб було чітко видно межі поля на темному фоні */}
      <div className="relative p-1 bg-slate-700 rounded-lg shadow-2xl overflow-hidden ring-4 ring-slate-800">
        <div className="bg-white rounded overflow-hidden">
            <GameCanvas 
              grid={grid} 
              cellSize={25} 
              activeRect={isPlacing ? { w: dice[0], h: dice[1] } : null} 
              onCellClick={handleCellClick} 
            />
        </div>
      </div>

      <p className="mt-6 text-slate-400 text-sm">
        <span className="font-bold text-slate-200">R-Click</span> to rotate. 
        <span className="font-bold text-slate-200"> L-Click</span> to place.
      </p>
    </div>
  );
}

export default App;