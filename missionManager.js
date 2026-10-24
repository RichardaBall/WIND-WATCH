import * as THREE from 'three';

export class MissionManager {
    constructor(scene, navRadar, windFarm, helicopterSystems) {
        this.scene = scene;
        this.navRadar = navRadar;
        this.windFarm = windFarm;
        this.helicopterSystems = helicopterSystems;

        this.missionState = 'READY'; // READY, ACTIVE, COMPLETED
        this.currentMissionType = null;
        this.currentTurbineIndex = 0;

        this.registerPermanentLandmarks();
        
        setTimeout(() => {
            this.spawnNextMission();
        }, 100);
    }

    registerPermanentLandmarks() {
        // Main Base (Blue) - Always points to Base
        this.navRadar.addOrUpdateMarker('main_base', new THREE.Vector3(0, 0, 0), '#3498db', 'BASE');
        
        // Wind Farm Center Point (Green)
        if (this.windFarm && this.windFarm.turbines.length > 0) {
            const centerPos = this.getWindFarmCenter();
            this.navRadar.addOrUpdateMarker('wind_farm', centerPos, '#2ecc71', 'WIND');
        }
    }

    getWindFarmCenter() {
        if (!this.windFarm || this.windFarm.turbines.length === 0) return new THREE.Vector3(380, 20, -320);
        const center = new THREE.Vector3();
        this.windFarm.turbines.forEach(turbine => {
            const pos = new THREE.Vector3();
            turbine.group.getWorldPosition(pos);
            center.add(pos);
        });
        center.divideScalar(this.windFarm.turbines.length);
        center.y += 20; // Hub height
        return center;
    }

    spawnNextMission() {
        const missionTypes = ['WTG_FIRE'];
        const chosenType = missionTypes[Math.floor(Math.random() * missionTypes.length)];

        this.currentMissionType = chosenType;
        this.missionState = 'ACTIVE';

        if (chosenType === 'WTG_FIRE' && this.windFarm && this.windFarm.turbines.length > 0) {
            this.currentTurbineIndex = Math.floor(Math.random() * this.windFarm.turbines.length);
            this.windFarm.setTurbineFire(this.currentTurbineIndex, true);
            
            // Turn the wind farm pointer RED during an active fire mission
            const centerPos = this.getWindFarmCenter();
            this.navRadar.addOrUpdateMarker('wind_farm', centerPos, '#e74c3c', 'FIRE!');
            console.log(`🔥 New WTG Fire Mission Spawned on turbine index ${this.currentTurbineIndex}!`);
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

            const timeRemaining = Math.max(0.1, duration - currentTime);
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
                const isOnFire = this.windFarm.isTurbineOnFire(this.currentTurbineIndex);
                if (!isOnFire) {
                    this.windFarm.setTurbineFire(this.currentTurbineIndex, false);
                    
                    // Turn the wind farm pointer back to GREEN once extinguished
                    const centerPos = this.getWindFarmCenter();
                    this.navRadar.addOrUpdateMarker('wind_farm', centerPos, '#2ecc71', 'WIND');
                    
                    console.log('🎉 WTG Fire Extinguished! Return to Main Base to restock & spawn next mission.');
                    this.missionState = 'COMPLETED';
                } else {
                    const turbinePos = this.windFarm.getTurbineWorldPosition(this.currentTurbineIndex);
                    const dist = playerPosition.distanceTo(turbinePos);
                    const isSprayingWater = this.helicopterSystems.isWaterActive();

                    if (dist < 35.0 && isSprayingWater) {
                        this.windFarm.setTurbineFire(this.currentTurbineIndex, false);
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