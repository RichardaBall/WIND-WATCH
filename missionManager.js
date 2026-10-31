// missionManager.js
import * as THREE from 'three';

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

        this.availableMissions = {
            'WTG_FIRE': (missionData) => this.createWtgFireMission(missionData)
        };

        this.registerPermanentLandmarks();

        // Guaranteed immediate fire mission on game startup
        this.spawnSpecificMission('WTG_FIRE', {
            missionId: `local-startup-${Date.now()}`,
            type: 'WTG_FIRE',
            turbineIndex: 0,
            requiredWaterFraction: 0.5,
            missionStage: 'ACTIVE',
            progress: 0
        });
    }

    registerPermanentLandmarks() {
        if (this.navRadar) {
            this.navRadar.addOrUpdateMarker('main_base', new THREE.Vector3(0, 0, 0), '#3498db', 'BASE');
        }
    }

    getWindFarmCenter() {
        if (!this.windFarm || !this.windFarm.turbines || this.windFarm.turbines.length === 0) return new THREE.Vector3(380, 20, -320);
        const center = new THREE.Vector3();
        this.windFarm.turbines.forEach(turbine => {
            if (turbine && turbine.group) {
                const pos = new THREE.Vector3();
                turbine.group.getWorldPosition(pos);
                center.add(pos);
            }
        });
        center.divideScalar(this.windFarm.turbines.length);
        center.y += 20; 
        return center;
    }

    createWtgFireMission(missionData) {
        if (!this.windFarm || !this.windFarm.turbines || this.windFarm.turbines.length === 0) return null;

        const turbineIndex = missionData && missionData.turbineIndex !== undefined ? missionData.turbineIndex : 0;
        const alreadyExtinguished = !!(missionData && (missionData.isExtinguished || missionData.isCompleted));
        const requiredWaterFraction = missionData && missionData.requiredWaterFraction !== undefined ? missionData.requiredWaterFraction : 1.0;
        
        const maxExtinguishTime = Math.max(0.5, requiredWaterFraction * 1.0);
        
        if (this.windFarm && typeof this.windFarm.setTurbineFire === 'function') {
            this.windFarm.setTurbineFire(turbineIndex, !alreadyExtinguished);
        }
        
        const turbineWorldPos = this.windFarm && typeof this.windFarm.getTurbineWorldPosition === 'function' ? this.windFarm.getTurbineWorldPosition(turbineIndex) : new THREE.Vector3();
        if (!alreadyExtinguished && this.navRadar) {
            this.navRadar.addOrUpdateMarker('wind_farm', turbineWorldPos, '#e74c3c', 'FIRE!');
        }

        let extinguishProgress = Math.max(0, Math.min(maxExtinguishTime, Number(missionData && missionData.progress) * maxExtinguishTime || 0));
        let serverProgress = missionData && missionData.progress !== undefined ? missionData.progress : 0;
        let progressSyncTimer = 0;
        const missionId = missionData && missionData.missionId;
        let finishedByServer = false;

        return {
            missionId,
            missionComplete() {
                finishedByServer = true;
            },
            turbineIndex,
            set serverProgress(val) {
                serverProgress = val;
                extinguishProgress = val * maxExtinguishTime;
            },
            get serverProgress() {
                return serverProgress;
            },
            update: (delta, playerPosition) => {
                if (finishedByServer || !this.windFarm || !this.helicopterSystems) return false;
                const isOnFire = typeof this.windFarm.isTurbineOnFire === 'function' ? this.windFarm.isTurbineOnFire(turbineIndex) : false;
                if (!isOnFire || (missionData && missionData.isExtinguished)) {
                    return true;
                }

                const turbinePos = typeof this.windFarm.getTurbineWorldPosition === 'function' ? this.windFarm.getTurbineWorldPosition(turbineIndex) : new THREE.Vector3();
                const dist = playerPosition ? playerPosition.distanceTo(turbinePos) : 999;
                const isSprayingWater = typeof this.helicopterSystems.isWaterActive === 'function' ? this.helicopterSystems.isWaterActive() : false;

                if (dist < 75.0 && isSprayingWater) {
                    extinguishProgress += delta;

                    if (extinguishProgress >= maxExtinguishTime) {
                        if (typeof this.windFarm.setTurbineFire === 'function') {
                            this.windFarm.setTurbineFire(turbineIndex, false);
                        }
                        if (this.navRadar) {
                            this.navRadar.removeMarker('wind_farm');
                        }
                        if (this.socket && this.socket.connected) {
                            this.socket.emit('wtg-fire-extinguished', { missionId });
                        }
                        return true;
                    }
                } else {
                    extinguishProgress = THREE.MathUtils.lerp(extinguishProgress, serverProgress * maxExtinguishTime, delta * 5.0);
                }
                progressSyncTimer += delta;
                if (this.socket && this.socket.connected && progressSyncTimer >= 0.2) {
                    progressSyncTimer = 0;
                    this.socket.emit('wtg-fire-progress', { missionId, progress: Math.min(0.99, extinguishProgress / maxExtinguishTime) });
                }
                return false;
            },
            cleanup: () => {
                if (this.windFarm && typeof this.windFarm.setTurbineFire === 'function') {
                    this.windFarm.setTurbineFire(turbineIndex, false);
                }
                if (this.navRadar) {
                    this.navRadar.removeMarker('wind_farm');
                }
            }
        };
    }

    clearAllMissions() {
        if (this.currentMissionInstance && typeof this.currentMissionInstance.cleanup === 'function') {
            this.currentMissionInstance.cleanup();
        }

        if (this.windFarm && this.windFarm.turbines) {
            for (let i = 0; i < this.windFarm.turbines.length; i++) {
                if (typeof this.windFarm.setTurbineFire === 'function') {
                    this.windFarm.setTurbineFire(i, false);
                }
            }
        }
        if (this.navRadar) {
            this.navRadar.removeMarker('wind_farm');
        }

        this.currentMissionInstance = null;
        this.currentMissionKey = null;
        this.missionState = 'READY';
    }

    spawnSpecificMission(type, missionData) {
        if (!missionData) return;
        
        const missionType = 'WTG_FIRE';

        this.clearAllMissions();
        this.currentMissionKey = missionType;
        this.missionState = missionData.missionStage === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE';

        if (this.availableMissions[missionType]) {
            this.currentMissionInstance = this.availableMissions[missionType](missionData);
            if (this.currentMissionInstance && missionData) {
                this.currentMissionInstance.missionId = missionData.missionId;
                this.currentMissionInstance.serverStage = missionData.missionStage || 'ACTIVE';
                this.currentMissionInstance.serverProgress = missionData.progress || 0;
                this.currentMissionInstance.serverIsCompleted = missionData.isCompleted || false;
                this.currentMissionInstance.serverExtinguishedBy = missionData.extinguishedBy || null;
            }
        }
    }

    applyMissionState(state) {
        if (!state) return;

        if (state.missionId && this.currentMissionInstance && this.currentMissionInstance.missionId &&
            state.missionId !== this.currentMissionInstance.missionId) {
            this.spawnSpecificMission('WTG_FIRE', state);
            return;
        }

        if (this.currentMissionKey !== 'WTG_FIRE' || !this.currentMissionInstance) {
            this.spawnSpecificMission('WTG_FIRE', state);
            return;
        }

        if (this.currentMissionInstance) {
            this.currentMissionInstance.serverStage = state.stage;
            this.currentMissionInstance.serverProgress = state.progress || 0;
            this.currentMissionInstance.serverIsCompleted = state.isCompleted || false;
            this.currentMissionInstance.serverExtinguishedBy = state.extinguishedBy || null;

            if (state.turbineIndex !== undefined && this.windFarm && typeof this.windFarm.setTurbineFire === 'function') {
                this.windFarm.setTurbineFire(state.turbineIndex, !state.isExtinguished && !state.isCompleted);
            }

            if (state.isExtinguished || state.isCompleted) {
                if (state.turbineIndex !== undefined && this.windFarm && typeof this.windFarm.setTurbineFire === 'function') {
                    this.windFarm.setTurbineFire(state.turbineIndex, false);
                }
                if (this.navRadar) {
                    this.navRadar.removeMarker('wind_farm');
                }
                if (typeof this.currentMissionInstance.missionComplete === 'function') {
                    this.currentMissionInstance.missionComplete();
                }
            }
        }

        this.missionState = state.isCompleted || state.missionStage === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE';
    }

    update(delta, playerPosition, nightFactor) {
        if (!this.windFarm || !this.helicopterSystems || !playerPosition) return;

        const pad1 = new THREE.Vector3(8.41, 19.81, -6.54);
        const pad2 = new THREE.Vector3(-10.28, 27.29, 3.74);
        const distToPad1 = new THREE.Vector2(playerPosition.x, playerPosition.z).distanceTo(new THREE.Vector2(pad1.x, pad1.z));
        const distToPad2 = new THREE.Vector2(playerPosition.x, playerPosition.z).distanceTo(new THREE.Vector2(pad2.x, pad2.z));
        const isNearPad = (distToPad1 < 6.0 && Math.abs(playerPosition.y - pad1.y) < 4.0) || (distToPad2 < 6.0 && Math.abs(playerPosition.y - pad2.y) < 4.0);

        const player = this.helicopterSystems.playerRef;
        const isLanded = player && player.gearDown === true;
        const engineOff = player && (player.engineState === 'OFF' || player.engineState === 'SHUTTING_DOWN');

        if (isNearPad && isLanded && engineOff) {
            let duration = 3.0;
            let currentTime = 0.0;

            if (player.audioManager && typeof player.audioManager.getShutdownDuration === 'function') {
                const audioDuration = player.audioManager.getShutdownDuration();
                const audioCurrentTime = typeof player.audioManager.getShutdownCurrentTime === 'function' ? player.audioManager.getShutdownCurrentTime() : 0;
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

        if (this.missionState === 'ACTIVE' && this.currentMissionInstance && typeof this.currentMissionInstance.update === 'function') {
            let isComplete = false;
            isComplete = this.currentMissionInstance.update(delta, playerPosition, nightFactor);

            if (isComplete && this.missionState === 'ACTIVE') {
                this.missionState = 'COMPLETED';
                this.lastMissionKey = this.currentMissionKey;
                if (this.socket && this.socket.connected) {
                    this.socket.emit('complete-mission', { missionId: this.currentMissionInstance && this.currentMissionInstance.missionId });
                } else {
                    this.clearAllMissions();
                }
            }
        }
    }
}