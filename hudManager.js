// hudManager.js
import * as THREE from 'three';

export class HudManager {
    constructor(player, helicopterSystems, searchLightSystem) {
        this.player = player;
        this.helicopterSystems = helicopterSystems;
        this.searchLightSystem = searchLightSystem;
        this._lastHudUpdate = 0;

        this.createResourceHud();
    }

    createResourceHud() {
        const hudContainer = document.createElement('div');
        hudContainer.id = 'glass-aviation-hud';
        hudContainer.style.cssText = `
            position: fixed;
            bottom: 25px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            gap: 20px;
            pointer-events: none;
            z-index: 999;
            font-family: monospace;
        `;

        hudContainer.innerHTML = `
            <!-- FUEL GAUGE -->
            <div style="display: flex; flex-direction: column; align-items: center; padding: 4px;">
                <div style="font-size: 9px; color: rgba(255, 255, 255, 0.7); margin-bottom: 4px; letter-spacing: 1px; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">FUEL</div>
                <div style="width: 6px; height: 50px; background: rgba(255, 255, 255, 0.15); border-radius: 3px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; box-shadow: 0 0 6px rgba(0,0,0,0.5);">
                    <div id="fuel-bar-fill" style="width: 100%; height: 100%; background: linear-gradient(to top, #3b82f6, #60a5fa); border-radius: 3px;"></div>
                </div>
            </div>

            <!-- CENTRAL HUD ICONS -->
            <div style="display: flex; gap: 14px; align-items: center; pointer-events: auto;">
                <button id="hud-engine-btn" title="Toggle Engine (E)" style="background: transparent; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; opacity: 0.9; color: #ffffff;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 10V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v4"></path>
                        <path d="M4 10h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8z"></path>
                        <line x1="2" y1="14" x2="4" y2="14"></line>
                        <line x1="20" y1="14" x2="22" y2="14"></line>
                        <line x1="9" y1="10" x2="9" y2="15"></line>
                        <line x1="15" y1="10" x2="15" y2="15"></line>
                    </svg>
                </button>

                <button id="hud-gear-btn" title="Toggle Landing Gear (G)" style="background: transparent; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; opacity: 0.9; color: #22c55e;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="3.5"></circle>
                        <circle cx="5" cy="19" r="3.5"></circle>
                        <circle cx="19" cy="19" r="3.5"></circle>
                    </svg>
                </button>

                <button id="hud-light-btn" title="Toggle Searchlight (L)" style="display: none; background: transparent; border: none; cursor: pointer; padding: 4px; align-items: center; justify-content: center; opacity: 0.9; color: #ffffff;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="5"></circle>
                        <line x1="12" y1="1" x2="12" y2="3"></line>
                        <line x1="12" y1="21" x2="12" y2="23"></line>
                    </svg>
                </button>

                <button id="hud-tool-btn" title="Toggle Tool Mode (1 or 2)" style="background: transparent; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; opacity: 0.9; color: #ffffff;">
                    <svg id="hud-tool-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                    </svg>
                </button>
            </div>

            <!-- WATER GAUGE -->
            <div style="display: flex; flex-direction: column; align-items: center; padding: 4px;">
                <div style="font-size: 9px; color: rgba(255, 255, 255, 0.7); margin-bottom: 4px; letter-spacing: 1px; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">WATER</div>
                <div style="width: 6px; height: 50px; background: rgba(255, 255, 255, 0.15); border-radius: 3px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; box-shadow: 0 0 6px rgba(0,0,0,0.5);">
                    <div id="water-bar-fill" style="width: 100%; height: 100%; background: linear-gradient(to top, #0ea5e9, #38bdf8); border-radius: 3px;"></div>
                </div>
            </div>
        `;
        document.body.appendChild(hudContainer);

        document.getElementById('hud-engine-btn').addEventListener('click', () => {
            if (this.player && typeof this.player.handleEngineKey === 'function') {
                this.player.handleEngineKey();
            }
        });

        document.getElementById('hud-gear-btn').addEventListener('click', () => {
            if (this.player && typeof this.player.toggleGear === 'function') {
                this.player.toggleGear();
            }
        });

        document.getElementById('hud-light-btn').addEventListener('click', () => {
            if (this.searchLightSystem) {
                this.searchLightSystem.cycleState(null);
            }
        });

        document.getElementById('hud-tool-btn').addEventListener('click', () => {
            if (this.helicopterSystems) {
                const isWaterFull = this.helicopterSystems.water >= this.helicopterSystems.maxWater;
                if (this.helicopterSystems.activeToolKey === 'WATER') {
                    if (!isWaterFull) this.helicopterSystems.setTool('WINCH');
                } else {
                    this.helicopterSystems.setTool('WATER');
                }
            }
        });
    }

    showSearchlightIcon() {
        const lightBtn = document.getElementById('hud-light-btn');
        if (lightBtn) lightBtn.style.display = 'flex';
    }

    hideSearchlightIcon() {
        const lightBtn = document.getElementById('hud-light-btn');
        if (lightBtn) lightBtn.style.display = 'none';
    }

    update() {
        const now = performance.now();
        if (now - this._lastHudUpdate < 100) return; // Throttled to 100ms to eliminate DOM layout lag
        this._lastHudUpdate = now;

        if (!this.helicopterSystems) return;

        const fuelPercent = Math.max(0, Math.min(100, Math.round(this.helicopterSystems.fuel)));
        const waterPercent = Math.max(0, Math.min(100, Math.round(this.helicopterSystems.water)));

        const fuelFill = document.getElementById('fuel-bar-fill');
        const waterFill = document.getElementById('water-bar-fill');

        if (fuelFill) {
            fuelFill.style.height = `${fuelPercent}%`;
            fuelFill.style.background = fuelPercent <= 20 ? 'linear-gradient(to top, #ef4444, #f87171)' : 'linear-gradient(to top, #3b82f6, #60a5fa)';
        }

        if (waterFill) {
            waterFill.style.height = `${waterPercent}%`;
        }

        const engineBtn = document.getElementById('hud-engine-btn');
        if (engineBtn && this.player) {
            const state = this.player.engineState;
            if (state === 'STARTING') {
                engineBtn.style.color = '#eab308';
            } else if (state === 'RUNNING') {
                engineBtn.style.color = '#22c55e';
            } else if (state === 'SHUTTING_DOWN' || state === 'CRASHED') {
                engineBtn.style.color = '#ef4444';
            } else {
                engineBtn.style.color = '#ffffff';
            }
        }

        const gearBtn = document.getElementById('hud-gear-btn');
        if (gearBtn && this.player) {
            gearBtn.style.color = this.player.gearDown ? '#22c55e' : '#ffffff';
        }

        const toolBtn = document.getElementById('hud-tool-btn');
        const toolIconSvg = document.getElementById('hud-tool-icon');
        if (toolBtn && toolIconSvg && this.helicopterSystems) {
            const activeTool = this.helicopterSystems.activeToolKey;
            if (activeTool === 'WATER') {
                toolBtn.style.color = '#38bdf8';
                toolIconSvg.innerHTML = `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>`;
            } else {
                toolBtn.style.color = '#0ea5e9';
                toolIconSvg.innerHTML = `
                    <path d="M3 6h18v2H3z"></path>
                    <path d="M5 8l2 12h10l2-12"></path>
                    <path d="M12 17v-6"></path>
                    <path d="M9 14l3-3 3 3"></path>
                `;
            }
        }
    }
}