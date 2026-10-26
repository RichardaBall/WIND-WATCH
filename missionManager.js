import * as THREE from 'three';
import { LiferaftMission } from './liferaftMission.js';

export class MissionManager {
    constructor(scene, navRadar, windFarm, helicopterSystems, player, camera, searchLightSystem, socket = null) {
        this.scene = scene;
        this.navRadar = navRadar;
        this.windFarm = windFarm;
        this.helicopterSystems = helicopterSystems;
        this.player = player;
        this.camera = camera;
        this.searchLightSystem = searchLightSystem;
        this.socket = socket;

        this.missionState = 'READY'; // READY, ACTIVE, COMPLETED
        this.currentMissionKey = null;
        this.currentMissionInstance = null;
        this.lastMissionKey = null;

        // Registry mapping mission keys to factory functions that instantiate mission objects
        this.availableMissions = {
            'LIFERAFT': (missionData) => {
                const pos = missionData && missionData.x !== undefined ? new THREE.Vector3(missionData.x, 0.05, missionData.z) : null;
                const mission = new LiferaftMission(this.scene, this.player, this.navRadar, this.searchLightSystem, pos);
                if (this.helicopterSystems && this.helicopterSystems.tools['WINCH']) {
                    this.helicopterSystems.tools['WINCH'].setLiferaftMission(mission);
                }
                return mission;
            },
            'WTG_FIRE': (missionData) => this.createWtgFireMission(missionData)
        };

        this.registerPermanentLandmarks();
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

    createWtgFireMission(missionData) {
        if (!this.windFarm || this.windFarm.turbines.length === 0) return null;

        const turbineIndex = missionData && missionData.turbineIndex !== undefined ? missionData.turbineIndex : Math.floor(Math.random() * this.windFarm.turbines.length);
        this.windFarm.setTurbineFire(turbineIndex, true);
        
        const turbineWorldPos = this.windFarm.getTurbineWorldPosition(turbineIndex);
        this.navRadar.addOrUpdateMarker('wind_farm', turbineWorldPos, '#e74c3c', 'FIRE!');
        console.log(`🔥 Active Server Mission Spawned: WTG Fire on turbine index ${turbineIndex}!`);

        let extinguishProgress = 0;

        return {
            update: (delta, playerPosition) => {
                const isOnFire = this.windFarm.isTurbineOnFire(turbineIndex);
                if (!isOnFire) {
                    return true;
                }

                const turbinePos = this.windFarm.getTurbineWorldPosition(turbineIndex);
                const dist = playerPosition.distanceTo(turbinePos);
                const isSprayingWater = this.helicopterSystems.isWaterActive();

                if (dist < 35.0 && isSprayingWater) {
                    extinguishProgress += delta;
                    if (extinguishProgress >= 2.0) {
                        this.windFarm.setTurbineFire(turbineIndex, false);
                        return true;
                    }
                } else {
                    extinguishProgress = Math.max(0, extinguishProgress - delta * 1.5);
                }
                return false;
            },
            cleanup: () => {
                this.windFarm.setTurbineFire(turbineIndex, false);
                this.navRadar.removeMarker('wind_farm');
            }
        };
    }

    clearAllMissions() {
        if (this.currentMissionInstance && typeof this.currentMissionInstance.cleanup === 'function') {
            this.currentMissionInstance.cleanup();
        }

        if (this.windFarm && this.windFarm.turbines) {
            for (let i = 0; i < this.windFarm.turbines.length; i++) {
                this.windFarm.setTurbineFire(i, false);
            }
        }
        this.navRadar.removeMarker('wind_farm');
        this.navRadar.removeMarker('liferaft');

        if (this.helicopterSystems && this.helicopterSystems.tools['WINCH']) {
            this.helicopterSystems.tools['WINCH'].setLiferaftMission(null);
        }

        this.currentMissionInstance = null;
        this.currentMissionKey = null;
    }

    spawnSpecificMission(type, missionData) {
        this.clearAllMissions();
        this.currentMissionKey = type;
        this.missionState = 'ACTIVE';

        if (this.availableMissions[type]) {
            this.currentMissionInstance = this.availableMissions[type](missionData);
        }
        console.log(`🚀 Synced Server-Authoritative Mission Spawned: [${type}]`);
    }

    completeActiveMission() {
        console.log("🧪 Test Trigger: Forcibly completing current mission...");
        if (this.socket) {
            this.socket.emit('complete-mission');
        } else {
            this.clearAllMissions();
        }
    }

    get liferaftMission() {
        return this.currentMissionKey === 'LIFERAFT' ? this.currentMissionInstance : null;
    }

    update(delta, playerPosition, nightFactor) {
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

        // Handle Active Mission Updates dynamically
        if (this.missionState === 'ACTIVE' && this.currentMissionInstance) {
            let isComplete = false;

            if (this.currentMissionKey === 'LIFERAFT') {
                isComplete = this.currentMissionInstance.update(delta, this.camera.quaternion, nightFactor, this.searchLightSystem);
            } else {
                isComplete = this.currentMissionInstance.update(delta, playerPosition, nightFactor);
            }

            if (isComplete && this.missionState === 'ACTIVE') {
                this.missionState = 'COMPLETED';
                this.lastMissionKey = this.currentMissionKey;
                console.log(`🎉 Mission [${this.currentMissionKey}] Completed locally. Sending validation request to server...`);
                if (this.socket) {
                    this.socket.emit('complete-mission');
                } else {
                    this.clearAllMissions();
                }
            }
        }
    }
}