import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvas) throw new Error('Canvas #game-canvas не найден');

const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D-контекст недоступен');

canvas.width = 360;
canvas.height = 360;

ctx.fillStyle = '#f2ebe0';
ctx.fillRect(0, 0, canvas.width, canvas.height);

ctx.strokeStyle = '#8a7f6d';
ctx.lineWidth = 4;
ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
