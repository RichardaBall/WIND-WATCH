export class HudManager {
    constructor() {
        this.createInstructionsOverlay();
        this.createMissionStatusOverlay();
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
            z-index: 100;
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

    createMissionStatusOverlay() {
        const info = document.createElement('div');
        info.id = 'mission-hud-overlay';
        info.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.85);
            padding: 10px 14px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #ffffff;
            font-family: monospace;
            font-size: 11px;
            z-index: 100;
            line-height: 1.4;
        `;
        info.innerHTML = `
            <strong>WTG Mission Testing</strong><br>
            [ F ]: Toggle Sparks & Smoke Stack (<span id="spark-status" style="color: #ff4444;">NORMAL</span>)
        `;
        document.body.appendChild(info);
    }

    updateSparkStatus(isSparking) {
        const statusEl = document.getElementById('spark-status');
        if (statusEl) {
            statusEl.innerText = isSparking ? 'FAULT SPARKING ⚡' : 'NORMAL';
            statusEl.style.color = isSparking ? '#00ccff' : '#ff4444';
        }
    }
}