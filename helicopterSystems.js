import { WaterSystem } from './waterSystem.js';
import { WinchSystem } from './winchSystem.js';

export class HelicopterSystems {
    constructor(scene, helicopterGroup, playerRef) {
        this.scene = scene;
        this.helicopterGroup = helicopterGroup;
        this.playerRef = playerRef;

        this.tools = {
            WATER: new WaterSystem(scene, helicopterGroup, playerRef),
            WINCH: new WinchSystem(scene, helicopterGroup)
        };

        this.activeToolKey = 'WATER';
    }

    setTool(toolKey) {
        if (this.tools[toolKey]) {
            this.activeToolKey = toolKey;
            console.log(`Switched to tool: ${toolKey}`);
        }
    }

    startActiveTool() {
        const activeTool = this.tools[this.activeToolKey];
        if (activeTool && typeof activeTool.start === 'function') {
            activeTool.start();
        } else if (activeTool && typeof activeTool.toggle === 'function') {
            activeTool.toggle();
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

    update(delta) {
        for (const key in this.tools) {
            if (this.tools[key].update) {
                this.tools[key].update(delta);
            }
        }
    }
}