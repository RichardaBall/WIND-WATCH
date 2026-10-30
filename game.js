// game.js
import * as THREE from 'three';
import { setupScene } from './sceneSetup.js';
import { OceanWater } from './ocean.js';
import { MainBase } from './mainbase.js';
import { HelicopterPlayer } from './player.js';
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

        // --- Default Spawn Position on Helipad 1 ---
        const defaultSpawnPos = new THREE.Vector3(8.41, 19.81, -6.54);

        this.player.group.position.copy(defaultSpawnPos);
        this.player.targetPosition.copy(defaultSpawnPos);
        this.player.targetAltitude = defaultSpawnPos.y;

        this.weatherSystem = new WeatherSystem(scene, camera, this.ocean, this.player.audioManager);

        this.helicopterSystems = new HelicopterSystems(scene, this.player.group, this.player);
        this.player.helicopterSystems = this.helicopterSystems;

        this.searchLightSystem = new SearchLightSystem(scene, this.player.group);
        this.navRadar = new NavRadar(scene, this.player, camera);

        this.collisionManager = new CollisionManager(scene, this.player, this.windFarm);
        this.missionManager = new MissionManager(scene, this.navRadar, this.windFarm, this.helicopterSystems, this.player, camera, this.searchLightSystem, null);
        this.hudManager = new HudManager(this.player, this.helicopterSystems, this.searchLightSystem);

        this.settings = setupSettings(this.dayNightCycle, this.player, this.weatherSystem, this.missionManager, this.helicopterSystems, this.cloudSystem);
        this.inputManager = new InputManager(camera, this.player, this.helicopterSystems, this.searchLightSystem, this.dayNightCycle);

        this.networkManager = new NetworkManager();
        this.helicopterSystems.tools['WINCH'].socket = this.networkManager.socket;
        this.missionManager.socket = this.networkManager.socket;

        this.initNetworkCallbacks();
        this.initEventListeners();

        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    spawnRemotePlayer(id, data) {
        const remoteHeli = new HelicopterPlayer(this.scene);
        const remotePlayerRef = { gearDown: data.gearDown ?? true };
        const remoteWaterSystem = new WaterSystem(this.scene, remoteHeli.group, remotePlayerRef);
        const remoteWinchSystem = new WinchSystem(this.scene, remoteHeli.group, remotePlayerRef);

        const remoteAudio = this.player.audioManager.createRemoteRotorSource();

        const shadowCanvas = document.createElement('canvas');
        shadowCanvas.width = 64;
        shadowCanvas.height = 64;
        const sCtx = shadowCanvas.getContext('2d');
        const sGrad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
        sGrad.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
        sGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.15)');
        sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        sCtx.fillStyle = sGrad;
        sCtx.fillRect(0, 0, 64, 64);

        const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
        const shadowGeo = new THREE.PlaneGeometry(10, 10);
        const shadowMat = new THREE.MeshBasicMaterial({
            map: shadowTexture,
            transparent: true,
            depthWrite: false,
            depthTest: false
        });
        const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.set(data.x, 0.2, data.z);
        this.scene.add(shadowMesh);

        const searchLight = new THREE.SpotLight(0xffffee, 0.0, 250, Math.PI / 6, 0.3, 1.0);
        searchLight.position.set(0, -0.5, 0);
        remoteHeli.group.add(searchLight);

        const searchLightTarget = new THREE.Object3D();
        this.scene.add(searchLightTarget);
        searchLight.target = searchLightTarget;

        const discGeo = new THREE.CircleGeometry(6.0, 32);
        discGeo.rotateX(-Math.PI / 2);
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        gradient.addColorStop(0.6, 'rgba(230, 240, 255, 0.7)');
        gradient.addColorStop(1, 'rgba(200, 220, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);

        const texture = new THREE.CanvasTexture(canvas);
        const discMat = new THREE.MeshBasicMaterial({
            map: texture,
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
            targetPos: new THREE.Vector3(data.x, data.y, data.z),
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
    }

    initNetworkCallbacks() {
        this.networkManager.on('current-players', (players) => {
            for (const id in players) {
                if (id !== this.networkManager.getSocketId()) {
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
                    if (id !== this.networkManager.getSocketId()) {
                        const pPos = new THREE.Vector3(players[id].x, players[id].y, players[id].z);
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

            this.player.group.position.copy(chosenPad);
            this.player.targetPosition.copy(chosenPad);
            this.player.targetAltitude = chosenPad.y;
        });

        this.networkManager.on('player-joined', (playerData) => {
            this.spawnRemotePlayer(playerData.id, playerData);
        });

        this.networkManager.on('remote-player-update', (data) => {
            if (this.remotePlayers[data.id]) {
                const rp = this.remotePlayers[data.id];
                rp.targetPos.set(data.x, data.y, data.z);
                rp.targetQuaternion.set(data.qx, data.qy, data.qz, data.qw);
                rp.targetFrame = data.currentFrame;
                rp.rotorSpeed = data.rotorSpeed !== undefined ? data.rotorSpeed : 0;
                rp.gearDown = data.gearDown;
                if (rp.playerRef) {
                    rp.playerRef.gearDown = data.gearDown;
                }
                rp.winchState = data.winchState || 'STOWED';
                rp.isDroppingWater = data.isDroppingWater;
                rp.searchLightState = data.searchLightState;

                if (data.slX !== undefined) {
                    rp.targetSearchLightPos.set(data.slX, data.slY, data.slZ);
                }

                if (rp.helicopter) {
                    if (rp.helicopter.gearDown !== data.gearDown) {
                        rp.helicopter.gearDown = data.gearDown;
                        const currentOffset = rp.helicopter.material.map ? rp.helicopter.material.map.offset.x : 0;
                        if (data.gearDown && rp.helicopter.gearDownTex) {
                            rp.helicopter.material.map = rp.helicopter.gearDownTex;
                        } else if (!data.gearDown && rp.helicopter.gearUpTex) {
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
            if (this.remotePlayers[id]) {
                if (this.remotePlayers[id].remoteAudio) {
                    this.player.audioManager.stopRemoteRotor(this.remotePlayers[id].remoteAudio);
                }

                this.scene.remove(this.remotePlayers[id].group);
                if (this.remotePlayers[id].shadowMesh) this.scene.remove(this.remotePlayers[id].shadowMesh);
                if (this.remotePlayers[id].winchSystem && this.remotePlayers[id].winchSystem.cableLine) {
                    this.scene.remove(this.remotePlayers[id].winchSystem.cableLine);
                    this.scene.remove(this.remotePlayers[id].winchSystem.hookMesh);
                    this.scene.remove(this.remotePlayers[id].winchSystem.rotorWashSystem);
                }
                if (this.remotePlayers[id].waterSystem && this.remotePlayers[id].waterSystem.particleSystem) {
                    this.scene.remove(this.remotePlayers[id].waterSystem.particleSystem);
                    this.scene.remove(this.remotePlayers[id].waterSystem.splashSystem);
                }
                if (this.remotePlayers[id].searchLight) this.scene.remove(this.remotePlayers[id].searchLight);
                if (this.remotePlayers[id].searchLightTarget) this.scene.remove(this.remotePlayers[id].searchLightTarget);
                if (this.remotePlayers[id].lightPoolMesh) this.scene.remove(this.remotePlayers[id].lightPoolMesh);
                this.navRadar.removeMarker(`remote_${id}`);
                delete this.remotePlayers[id];
            }
        });

        this.networkManager.on('sync-mission', (missionData) => {
            if (this.mainBase && typeof this.mainBase.resetFade === 'function') this.mainBase.resetFade();
            if (this.missionManager) this.missionManager.spawnSpecificMission(missionData.type, missionData);
        });

        this.networkManager.on('mission-state-updated', (missionState) => {
            if (this.missionManager) this.missionManager.applyMissionState(missionState);
        });

        this.networkManager.on('mission-completed', () => {
            if (this.mainBase && typeof this.mainBase.resetFade === 'function') this.mainBase.resetFade();
            if (this.missionManager) this.missionManager.clearAllMissions();
        });
    }

    initEventListeners() {
        window.addEventListener('toggle-settings', (e) => {
            const isOpen = e.detail.active;
            if (this.settings && typeof this.settings.setVisible === 'function') {
                this.settings.setVisible(isOpen);
            }
        });
    }

    animate() {
        requestAnimationFrame(this.animate);
        const delta = Math.min(this.clock.getDelta(), 0.1);

        if (this.inputManager.isDragging()) {
            this.inputManager.updateTarget();
        }

        const nightFactor = this.dayNightCycle.update(delta);
        this.weatherSystem.update(delta);
        
        const windForce = this.weatherSystem.getWindForce();
        const activeWeather = this.weatherSystem.targetWeather;
        this.cloudSystem.update(delta, nightFactor, this.camera.quaternion, windForce, activeWeather);

        this.player.update(delta, nightFactor, windForce);
        
        this.networkTimer += delta;
        if (this.networkTimer >= 0.05) {
            this.networkTimer = 0;
            const pos = this.player.getPosition();
            const currentRotorSpeed = this.player.rotorSpeed;
            const currentGearDown = this.player.gearDown;
            const currentWinchState = this.player.winchState;
            const currentWaterActive = this.helicopterSystems.isWaterActive();
            const currentLightState = this.searchLightSystem.state;

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
                    slX: this.searchLightSystem.lightTarget.position.x,
                    slY: this.searchLightSystem.lightTarget.position.y,
                    slZ: this.searchLightSystem.lightTarget.position.z
                });
            }
        }

        for (const id in this.remotePlayers) {
            const rp = this.remotePlayers[id];
            rp.group.position.lerp(rp.targetPos, delta * 10.0);
            rp.helicopter.mesh.quaternion.slerp(rp.targetQuaternion, delta * 10.0);
            
            if (rp.remoteAudio && this.player.audioManager.audioCtx) {
                const pos = rp.group.position;
                this.player.audioManager.updateRemoteRotorPosition(rp.remoteAudio, pos.x, pos.y, pos.z);
                
                const targetGain = rp.rotorSpeed > 5 ? 1.5 : 0.0;
                rp.remoteAudio.gainNode.gain.setTargetAtTime(targetGain, this.player.audioManager.audioCtx.currentTime, 0.1);
            }

            if (rp.shadowMesh) {
                rp.shadowMesh.position.set(rp.group.position.x, 0.2, rp.group.position.z);
                const heightFactor = Math.max(0.4, 1.0 - (rp.group.position.y / 60.0));
                rp.shadowMesh.scale.set(heightFactor, heightFactor, heightFactor);
            }

            if (rp.group.position.distanceToSquared(rp.targetPos) > 0.01) {
                rp.group.updateMatrixWorld(true);
            }

            if (rp.rotorSpeed > 0) {
                if (rp.helicopter && rp.helicopter.rotorBlades) {
                    for (const blade of rp.helicopter.rotorBlades) {
                        blade.rotation.z += rp.rotorSpeed * delta;
                    }
                }
            }

            if (rp.helicopter && rp.helicopter.material && rp.helicopter.material.map) {
                const frameOffset = rp.targetFrame * (1 / rp.helicopter.totalFrames);
                rp.helicopter.material.map.offset.x = frameOffset;
                if (rp.helicopter.material.emissiveMap) {
                    rp.helicopter.material.emissiveMap.offset.x = frameOffset;
                }
            }

            if (rp.waterSystem) rp.waterSystem.update(delta);
            if (rp.winchSystem) {
                if (rp.winchState === 'DEPLOYED' || rp.winchState === 'LOWERING') {
                    rp.winchSystem.currentExtension = THREE.MathUtils.lerp(rp.winchSystem.currentExtension, 1.0, delta * 2.0);
                } else {
                    rp.winchSystem.currentExtension = THREE.MathUtils.lerp(rp.winchSystem.currentExtension, 0.0, delta * 2.0);
                }
                rp.winchSystem.update(delta, rp.helicopter.mesh.quaternion);
            }

            if (rp.searchLight) {
                if (rp.searchLightState !== 'OFF') {
                    rp.searchLight.intensity = nightFactor * 90.0;
                    rp.lightPoolMesh.material.opacity = nightFactor * 0.9;
                    
                    rp.searchLightTarget.position.lerp(rp.targetSearchLightPos, delta * 15.0);
                    rp.lightPoolMesh.position.set(
                        rp.searchLightTarget.position.x, 
                        0.05, 
                        rp.searchLightTarget.position.z
                    );
                } else {
                    rp.searchLight.intensity = 0.0;
                    rp.lightPoolMesh.material.opacity = 0.0;
                }
            }
        }

        this.helicopterSystems.update(delta);
        this.collisionManager.update();
        this.missionManager.update(delta, this.player.getPosition(), nightFactor);
        this.hudManager.update(this.helicopterSystems, this.searchLightSystem);

        const mouseWorldPos = this.inputManager.getMouseWorldPosition();
        this.searchLightSystem.update(delta, nightFactor, mouseWorldPos);
        
        this.logicThrottleTimer += delta;
        if (this.logicThrottleTimer >= 0.05) {
            this.logicThrottleTimer = 0;
        }
        this.navRadar.update();

        const playerPos = this.player.getPosition();
        this.ocean.update(delta, playerPos);

        const focusPoint = new THREE.Vector3(playerPos.x, playerPos.y * 0.5, playerPos.z);
        const cameraOffset = new THREE.Vector3(50, 50, 50);
        this.camera.position.copy(focusPoint).add(cameraOffset);
        this.camera.lookAt(focusPoint);

        this.mainBase.update(delta, nightFactor, this.camera.quaternion, this.searchLightSystem, activeWeather);
        this.windFarm.update(delta, this.camera.quaternion);
        
        this.player.mesh.quaternion.copy(this.camera.quaternion);
        this.renderer.render(this.scene, this.camera);
    }
}