import * as THREE from 'three';

export class MissionManager {
    constructor(scene, navRadar, windFarm, helicopterSystems) {
        this.scene = scene;
        this.navRadar = navRadar;
        this.windFarm = windFarm;
        this.helicopterSystems = helicopterSystems;
        this.missions = new Map();

        this.missionState = 'READY'; // READY, ACTIVE, COMPLETED
        this.currentMissionType = null;

        this.registerPermanentLandmarks();
        this.spawnNextMission();
    }

    registerPermanentLandmarks() {
        // Main Base (Blue)
        this.navRadar.addOrUpdateMarker('main_base', new THREE.Vector3(0, 0, 0), '#3498db', 'BASE');
        
        // Wind Farm (Green initially)
        if (this.windFarm) {
            this.navRadar.addOrUpdateMarker('wind_farm', this.windFarm, '#2ecc71', 'WIND');
        }
    }

    spawnNextMission() {
        const missionTypes = ['WTG_FIRE'];
        const chosenType = missionTypes[Math.floor(Math.random() * missionTypes.length)];

        this.currentMissionType = chosenType;
        this.missionState = 'ACTIVE';

        if (chosenType === 'WTG_FIRE' && this.windFarm) {
            this.windFarm.setTurbineFire(0, true);
            const turbinePos = this.windFarm.getTurbineWorldPosition(0);
            this.navRadar.addOrUpdateMarker('wind_farm', turbinePos, '#e74c3c', 'FIRE!');
            console.log('🔥 New WTG Fire Mission Spawned! Radar marker changed to RED.');
        }
    }

    update(delta, playerPosition) {
        if (!this.windFarm || !this.helicopterSystems) return;

        // Universal Main Base Restocking Logic
        const distToBase = playerPosition.distanceTo(new THREE.Vector3(0, 0, 0));
        const player = this.helicopterSystems.playerRef;
        const isNearBase = distToBase < 25.0;
        const isLanded = player && player.gearDown === true;
        const engineOff = player && (player.engineState === 'OFF' || player.engineState === 'SHUTTING_DOWN');

        if (isNearBase && isLanded && engineOff) {
            let duration = 3.0;
            let currentTime = 0.0;

            if (player.audioManager) {
                const audioDuration = player.audioManager.getShutdownDuration();
                const audioCurrentTime = player.audioManager.getShutdownCurrentTime();
                if (audioDuration && !isNaN(audioDuration) && audioDuration > 0) {
                    duration = audioDuration;
                }
                if (audioCurrentTime !== undefined && !isNaN(audioCurrentTime)) {
                    currentTime = audioCurrentTime;
                }
            }

            // Calculate remaining audio time, ensuring we don't divide by zero
            const timeRemaining = Math.max(0.1, duration - currentTime);

            // Proportional rates based on remaining deficit and remaining time
            const fuelDeficit = Math.max(0, this.helicopterSystems.maxFuel - this.helicopterSystems.fuel);
            const waterDeficit = Math.max(0, this.helicopterSystems.maxWater - this.helicopterSystems.water);

            const fuelRate = fuelDeficit / timeRemaining;
            const waterRate = waterDeficit / timeRemaining;

            this.helicopterSystems.fuel = Math.min(this.helicopterSystems.maxFuel, this.helicopterSystems.fuel + delta * fuelRate);
            this.helicopterSystems.water = Math.min(this.helicopterSystems.maxWater, this.helicopterSystems.water + delta * waterRate);
        }

        // Handle Active Mission Logic
        if (this.missionState === 'ACTIVE') {
            if (this.currentMissionType === 'WTG_FIRE') {
                const isOnFire = this.windFarm.isTurbineOnFire(0);
                if (!isOnFire) {
                    this.windFarm.setTurbineFire(0, false);
                    this.navRadar.addOrUpdateMarker('wind_farm', this.windFarm, '#2ecc71', 'WIND');
                    console.log('🎉 WTG Fire Extinguished! Return to Main Base to restock & spawn next mission.');
                    this.missionState = 'COMPLETED';
                } else {
                    const turbinePos = this.windFarm.getTurbineWorldPosition(0);
                    const dist = playerPosition.distanceTo(turbinePos);
                    const isSprayingWater = this.helicopterSystems.isWaterActive();

                    if (dist < 35.0 && isSprayingWater) {
                        this.windFarm.setTurbineFire(0, false);
                    }
                }
            }
        }

        // Handle Next Mission Spawn after restocking
        else if (this.missionState === 'COMPLETED') {
            if (isNearBase && isLanded && engineOff) {
                if (this.helicopterSystems.fuel >= this.helicopterSystems.maxFuel && 
                    this.helicopterSystems.water >= this.helicopterSystems.maxWater) {
                    console.log('✅ Restocking Complete! Spawning next mission...');
                    this.spawnNextMission();
                }
            }
        }
    }
}