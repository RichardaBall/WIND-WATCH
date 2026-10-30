// main.js
import { Game } from './game.js';

// Initialize and start the core game engine
const game = new Game();
game.init();

// Expose game instance globally for console debugging/testing
window.game = game;