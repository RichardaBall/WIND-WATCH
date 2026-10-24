import * as THREE from 'three';

export class CollisionManager {
    constructor(scene, player, windFarm) {
        this.scene = scene;
        this.player = player;
        this.windFarm = windFarm;
        
        // Array to store custom collapsible objects or obstacles added in future missions
        this.obstacles = [];
    }

    addObstacle(position, radius, minHeight = 0, maxHeight = 50) {
        this.obstacles.push({ position, radius, minHeight, maxHeight });
    }

    clearObstacles() {
        this.obstacles = [];
    }

    update() {
        if (!this.player || this.player.engineState !== 'RUNNING' || this.player.hasCrashed) {
            return;
        }

        const playerPos = this.player.getPosition();

        // 1. Check Wind Turbine Generators (WTGs)
        if (this.windFarm && this.windFarm.turbines) {
            for (let i = 0; i < this.windFarm.turbines.length; i++) {
                const turbine = this.windFarm.turbines[i];
                const turbinePos = new THREE.Vector3();
                turbine.group.getWorldPosition(turbinePos);

                const dx = playerPos.x - turbinePos.x;
                const dz = playerPos.z - turbinePos.z;
                const horizDist = Math.sqrt(dx * dx + dz * dz);

                // Cylinder collision restricted to the lower tower structure (height: 0m to 20m)
                // This lets you safely hover at the hub/fire level above 20m to drop water.
                if (horizDist < 5.5 && playerPos.y >= 0 && playerPos.y <= 20.0) {
                    console.log(`💥 Collision detected: Wind Turbine Generator ${i} tower!`);
                    this.player.triggerCrash(false);
                    return;
                }
            }
        }

        // 2. Check Custom Mission Obstacles
        for (const obs of this.obstacles) {
            const dx = playerPos.x - obs.position.x;
            const dz = playerPos.z - obs.position.z;
            const horizDist = Math.sqrt(dx * dx + dz * dz);

            if (horizDist < obs.radius && playerPos.y >= obs.minHeight && playerPos.y <= obs.maxHeight) {
                console.log(`💥 Collision detected with obstacle at (${obs.position.x}, ${obs.position.z})!`);
                this.player.triggerCrash(false);
                return;
            }
        }
    }
}