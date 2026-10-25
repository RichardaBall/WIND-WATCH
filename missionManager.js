import * as THREE from 'three';
import { LiferaftMission } from './liferaftMission.js';

export class MissionManager {
    constructor(scene, navRadar, windFarm, helicopterSystems, player, camera, searchLightSystem) {
        this.scene = scene;
        this.navRadar = navRadar;
        this.windFarm = windFarm;
        this.helicopterSystems = helicopterSystems;
        this.player = player;
        this.camera = camera;
        this.searchLightSystem = searchLightSystem;

        this.missionState = 'READY'; // READY, ACTIVE
        this.currentMissionType = null; // 'WTG_FIRE' or 'LIFERAFT'
        this.lastMissionType = null;    // Tracks the most recently completed mission
        this.currentTurbineIndex = 0;
        this.extinguishProgress = 0;
        this.liferaftMission = null;

        this.registerPermanentLandmarks();
        
        setTimeout(() => {
            this.spawnRandomMission();
        }, 100);
    }

    registerPermanentLandmarks() {
        // Base is always blue
        this.navRadar.addOrUpdateMarker('main_base', new THREE.Vector3(0, 0, 0), '#3498db', 'BASE');
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
        center.y += 20; 
        return center;
    }

    clearAllMissions() {
        // 1. Clear all wind farm fires and remove wind farm radar marker
        if (this.windFarm && this.windFarm.turbines) {
            for (let i = 0; i < this.windFarm.turbines.length; i++) {
                this.windFarm.setTurbineFire(i, false);
            }
        }
        this.navRadar.removeMarker('wind_farm');

        // 2. Remove liferaft mission if active
        if (this.liferaftMission) {
            if (this.liferaftMission.group) {
                this.scene.remove(this.liferaftMission.group);
            }
            this.navRadar.removeMarker('liferaft');
            this.liferaftMission = null;
        }
        if (this.helicopterSystems && this.helicopterSystems.tools['WINCH']) {
            this.helicopterSystems.tools['WINCH'].setLiferaftMission(null);
        }
    }

    spawnRandomMission() {
        this.clearAllMissions();

        const missionTypes = ['WTG_FIRE', 'LIFERAFT'];
        
        // Filter out the last completed mission to prevent it appearing twice in a row
        let availableTypes = missionTypes;
        if (this.lastMissionType && missionTypes.length > 1) {
            availableTypes = missionTypes.filter(type => type !== this.lastMissionType);
        }

        const chosenType = availableTypes[Math.floor(Math.random() * availableTypes.length)];

        this.currentMissionType = chosenType;
        this.missionState = 'ACTIVE';
        this.extinguishProgress = 0;

        const centerPos = this.getWindFarmCenter();

        if (chosenType === 'WTG_FIRE') {
            if (this.windFarm && this.windFarm.turbines.length > 0) {
                this.currentTurbineIndex = Math.floor(Math.random() * this.windFarm.turbines.length);
                this.windFarm.setTurbineFire(this.currentTurbineIndex, true);
                
                // Active WTG Fire mission has a red radar marker (`#e74c3c`)
                this.navRadar.addOrUpdateMarker('wind_farm', centerPos, '#e74c3c', 'FIRE!');
                console.log(`🔥 Active Mission Spawned: WTG Fire on turbine index ${this.currentTurbineIndex}!`);
            }
        } else if (chosenType === 'LIFERAFT') {
            this.liferaftMission = new LiferaftMission(this.scene, this.player, this.navRadar, this.searchLightSystem);
            this.helicopterSystems.tools['WINCH'].setLiferaftMission(this.liferaftMission);
            console.log("🛟 Active Mission Spawned: Liferaft Rescue at Sea!");
        }
    }

    completeActiveMission() {
        console.log("🧪 Test Trigger: Forcibly completing current mission and spawning next...");
        if (this.currentMissionType) {
            this.lastMissionType = this.currentMissionType;
        }
        this.spawnRandomMission();
    }

    update(delta, playerPosition, nightFactor) {
        if (!this.windFarm || !this.helicopterSystems) return;

        // Universal Main Base Restocking Logic (keeps fuel/water topped up when landed at base)
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

        // Handle Active Mission Updates
        if (this.missionState === 'ACTIVE') {
            if (this.currentMissionType === 'WTG_FIRE') {
                const isOnFire = this.windFarm.isTurbineOnFire(this.currentTurbineIndex);
                if (!isOnFire) {
                    this.windFarm.setTurbineFire(this.currentTurbineIndex, false);
                    this.navRadar.removeMarker('wind_farm');
                    
                    this.lastMissionType = this.currentMissionType;
                    console.log('🎉 WTG Fire Extinguished! Spawning next random mission immediately...');
                    this.spawnRandomMission();
                } else {
                    const turbinePos = this.windFarm.getTurbineWorldPosition(this.currentTurbineIndex);
                    const dist = playerPosition.distanceTo(turbinePos);
                    const isSprayingWater = this.helicopterSystems.isWaterActive();

                    if (dist < 35.0 && isSprayingWater) {
                        this.extinguishProgress += delta;
                        if (this.extinguishProgress >= 2.0) {
                            this.windFarm.setTurbineFire(this.currentTurbineIndex, false);
                        }
                    } else {
                        this.extinguishProgress = Math.max(0, this.extinguishProgress - delta * 1.5);
                    }
                }
            } else if (this.currentMissionType === 'LIFERAFT' && this.liferaftMission) {
                this.liferaftMission.update(delta, this.camera.quaternion, nightFactor, this.searchLightSystem);

                // Instantly spawn next random mission as soon as the liferaft/survivor sequence finishes fading out at main base
                if (this.liferaftMission.isFullyCompleted) {
                    this.lastMissionType = this.currentMissionType;
                    console.log('🎉 Liferaft Mission Fully Completed! Spawning next random mission immediately...');
                    this.spawnRandomMission();
                }
            }
        }
    }
}