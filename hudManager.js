export class HudManager {
    constructor() {
        this.createInstructionsOverlay();
        this.createResourceHud();
    }

    createInstructionsOverlay() {
        const instructions = document.createElement('div');
        instructions.id = 'instructions';
        instructions.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            color: #ffffff;
            background: rgba(0, 0, 0, 0.6);
            padding: 10px 15px;
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            pointer-events: none;
            font-size: 13px;
            line-height: 1.5;
            font-family: monospace;
            z-index: 999;
        `;
        instructions.innerHTML = `
            <strong>CONTROLS:</strong><br>
            Click Map: Move Helicopter<br>
            G Key: Toggle Landing Gear<br>
            E Key: Start / Stop Engine<br>
            L Key: Cycle Searchlight<br>
            1 / 2 Keys: Select Water / Winch<br>
            Space: Activate Tool<br>
            T Key: Toggle Dev Settings<br>
            Zoom: Mouse Wheel
        `;
        document.body.appendChild(instructions);
    }

    createResourceHud() {
        const hud = document.createElement('div');
        hud.id = 'resource-hud';
        hud.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            color: #ffffff;
            background: rgba(0, 0, 0, 0.8);
            padding: 15px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            pointer-events: none;
            font-size: 13px;
            font-family: monospace;
            z-index: 999;
            width: 180px;
            display: block;
        `;
        hud.innerHTML = `
            <div style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>FUEL:</span>
                    <span id="fuel-text">100%</span>
                </div>
                <div style="background: #444; height: 10px; border-radius: 3px; overflow: hidden;">
                    <div id="fuel-bar" style="background: #e67e22; width: 100%; height: 100%;"></div>
                </div>
            </div>
            <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>WATER:</span>
                    <span id="water-text">100%</span>
                </div>
                <div style="background: #444; height: 10px; border-radius: 3px; overflow: hidden;">
                    <div id="water-bar" style="background: #3498db; width: 100%; height: 100%;"></div>
                </div>
            </div>
        `;
        document.body.appendChild(hud);
    }

    update(helicopterSystems) {
        if (!helicopterSystems) return;

        const fuelPercent = Math.max(0, Math.min(100, Math.round(helicopterSystems.fuel)));
        const waterPercent = Math.max(0, Math.min(100, Math.round(helicopterSystems.water)));

        const fuelBar = document.getElementById('fuel-bar');
        const fuelText = document.getElementById('fuel-text');
        const waterBar = document.getElementById('water-bar');
        const waterText = document.getElementById('water-text');

        if (fuelBar && fuelText) {
            fuelBar.style.width = `${fuelPercent}%`;
            fuelText.innerText = `${fuelPercent}%`;
        }

        if (waterBar && waterText) {
            waterBar.style.width = `${waterPercent}%`;
            waterText.innerText = `${waterPercent}%`;
        }
    }
}