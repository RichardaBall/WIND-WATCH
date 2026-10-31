import * as THREE from 'three';

export class CollisionManager {
    constructor(scene, player, windFarm) {
        this.scene = scene;
        this.player = player;
        this.windFarm = windFarm;
        
        this.obstacles = [];

        // Finalized Mainbase Cylinder Collision Zone based on editor settings
        this.mainbaseCylinder = {
            position: new THREE.Vector3(-1.5, 20, 8.0),
            radius: 35.0,
            minHeight: 12.0,
            maxHeight: 28.0
        };
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

        // 1. Check Configurable Mainbase Cylinder Collision (triggered during snorkelling / winch mode)
        const cyl = this.mainbaseCylinder;
        const dx = playerPos.x - cyl.position.x;
        const dz = playerPos.z - cyl.position.z;
        const horizDist = Math.sqrt(dx * dx + dz * dz);

        const isSnorkellingOrWinchActive = (this.player.winchState !== 'STOWED');

        if (horizDist <= cyl.radius && playerPos.y >= cyl.minHeight && playerPos.y <= cyl.maxHeight && isSnorkellingOrWinchActive) {
            console.log("💥 Collision detected: Flew into mainbase collision cylinder while snorkelling!");
            this.player.triggerCrash(false);
            return;
        }

        // 2. Check Wind Turbine Generators (WTGs)
        if (this.windFarm && this.windFarm.turbines) {
            for (let i = 0; i < this.windFarm.turbines.length; i++) {
                const turbine = this.windFarm.turbines[i];
                const turbinePos = new THREE.Vector3();
                turbine.group.getWorldPosition(turbinePos);

                const tdx = playerPos.x - turbinePos.x;
                const tdz = playerPos.z - turbinePos.z;
                const horizDistTurbine = Math.sqrt(tdx * tdx + tdz * tdz);

                if (horizDistTurbine < 5.5 && playerPos.y >= 0 && playerPos.y <= 20.0) {
                    console.log(`💥 Collision detected: Wind Turbine Generator ${i} tower!`);
                    this.player.triggerCrash(false);
                    return;
                }
            }
        }

        // 3. Check Custom Mission Obstacles
        for (const obs of this.obstacles) {
            const odx = playerPos.x - obs.position.x;
            const odz = playerPos.z - obs.position.z;
            const horizDistObs = Math.sqrt(odx * odx + odz * odz);

            if (horizDistObs < obs.radius && playerPos.y >= obs.minHeight && playerPos.y <= obs.maxHeight) {
                console.log(`💥 Collision detected with obstacle at (${obs.position.x}, ${obs.position.z})!`);
                this.player.triggerCrash(false);
                return;
            }
        }
    }
}