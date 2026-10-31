// game.js
import * as THREE from 'three';
import { setupScene } from './sceneSetup.js';
import { OceanWater } from './ocean.js';
import { MainBase } from './mainbase.js';
import HelicopterPlayer from './player.js';
import { HelicopterSystems } from './helicopterSystems.js';
import { DayNightCycle } from './dayNightCycle.js';
import { setupSettings } from './settings.js';
import { WindFarm } from './windfarm.js';
import { SearchLightSystem } from './searchlight.js';
import { NavRadar } from './navRadar.js';
import { InputManager } from './inputManager.js';
import { MissionManager } from './missionManager.js';
import { CollisionManager } from './collisionManager.js';
import { HudManager } from './hudManager.js';
import { WeatherSystem } from './weatherSystem.js';
import { CloudSystem } from './cloudSystem.js';
import { WaterSystem } from './waterSystem.js';
import { WinchSystem } from './winchSystem.js';
import { NetworkManager } from './networkManager.js';
import { FpsCounter } from './fpsCounter.js';

export class Game {
    constructor() {
        this.remotePlayers = {};
        this.lastSentPos = new THREE.Vector3();
        this.lastSentRotorSpeed = -1;
        this.lastSentGearDown = null;
        this.lastSentWinchState = null;
        this.lastSentWaterActive = null;
        this.lastSentLightState = null;
        this.clock = new THREE.Clock();
        this.networkTimer = 0;
        this.logicThrottleTimer = 0;

        this._scratchVector1 = new THREE.Vector3();
        this._scratchVector2 = new THREE.Vector3();
        this._scratchVector3 = new THREE.Vector3();
    }

    init() {
        const { scene, camera, renderer, sunLight, ambientLight } = setupScene();
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.sunLight = sunLight;
        this.ambientLight = ambientLight;

        this.ocean = new OceanWater(scene, sunLight);
        this.mainBase = new MainBase(scene, camera, renderer);
        this.windFarm = new WindFarm(scene, camera);
        this.dayNightCycle = new DayNightCycle(scene, sunLight, ambientLight, this.ocean);
        this.cloudSystem = new CloudSystem(scene);

        this.player = new HelicopterPlayer(scene);

        const defaultSpawnPos = new THREE.Vector3(8.41, 19.81, -6.54);

        this.player.group.position.copy(defaultSpawnPos);
        this.player.targetPosition.copy(defaultSpawnPos);
        this.player.targetAltitude = defaultSpawnPos.y;

        this.weatherSystem = new WeatherSystem(scene, camera, this.ocean, this.player.audioManager);

        this.helicopterSystems = new HelicopterSystems(scene, this.player.group, this.player);
        this.player.helicopterSystems = this.helicopterSystems;

        this.searchLightSystem = new SearchLightSystem(scene, this.player.group);
        this.navRadar = new NavRadar(scene, this.player, camera);

        this.collisionManager = new CollisionManager(scene, this.player, this.windFarm, this.mainBase);
        this.missionManager = new MissionManager(scene, this.navRadar, this.windFarm, this.helicopterSystems, this.player, camera, this.searchLightSystem, null);
        this.hudManager = new HudManager(this.player, this.helicopterSystems, this.searchLightSystem);
        this.fpsCounter = new FpsCounter(renderer);

        this.settings = setupSettings(this.dayNightCycle, this.player, this.weatherSystem, this.missionManager, this.helicopterSystems, this.cloudSystem);
        this.inputManager = new InputManager(camera, this.player, this.helicopterSystems, this.searchLightSystem, this.dayNightCycle);

        this.networkManager = new NetworkManager();
        if (this.helicopterSystems.tools['WINCH']) {
            this.helicopterSystems.tools['WINCH'].socket = this.networkManager.socket;
        }
        this.missionManager.socket = this.networkManager.socket;

        this.initNetworkCallbacks();
        this.initEventListeners();

        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    spawnRemotePlayer(id, data) {
        if (!data) return;
        
        // Create a temporary placeholder entry immediately to prevent duplicate requests
        this.remotePlayers[id] = { isInitializing: true };

        // Defer heavy geometry/material instantiation to the next animation frame to prevent frame-rate hangups
        requestAnimationFrame(() => {
            if (!this.networkManager || !this.remotePlayers[id]?.isInitializing) return;

            const remoteHeli = new HelicopterPlayer(this.scene, { isRemote: true, audioManager: this.player.audioManager });
            const remotePlayerRef = { gearDown: data.gearDown ?? true };
            const remoteWaterSystem = new WaterSystem(this.scene, remoteHeli.group, remotePlayerRef);
            const remoteWinchSystem = new WinchSystem(this.scene, remoteHeli.group, remotePlayerRef, this.networkManager ? this.networkManager.socket : null);

            const remoteAudio = this.player.audioManager.createRemoteRotorSource();

            // Use the helicopter's own soft round shadow (same as the local player's), not a plain square
            const shadowMesh = remoteHeli.shadowMesh;
            shadowMesh.position.set(data.x || 0, 0.2, data.z || 0);

            const searchLight = new THREE.SpotLight(0xffffee, 0.0, 250, Math.PI / 6, 0.3, 1.0);
            searchLight.position.set(0, -0.5, 0);
            remoteHeli.group.add(searchLight);

            const searchLightTarget = new THREE.Object3D();
            this.scene.add(searchLightTarget);
            searchLight.target = searchLightTarget;

            // Lowered segment count from 32 to 16 for better rendering performance
            const discGeo = new THREE.CircleGeometry(6.0, 16);
            discGeo.rotateX(-Math.PI / 2);
            
            const discMat = new THREE.MeshBasicMaterial({
                color: 0xe6f0ff,
                transparent: true,
                blending: THREE.NormalBlending,
                depthWrite: false,
                opacity: 0.0
            });
            const lightPoolMesh = new THREE.Mesh(discGeo, discMat);
            lightPoolMesh.position.set(0, 0.05, 0);
            this.scene.add(lightPoolMesh);

            this.remotePlayers[id] = {
                group: remoteHeli.group,
                helicopter: remoteHeli,
                waterSystem: remoteWaterSystem,
                winchSystem: remoteWinchSystem,
                playerRef: remotePlayerRef,
                remoteAudio: remoteAudio,
                searchLight: searchLight,
                searchLightTarget: searchLightTarget,
                lightPoolMesh: lightPoolMesh,
                shadowMesh: shadowMesh,
                targetPos: new THREE.Vector3(data.x || 0, data.y || 0, data.z || 0),
                targetQuaternion: new THREE.Quaternion(data.qx || 0, data.qy || 0, data.qz || 0, data.qw || 1),
                targetFrame: data.currentFrame || 5,
                rotorSpeed: data.rotorSpeed !== undefined ? data.rotorSpeed : 0,
                gearDown: data.gearDown ?? true,
                winchState: data.winchState || 'STOWED',
                isDroppingWater: data.isDroppingWater || false,
                searchLightState: data.searchLightState || 'OFF',
                targetSearchLightPos: new THREE.Vector3()
            };

            this.navRadar.addOrUpdateMarker(`remote_${id}`, remoteHeli, '#22c55e', 'PLAYER');
        });
    }

    initNetworkCallbacks() {
        if (!this.networkManager || !this.networkManager.socket) return;
        const socket = this.networkManager.socket;

        this.networkManager.on('current-players', (players) => {
            if (!players || typeof players !== 'object') return;
            const socketId = socket && socket.connected ? socket.id : null;
            for (const id in players) {
                if (id !== socketId) {
                    this.spawnRemotePlayer(id, players[id]);
                }
            }

            const helipads = [
                new THREE.Vector3(8.41, 19.81, -6.54),
                new THREE.Vector3(-10.28, 27.29, 3.74)
            ];

            let chosenPad = helipads[0];
            for (const pad of helipads) {
                let occupied = false;
                for (const id in players) {
                    if (id !== socketId && players[id]) {
                        const pPos = new THREE.Vector3(players[id].x || 0, players[id].y || 0, players[id].z || 0);
                        if (pPos.distanceTo(pad) < 3.0) {
                            occupied = true;
                            break;
                        }
                    }
                }
                if (!occupied) {
                    chosenPad = pad;
                    break;
                }
            }

            if (this.player && this.player.group) {
                this.player.group.position.copy(chosenPad);
                this.player.targetPosition.copy(chosenPad);
                this.player.targetAltitude = chosenPad.y;
            }
        });

        this.networkManager.on('player-joined', (playerData) => {
            if (playerData && playerData.id) {
                this.spawnRemotePlayer(playerData.id, playerData);
            }
        });

        this.networkManager.on('remote-player-update', (data) => {
            if (data && data.id && this.remotePlayers[data.id] && !this.remotePlayers[data.id].isInitializing) {
                const rp = this.remotePlayers[data.id];
                if (data.x !== undefined && data.y !== undefined && data.z !== undefined) {
                    rp.targetPos.set(data.x, data.y, data.z);
                }
                if (data.qx !== undefined && data.qy !== undefined && data.qz !== undefined && data.qw !== undefined) {
                    rp.targetQuaternion.set(data.qx, data.qy, data.qz, data.qw);
                }
                if (data.currentFrame !== undefined) rp.targetFrame = data.currentFrame;
                rp.rotorSpeed = data.rotorSpeed !== undefined ? data.rotorSpeed : 0;
                rp.gearDown = data.gearDown ?? rp.gearDown;
                if (rp.playerRef) {
                    rp.playerRef.gearDown = rp.gearDown;
                }
                rp.winchState = data.winchState || 'STOWED';
                rp.isDroppingWater = !!data.isDroppingWater;
                rp.searchLightState = data.searchLightState || 'OFF';

                if (data.slX !== undefined && data.slY !== undefined && data.slZ !== undefined) {
                    rp.targetSearchLightPos.set(data.slX, data.slY, data.slZ);
                }

                if (rp.helicopter && rp.helicopter.material) {
                    if (rp.helicopter.gearDown !== rp.gearDown) {
                        rp.helicopter.gearDown = rp.gearDown;
                        const currentOffset = rp.helicopter.material.map ? rp.helicopter.material.map.offset.x : 0;
                        if (rp.gearDown && rp.helicopter.gearDownTex) {
                            rp.helicopter.material.map = rp.helicopter.gearDownTex;
                        } else if (!rp.gearDown && rp.helicopter.gearUpTex) {
                            rp.helicopter.material.map = rp.helicopter.gearUpTex;
                        }
                        if (rp.helicopter.material.map) {
                            rp.helicopter.material.map.offset.x = currentOffset;
                        }
                        rp.helicopter.material.needsUpdate = true;
                    }
                }

                if (rp.waterSystem) {
                    rp.waterSystem.isActive = !!data.isDroppingWater;
                }
            }
        });

        this.networkManager.on('player-disconnected', (id) => {
            if (id && this.remotePlayers[id]) {
                const rp = this.remotePlayers[id];
                if (!rp.isInitializing) {
                    if (rp.remoteAudio && this.player && this.player.audioManager) {
                        this.player.audioManager.stopRemoteRotor(rp.remoteAudio);
                    }

                    // Remove and free everything spawnRemotePlayer created, so players joining and leaving do not pile up GPU memory
                    const heli = rp.helicopter;
                    this.disposeObject(rp.group);
                    this.disposeObject(rp.shadowMesh);
                    if (rp.winchSystem) {
                        this.disposeObject(rp.winchSystem.cableLine);
                        this.disposeObject(rp.winchSystem.hookMesh);
                        this.disposeObject(rp.winchSystem.rotorWashSystem);
                    }
                    if (rp.waterSystem) {
                        this.disposeObject(rp.waterSystem.particleSystem);
                        this.disposeObject(rp.waterSystem.splashSystem);
                    }
                    this.disposeObject(rp.searchLightTarget);
                    this.disposeObject(rp.lightPoolMesh);
                    if (heli) {
                        // Added to the scene directly by HelicopterPlayer, not to its group
                        this.disposeObject(heli.shadowMesh);
                        this.disposeObject(heli.dropLine);
                        this.disposeObject(heli.searchLightTarget);
                        // Only one of the gear textures is on the material at a time
                        for (const tex of [heli.gearUpTex, heli.gearDownTex, heli.emissiveTex]) {
                            if (tex) tex.dispose();
                        }
                    }

                    if (this.navRadar) {
                        this.navRadar.removeMarker(`remote_${id}`);
                    }
                }
                delete this.remotePlayers[id];
            }
        });

        this.networkManager.on('sync-mission', (missionData) => {
            if (this.mainBase && typeof this.mainBase.resetFade === 'function') this.mainBase.resetFade();
            if (this.missionManager && missionData) this.missionManager.spawnSpecificMission(missionData.type, missionData);
        });

        this.networkManager.on('mission-state-updated', (missionState) => {
            if (this.missionManager && missionState) this.missionManager.applyMissionState(missionState);
        });

        this.networkManager.on('mission-completed', () => {
            if (this.mainBase && typeof this.mainBase.resetFade === 'function') this.mainBase.resetFade();
            if (this.missionManager) this.missionManager.clearAllMissions();
        });
    }

    disposeObject(object) {
        if (!object) return;
        if (object.parent) object.parent.remove(object);
        object.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            const materials = Array.isArray(child.material) ? child.material : (child.material ? [child.material] : []);
            for (const mat of materials) {
                for (const key in mat) {
                    if (mat[key] && mat[key].isTexture) mat[key].dispose();
                }
                mat.dispose();
            }
        });
    }

    initEventListeners() {
        window.addEventListener('toggle-settings', (e) => {
            const isOpen = e.detail && e.detail.active;
            if (this.settings && typeof this.settings.setVisible === 'function') {
                this.settings.setVisible(isOpen);
            }
        });
    }

    animate() {
        requestAnimationFrame(this.animate);
        const delta = Math.min(this.clock.getDelta(), 0.1);

        if (this.inputManager && this.inputManager.isDragging()) {
            this.inputManager.updateTarget();
        }

        const nightFactor = this.dayNightCycle ? this.dayNightCycle.update(delta) : 0;
        if (this.weatherSystem) this.weatherSystem.update(delta);
        
        const windForce = this.weatherSystem ? this.weatherSystem.getWindForce() : this._scratchVector1.set(0, 0, 0);
        const activeWeather = this.weatherSystem ? this.weatherSystem.targetWeather : 'CLEAR';
        if (this.cloudSystem && this.camera) {
            this.cloudSystem.update(delta, nightFactor, this.camera.quaternion, windForce, activeWeather);
        }

        if (this.player) {
            this.player.update(delta, nightFactor, windForce);
        }
        
        this.networkTimer += delta;
        if (this.networkTimer >= 0.05 && this.networkManager && this.networkManager.isConnected() && this.player) {
            this.networkTimer = 0;
            const pos = this.player.getPosition();
            const currentRotorSpeed = this.player.rotorSpeed;
            const currentGearDown = this.player.gearDown;
            const currentWinchState = this.player.winchState;
            const currentWaterActive = this.helicopterSystems ? this.helicopterSystems.isWaterActive() : false;
            const currentLightState = this.searchLightSystem ? this.searchLightSystem.state : 'OFF';

            const hasMoved = pos.distanceToSquared(this.lastSentPos) > 0.001 || this.player.isMoving;
            const stateChanged = 
                Math.abs(currentRotorSpeed - this.lastSentRotorSpeed) > 0.1 ||
                currentGearDown !== this.lastSentGearDown ||
                currentWinchState !== this.lastSentWinchState ||
                currentWaterActive !== this.lastSentWaterActive ||
                currentLightState !== this.lastSentLightState;

            if (hasMoved || stateChanged) {
                this.lastSentPos.copy(pos);
                this.lastSentRotorSpeed = currentRotorSpeed;
                this.lastSentGearDown = currentGearDown;
                this.lastSentWinchState = currentWinchState;
                this.lastSentWaterActive = currentWaterActive;
                this.lastSentLightState = currentLightState;

                this.networkManager.emit('player-update', {
                    x: pos.x,
                    y: pos.y,
                    z: pos.z,
                    currentFrame: this.player.currentFrame,
                    rotorSpeed: currentRotorSpeed,
                    gearDown: currentGearDown,
                    qx: this.player.mesh.quaternion.x,
                    qy: this.player.mesh.quaternion.y,
                    qz: this.player.mesh.quaternion.z,
                    qw: this.player.mesh.quaternion.w,
                    winchState: currentWinchState,
                    isDroppingWater: currentWaterActive,
                    searchLightState: currentLightState,
                    slX: this.searchLightSystem && this.searchLightSystem.lightTarget ? this.searchLightSystem.lightTarget.position.x : 0,
                    slY: this.searchLightSystem && this.searchLightSystem.lightTarget ? this.searchLightSystem.lightTarget.position.y : 0,
                    slZ: this.searchLightSystem && this.searchLightSystem.lightTarget ? this.searchLightSystem.lightTarget.position.z : 0
                });
            }
        }

        for (const id in this.remotePlayers) {
            const rp = this.remotePlayers[id];
            if (!rp || rp.isInitializing || !rp.group || !rp.targetPos) continue;

            rp.group.position.lerp(rp.targetPos, delta * 10.0);
            if (rp.helicopter && rp.helicopter.mesh && rp.targetQuaternion) {
                rp.helicopter.mesh.quaternion.slerp(rp.targetQuaternion, delta * 10.0);
            }
            
            if (rp.remoteAudio && this.player && this.player.audioManager && this.player.audioManager.audioCtx) {
                const pos = rp.group.position;
                this.player.audioManager.updateRemoteRotorPosition(rp.remoteAudio, pos.x, pos.y, pos.z);
                
                const targetGain = rp.rotorSpeed > 5 ? 1.5 : 0.0;
                if (rp.remoteAudio.gainNode && rp.remoteAudio.gainNode.gain) {
                    rp.remoteAudio.gainNode.gain.setTargetAtTime(targetGain, this.player.audioManager.audioCtx.currentTime, 0.1);
                }
            }

            if (rp.shadowMesh) {
                rp.shadowMesh.position.set(rp.group.position.x, 0.2, rp.group.position.z);
                const heightFactor = Math.max(0.4, 1.0 - (rp.group.position.y / 60.0));
                rp.shadowMesh.scale.set(heightFactor, heightFactor, heightFactor);
            }

            if (rp.group.position.distanceToSquared(rp.targetPos) > 0.01) {
                rp.group.updateMatrixWorld(true);
            }

            if (rp.rotorSpeed > 0 && rp.helicopter && rp.helicopter.rotorBlades) {
                for (const blade of rp.helicopter.rotorBlades) {
                    if (blade) blade.rotation.z += Math.min(rp.rotorSpeed * delta, rp.helicopter.maxRotorStep);
                }
            }

            if (rp.helicopter && rp.helicopter.material && rp.helicopter.material.map && rp.helicopter.totalFrames) {
                const frameOffset = rp.targetFrame * (1 / rp.helicopter.totalFrames);
                rp.helicopter.material.map.offset.x = frameOffset;
                if (rp.helicopter.material.emissiveMap) {
                    rp.helicopter.material.emissiveMap.offset.x = frameOffset;
                }
            }

            if (rp.waterSystem) rp.waterSystem.update(delta);
            if (rp.winchSystem && rp.helicopter && rp.helicopter.mesh) {
                if (rp.winchState === 'DEPLOYED' || rp.winchState === 'LOWERING') {
                    rp.winchSystem.currentExtension = THREE.MathUtils.lerp(rp.winchSystem.currentExtension, 1.0, delta * 2.0);
                } else {
                    rp.winchSystem.currentExtension = THREE.MathUtils.lerp(rp.winchSystem.currentExtension, 0.0, delta * 2.0);
                }
                rp.winchSystem.update(delta, rp.helicopter.mesh.quaternion);
            }

            if (rp.searchLight && rp.lightPoolMesh) {
                if (rp.searchLightState !== 'OFF') {
                    rp.searchLight.intensity = nightFactor * 90.0;
                    rp.lightPoolMesh.material.opacity = nightFactor * 0.9;
                    
                    if (rp.searchLightTarget && rp.targetSearchLightPos) {
                        rp.searchLightTarget.position.lerp(rp.targetSearchLightPos, Math.min(1, delta * 15.0));
                        rp.lightPoolMesh.position.set(
                            rp.searchLightTarget.position.x, 
                            0.05, 
                            rp.searchLightTarget.position.z
                        );
                    }
                } else {
                    rp.searchLight.intensity = 0.0;
                    rp.lightPoolMesh.material.opacity = 0.0;
                }
            }
        }

        if (this.helicopterSystems) this.helicopterSystems.update(delta);
        if (this.collisionManager) this.collisionManager.update();
        if (this.missionManager && this.player) {
            this.missionManager.update(delta, this.player.getPosition(), nightFactor);
        }
        if (this.hudManager && this.helicopterSystems && this.searchLightSystem) {
            this.hudManager.update(this.helicopterSystems, this.searchLightSystem);
        }

        const mouseWorldPos = this.inputManager && typeof this.inputManager.getMouseWorldPosition === 'function' ? this.inputManager.getMouseWorldPosition() : this._scratchVector2.set(0, 0, 0);
        if (this.searchLightSystem) {
            this.searchLightSystem.update(delta, nightFactor, mouseWorldPos);
        }
        
        this.logicThrottleTimer += delta;
        if (this.logicThrottleTimer >= 0.05) {
            this.logicThrottleTimer = 0;
        }
        if (this.navRadar) this.navRadar.update();

        const playerPos = this.player ? this.player.getPosition() : this._scratchVector3.set(0, 0, 0);
        if (this.ocean) this.ocean.update(delta, playerPos);

        if (this.camera) {
            const focusPoint = this._scratchVector1.set(playerPos.x, playerPos.y * 0.5, playerPos.z);
            const cameraOffset = this._scratchVector2.set(50, 50, 50);
            this.camera.position.copy(focusPoint).add(cameraOffset);
            this.camera.lookAt(focusPoint);
        }

        if (this.mainBase && this.camera && this.searchLightSystem) {
            this.mainBase.update(delta, nightFactor, this.camera.quaternion, this.searchLightSystem, activeWeather);
        }
        if (this.windFarm && this.camera) {
            this.windFarm.update(delta, this.camera.quaternion);
        }
        
        if (this.player && this.player.mesh && this.camera) {
            this.player.mesh.quaternion.copy(this.camera.quaternion);
        }
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
        if (this.fpsCounter) this.fpsCounter.update();
    }
}