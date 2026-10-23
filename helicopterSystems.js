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
        this.maxWater = 100;
        this.water = 100;
    }

    setTool(toolKey) {
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

        // Deplete fuel only when the engine state is RUNNING
        const engineRunning = this.playerRef && this.playerRef.engineState === 'RUNNING';
        if (engineRunning) {
            this.fuel = Math.max(0, this.fuel - delta * 1.0);
        }

        for (const key in this.tools) {
            if (this.tools[key].update) {
                this.tools[key].update(delta);
            }
        }
    }
}