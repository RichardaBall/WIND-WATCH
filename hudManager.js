// hudManager.js
import * as THREE from 'three';

export class HudManager {
    constructor(player, helicopterSystems, searchLightSystem) {
        this.player = player;
        this.helicopterSystems = helicopterSystems;
        this.searchLightSystem = searchLightSystem;

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
                    <div id="fuel-bar-fill" style="width: 100%; height: 100%; background: linear-gradient(to top, #3b82f6, #60a5fa); border-radius: 3px; transition: height 0.2s;"></div>
                </div>
            </div>

            <!-- CENTRAL HUD ICONS (Engine, Gear, Tool/Winch, Light) -->
            <div style="display: flex; gap: 14px; align-items: center; pointer-events: auto;">
                <!-- ENGINE BUTTON (Mechanical Engine Block Icon) -->
                <button id="hud-engine-btn" title="Toggle Engine (E)" style="background: transparent; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; transition: transform 0.2s, color 0.2s; opacity: 0.9; color: #ffffff;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 10V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v4"></path>
                        <path d="M4 10h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8z"></path>
                        <line x1="2" y1="14" x2="4" y2="14"></line>
                        <line x1="20" y1="14" x2="22" y2="14"></line>
                        <line x1="9" y1="10" x2="9" y2="15"></line>
                        <line x1="15" y1="10" x2="15" y2="15"></line>
                    </svg>
                </button>

                <!-- LANDING GEAR BUTTON (3 circles in a triangle arrangement) -->
                <button id="hud-gear-btn" title="Toggle Landing Gear (G)" style="background: transparent; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; transition: transform 0.2s, color 0.2s; opacity: 0.9; color: #22c55e;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="3.5"></circle>
                        <circle cx="5" cy="19" r="3.5"></circle>
                        <circle cx="19" cy="19" r="3.5"></circle>
                    </svg>
                </button>

                <!-- WATER / WINCH BUTTON -->
                <button id="hud-tool-btn" title="Switch Water / Winch (1 / 2)" style="background: transparent; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; transition: transform 0.2s, color 0.2s; opacity: 0.9; color: #3b82f6;">
                    <svg id="hud-tool-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                    </svg>
                </button>

                <!-- LIGHT INDICATOR BUTTON -->
                <button id="hud-light-btn" title="Toggle Searchlight (L)" style="background: transparent; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; transition: transform 0.2s, color 0.2s; opacity: 0.9; color: #ffffff;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="5"></circle>
                        <line x1="12" y1="1" x2="12" y2="3"></line>
                        <line x1="12" y1="21" x2="12" y2="23"></line>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                        <line x1="1" y1="12" x2="3" y2="12"></line>
                        <line x1="21" y1="12" x2="23" y2="12"></line>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                    </svg>
                </button>
            </div>

            <!-- WATER GAUGE -->
            <div style="display: flex; flex-direction: column; align-items: center; padding: 4px;">
                <div style="font-size: 9px; color: rgba(255, 255, 255, 0.7); margin-bottom: 4px; letter-spacing: 1px; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">WATER</div>
                <div style="width: 6px; height: 50px; background: rgba(255, 255, 255, 0.15); border-radius: 3px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; box-shadow: 0 0 6px rgba(0,0,0,0.5);">
                    <div id="water-bar-fill" style="width: 100%; height: 100%; background: linear-gradient(to top, #0ea5e9, #38bdf8); border-radius: 3px; transition: height 0.2s;"></div>
                </div>
            </div>
        `;
        document.body.appendChild(hudContainer);

        // Bind click event listeners
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

        document.getElementById('hud-tool-btn').addEventListener('click', () => {
            if (this.helicopterSystems) {
                const nextTool = this.helicopterSystems.activeToolKey === 'WATER' ? 'WINCH' : 'WATER';
                this.helicopterSystems.setTool(nextTool);
            }
        });

        document.getElementById('hud-light-btn').addEventListener('click', () => {
            if (this.searchLightSystem) {
                this.searchLightSystem.cycleState(null);
            }
        });
    }

    update() {
        if (!this.helicopterSystems) return;

        // 1. Update Resource Bars
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

        // 2. Update Engine Icon State Colours (White when off, flash yellow when starting, green when running, flash red when shutting down, solid red when crashed)
        const engineBtn = document.getElementById('hud-engine-btn');
        if (engineBtn && this.player) {
            const state = this.player.engineState;
            if (state === 'STARTING') {
                const flash = Math.floor(Date.now() / 300) % 2 === 0;
                engineBtn.style.color = flash ? '#eab308' : 'rgba(255, 255, 255, 0.3)';
            } else if (state === 'RUNNING') {
                engineBtn.style.color = '#22c55e';
            } else if (state === 'SHUTTING_DOWN') {
                const flash = Math.floor(Date.now() / 300) % 2 === 0;
                engineBtn.style.color = flash ? '#ef4444' : 'rgba(255, 255, 255, 0.3)';
            } else if (state === 'CRASHED') {
                engineBtn.style.color = '#ef4444';
            } else {
                // OFF
                engineBtn.style.color = '#ffffff';
            }
        }

        // 3. Update Landing Gear Icon (Green when down, White when up)
        const gearBtn = document.getElementById('hud-gear-btn');
        if (gearBtn && this.player) {
            gearBtn.style.color = this.player.gearDown ? '#22c55e' : '#ffffff';
        }

        // 4. Update Tool Icon (Water droplet vs J hook)
        const toolBtn = document.getElementById('hud-tool-btn');
        const toolIcon = document.getElementById('hud-tool-icon');
        if (toolBtn && toolIcon) {
            const isWater = this.helicopterSystems.activeToolKey === 'WATER';
            if (isWater) {
                toolBtn.style.color = '#3b82f6';
                toolIcon.innerHTML = `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>`;
            } else {
                toolBtn.style.color = '#f97316';
                toolIcon.innerHTML = `<path d="M14 3v11a5 5 0 0 1-10 0"></path>`;
            }
        }

        // 5. Update Searchlight Icon (White when off, Green when on, Red when locked)
        const lightBtn = document.getElementById('hud-light-btn');
        if (lightBtn && this.searchLightSystem) {
            if (this.searchLightSystem.state === 'OFF') {
                lightBtn.style.color = '#ffffff';
            } else if (this.searchLightSystem.state === 'LOCKED') {
                lightBtn.style.color = '#ef4444';
            } else {
                lightBtn.style.color = '#22c55e';
            }
        }
    }
}