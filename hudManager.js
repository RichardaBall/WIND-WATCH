export class HudManager {
    constructor() {
        this.createResourceHud();
    }

    createResourceHud() {
        const svgContainer = document.createElement('div');
        svgContainer.id = 'curved-resources-hud';
        svgContainer.style.cssText = `
            position: absolute;
            bottom: 15px;
            left: 50%;
            transform: translateX(-50%);
            width: 320px;
            height: 170px;
            pointer-events: none;
            z-index: 999;
        `;

        svgContainer.innerHTML = `
            <svg width="320" height="170" viewBox="0 0 320 170" style="overflow: visible;">
                <defs>
                    <!-- CRT Radar Green Glow & Style -->
                    <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>

                <!-- FUEL TUBE (Left Arc) -->
                <!-- Background / Empty tube (Dark Radar Green) -->
                <path d="M 16 155 A 144 144 0 0 1 160 11" fill="none" stroke="rgba(10, 45, 20, 0.9)" stroke-width="8" stroke-linecap="round" />
                <path d="M 16 155 A 144 144 0 0 1 160 11" fill="none" stroke="rgba(46, 204, 113, 0.15)" stroke-width="6" stroke-linecap="round" />
                <!-- Active Fluid Level (Vibrant Radar Green) -->
                <path id="fuel-liquid-path" d="M 16 155 A 144 144 0 0 1 160 11" fill="none" stroke="#2ecc71" stroke-width="4.5" stroke-linecap="round" filter="url(#radarGlow)" style="stroke-dasharray: 226; stroke-dashoffset: 0;" />
                <path d="M 16 155 A 144 144 0 0 1 160 11" fill="none" stroke="rgba(255, 255, 255, 0.35)" stroke-width="1.2" stroke-linecap="round" transform="translate(0, -1)" />

                <!-- WATER TUBE (Right Arc) -->
                <!-- Background / Empty tube (Dark Radar Green) -->
                <path d="M 160 11 A 144 144 0 0 1 304 155" fill="none" stroke="rgba(10, 45, 20, 0.9)" stroke-width="8" stroke-linecap="round" />
                <path d="M 160 11 A 144 144 0 0 1 304 155" fill="none" stroke="rgba(46, 204, 113, 0.15)" stroke-width="6" stroke-linecap="round" />
                <!-- Active Fluid Level (Vibrant Radar Green) -->
                <path id="water-liquid-path" d="M 160 11 A 144 144 0 0 1 304 155" fill="none" stroke="#2ecc71" stroke-width="4.5" stroke-linecap="round" filter="url(#radarGlow)" style="stroke-dasharray: 226; stroke-dashoffset: 0;" />
                <path d="M 160 11 A 144 144 0 0 1 304 155" fill="none" stroke="rgba(255, 255, 255, 0.35)" stroke-width="1.2" stroke-linecap="round" transform="translate(0, -1)" />

                <!-- THREE SMALL STATUS BOXES FITTED INSIDE THE BASE -->
                
                <!-- Left Box: Tool Mode -->
                <g transform="translate(62, 162)">
                    <rect width="65" height="18" rx="2" fill="rgba(10, 45, 20, 0.95)" stroke="#2ecc71" stroke-width="1" filter="url(#radarGlow)" />
                    <text id="text-tool" x="30" y="12" fill="#2ecc71" font-family="monospace" font-size="8" font-weight="bold" text-anchor="middle" letter-spacing="0.5">WATER</text>
                </g>

                <!-- Middle Box: Gear State -->
                <g transform="translate(130, 162)">
                    <rect width="65" height="18" rx="2" fill="rgba(10, 45, 20, 0.95)" stroke="#2ecc71" stroke-width="1" filter="url(#radarGlow)" />
                    <text id="text-gear" x="30" y="12" fill="#2ecc71" font-family="monospace" font-size="8" font-weight="bold" text-anchor="middle" letter-spacing="0.5">GEAR DOWN</text>
                </g>

                <!-- Right Box: Light State -->
                <g transform="translate(198, 162)">
                    <rect width="65" height="18" rx="2" fill="rgba(10, 45, 20, 0.95)" stroke="#2ecc71" stroke-width="1" filter="url(#radarGlow)" />
                    <text id="text-light" x="30" y="12" fill="#2ecc71" font-family="monospace" font-size="8" font-weight="bold" text-anchor="middle" letter-spacing="0.5">LIGHT OFF</text>
                </g>
            </svg>
        `;
        document.body.appendChild(svgContainer);
    }

    update(helicopterSystems, searchLightSystem) {
        if (!helicopterSystems) return;

        // 1. Update Resource Gauges
        const fuelPercent = Math.max(0, Math.min(100, Math.round(helicopterSystems.fuel)));
        const waterPercent = Math.max(0, Math.min(100, Math.round(helicopterSystems.water)));

        const fuelPath = document.getElementById('fuel-liquid-path');
        const waterPath = document.getElementById('water-liquid-path');

        const totalLength = 226.2; // Arc length for radius 144

        if (fuelPath) {
            const fuelOffset = totalLength * (1 - (fuelPercent / 100));
            fuelPath.style.strokeDashoffset = fuelOffset;
        }

        if (waterPath) {
            const waterOffset = totalLength * (waterPercent / 100) - totalLength;
            waterPath.style.strokeDashoffset = waterOffset;
        }

        // 2. Update Tool Mode Box
        const textTool = document.getElementById('text-tool');
        if (textTool) {
            textTool.textContent = helicopterSystems.activeToolKey === 'WATER' ? 'WATER' : 'WINCH';
        }

        // 3. Update Landing Gear Box
        const player = helicopterSystems.playerRef;
        const textGear = document.getElementById('text-gear');
        if (textGear && player) {
            textGear.textContent = player.gearDown ? 'GEAR DOWN' : 'GEAR UP';
        }

        // 4. Update Searchlight Box
        const textLight = document.getElementById('text-light');
        if (textLight && searchLightSystem) {
            if (searchLightSystem.state === 'OFF') {
                textLight.textContent = 'LIGHT OFF';
            } else if (searchLightSystem.state === 'LOCKED') {
                textLight.textContent = 'LIGHT LOCKED';
            } else {
                textLight.textContent = 'LIGHT ON';
            }
        }
    }
}