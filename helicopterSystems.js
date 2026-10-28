// helicopterSystems.js
import * as THREE from 'three';
import { WaterSystem } from './waterSystem.js';
import { WinchSystem } from './winchSystem.js';

export class HelicopterSystems {
    constructor(scene, helicopterGroup, playerRef) {
        this.scene = scene;
        this.helicopterGroup = helicopterGroup;
        this.playerRef = playerRef;

        this.tools = {
            WATER: new WaterSystem(scene, helicopterGroup, playerRef),
            WINCH: new WinchSystem(scene, helicopterGroup, playerRef)
        };

        this.activeToolKey = 'WATER';

        // Resource tracking
        this.maxFuel = 100;
        this.fuel = 100;
        this.unlimitedFuel = false; // Added for testing
        this.maxWater = 100;
        this.water = 100;

        this.lowFuelTriggered = false;
    }

    setUnlimitedFuel(enabled) {
        this.unlimitedFuel = enabled;
        if (this.unlimitedFuel) {
            this.fuel = this.maxFuel;
        }
        console.log(`⛽ Unlimited Fuel: ${this.unlimitedFuel ? 'ON' : 'OFF'}`);
    }

    setTool(toolKey) {
        const waterActive = this.tools['WATER'] && this.tools['WATER'].isActive;
        const winchActive = this.playerRef && this.playerRef.winchState !== 'STOWED';

        if (waterActive || winchActive) {
            console.log("Cannot switch tools while a tool is currently active or deployed!");
            return;
        }

        if (this.tools[toolKey]) {
            if (this.activeToolKey === 'WATER' && toolKey !== 'WATER') {
                this.tools['WATER'].stop();
            }
            this.activeToolKey = toolKey;
            console.log(`Switched to tool: ${toolKey}`);
        }
    }

    startActiveTool() {
        if (this.water <= 0 && this.activeToolKey === 'WATER') {
            console.log("Water tanks empty!");
            return;
        }
        const activeTool = this.tools[this.activeToolKey];
        if (activeTool && typeof activeTool.start === 'function') {
            activeTool.start();
        }
    }

    stopActiveTool() {
        const activeTool = this.tools[this.activeToolKey];
        if (activeTool && typeof activeTool.stop === 'function') {
            activeTool.stop();
        }
    }

    toggleActiveTool() {
        const activeTool = this.tools[this.activeToolKey];
        if (activeTool && typeof activeTool.toggle === 'function') {
            activeTool.toggle();
        }
    }

    isWaterActive() {
        return this.activeToolKey === 'WATER' && this.tools['WATER'].isActive && this.water > 0;
    }

    update(delta) {
        // Deplete water if spraying
        if (this.isWaterActive()) {
            this.water = Math.max(0, this.water - delta * 15);
            if (this.water <= 0) {
                this.stopActiveTool();
                console.log("Water tanks depleted!");
            }
        }

        // Refill water at a constant rate when winch is deployed and at sea level
        const winchTool = this.tools['WINCH'];
        const isWinchAtSeaLevel = winchTool && winchTool.isActive && winchTool.currentExtension > 0.95 && winchTool.hookWorldPos.y <= 0.5;
        if (isWinchAtSeaLevel) {
            this.water = Math.min(this.maxWater, this.water + delta * 30);
        }

        // Deplete fuel only when the engine state is RUNNING
        const engineRunning = this.playerRef && this.playerRef.engineState === 'RUNNING';
        if (engineRunning) {
            if (this.unlimitedFuel) {
                this.fuel = this.maxFuel;
            } else {
                const gearIsDown = this.playerRef && this.playerRef.gearDown;
                const fuelBurnRate = gearIsDown ? 0.6 : 0.5;
                this.fuel = Math.max(0, this.fuel - delta * fuelBurnRate);

                if (this.fuel <= 20 && !this.lowFuelTriggered) {
                    this.lowFuelTriggered = true;
                    if (this.playerRef && this.playerRef.audioManager) {
                        this.playerRef.audioManager.playLowFuel();
                        console.log("Low fuel warning triggered!");
                    }
                }

                if (this.fuel <= 0) {
                    if (this.playerRef && typeof this.playerRef.shutdownEngine === 'function') {
                        this.playerRef.shutdownEngine();
                        console.log("Fuel depleted! Initiating engine shutdown...");
                    }
                }
            }
        }

        if (this.fuel > 20) {
            this.lowFuelTriggered = false;
        }

        for (const key in this.tools) {
            if (this.tools[key].update) {
                this.tools[key].update(delta);
            }
        }
    }
}