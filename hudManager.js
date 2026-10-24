// hudManager.js
import * as THREE from 'three';

export class HudManager {
    constructor() {
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

            <!-- CENTRAL STATUS TEXT (Tool, Gear, Light) -->
            <div style="display: flex; gap: 12px; align-items: center; text-shadow: 0 1px 4px rgba(0,0,0,0.9);">
                <div id="box-tool" style="color: #60a5fa; font-size: 11px; font-weight: bold; letter-spacing: 1px;">WATER</div>
                <div style="color: rgba(255, 255, 255, 0.3); font-size: 10px;">|</div>
                <div id="box-gear" style="color: #ffffff; font-size: 11px; font-weight: bold; letter-spacing: 1px;">GEAR DOWN</div>
                <div style="color: rgba(255, 255, 255, 0.3); font-size: 10px;">|</div>
                <div id="box-light" style="color: rgba(255, 255, 255, 0.5); font-size: 11px; font-weight: bold; letter-spacing: 1px;">LIGHT OFF</div>
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
    }

    update(helicopterSystems, searchLightSystem) {
        if (!helicopterSystems) return;

        // 1. Update Resource Bars
        const fuelPercent = Math.max(0, Math.min(100, Math.round(helicopterSystems.fuel)));
        const waterPercent = Math.max(0, Math.min(100, Math.round(helicopterSystems.water)));

        const fuelFill = document.getElementById('fuel-bar-fill');
        const waterFill = document.getElementById('water-bar-fill');

        if (fuelFill) {
            fuelFill.style.height = `${fuelPercent}%`;
            fuelFill.style.background = fuelPercent <= 20 ? 'linear-gradient(to top, #ef4444, #f87171)' : 'linear-gradient(to top, #3b82f6, #60a5fa)';
        }

        if (waterFill) {
            waterFill.style.height = `${waterPercent}%`;
        }

        // 2. Update Tool Mode Box
        const boxTool = document.getElementById('box-tool');
        if (boxTool) {
            boxTool.textContent = helicopterSystems.activeToolKey === 'WATER' ? 'WATER' : 'WINCH';
        }

        // 3. Update Landing Gear Box
        const player = helicopterSystems.playerRef;
        const boxGear = document.getElementById('box-gear');
        if (boxGear && player) {
            boxGear.textContent = player.gearDown ? 'GEAR DOWN' : 'GEAR UP';
            boxGear.style.color = player.gearDown ? '#34d399' : '#93c5fd';
        }

        // 4. Update Searchlight Box
        const boxLight = document.getElementById('box-light');
        if (boxLight && searchLightSystem) {
            if (searchLightSystem.state === 'OFF') {
                boxLight.textContent = 'LIGHT OFF';
                boxLight.style.color = 'rgba(255, 255, 255, 0.5)';
            } else if (searchLightSystem.state === 'LOCKED') {
                boxLight.textContent = 'LIGHT LOCKED';
                boxLight.style.color = '#f59e0b';
            } else {
                boxLight.textContent = 'LIGHT ON';
                boxLight.style.color = '#34d399';
            }
        }
    }
}