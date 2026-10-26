// main.js
import * as THREE from 'three';
import { io } from 'https://cdn.jsdelivr.net/npm/socket.io-client@4.7.2/dist/socket.io.esm.min.js';
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

const socket = io('https://wind-watch-server.onrender.com');

socket.on('connect', () => {
    console.log('Connected to internet co-op server!');
});

const { scene, camera, renderer, sunLight, ambientLight } = setupScene();

const ocean = new OceanWater(scene, sunLight);
const mainBase = new MainBase(scene, camera, renderer);
const windFarm = new WindFarm(scene, camera);
const dayNightCycle = new DayNightCycle(scene, sunLight, ambientLight, ocean);
const cloudSystem = new CloudSystem(scene);

const player = new HelicopterPlayer(scene);
const weatherSystem = new WeatherSystem(scene, camera, ocean, player.audioManager);

const helicopterSystems = new HelicopterSystems(scene, player.group, player);
const searchLightSystem = new SearchLightSystem(scene, player.group);
const navRadar = new NavRadar(scene, player, camera);

const collisionManager = new CollisionManager(scene, player, windFarm);
const missionManager = new MissionManager(scene, navRadar, windFarm, helicopterSystems, player, camera, searchLightSystem);
const hudManager = new HudManager(player, helicopterSystems, searchLightSystem);

const settings = setupSettings(dayNightCycle, player, weatherSystem, missionManager, helicopterSystems, cloudSystem);
const inputManager = new InputManager(camera, player, helicopterSystems, searchLightSystem, dayNightCycle);

const remotePlayers = {};

socket.on('current-players', (players) => {
    for (const id in players) {
        if (id !== socket.id) {
            spawnRemotePlayer(id, players[id]);
        }
    }
});

socket.on('player-joined', (playerData) => {
    spawnRemotePlayer(playerData.id, playerData);
});

socket.on('sync-world', (worldData) => {
    if (worldData.timeOfDay !== undefined && dayNightCycle) {
        dayNightCycle.timeOfDay = worldData.timeOfDay;
    }
    if (worldData.weather !== undefined && weatherSystem) {
        weatherSystem.setWeather(worldData.weather);
    }
});

socket.on('remote-player-update', (data) => {
    if (remotePlayers[data.id]) {
        const rp = remotePlayers[data.id];
        rp.targetPos.set(data.x, data.y, data.z);
        rp.targetQuaternion.set(data.qx, data.qy, data.qz, data.qw);
        rp.targetFrame = data.currentFrame;
        rp.rotorSpeed = data.rotorSpeed;
        rp.gearDown = data.gearDown;
        rp.winchState = data.winchState;
        rp.isDroppingWater = data.isDroppingWater;
        rp.searchLightState = data.searchLightState;

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
            if (data.isDroppingWater && !rp.waterSystem.isActive) {
                rp.waterSystem.start();
            } else if (!data.isDroppingWater && rp.waterSystem.isActive) {
                rp.waterSystem.stop();
            }
        }
    }
});

socket.on('player-disconnected', (id) => {
    if (remotePlayers[id]) {
        scene.remove(remotePlayers[id].group);
        if (remotePlayers[id].winchSystem && remotePlayers[id].winchSystem.cableLine) {
            scene.remove(remotePlayers[id].winchSystem.cableLine);
            scene.remove(remotePlayers[id].winchSystem.hookMesh);
            scene.remove(remotePlayers[id].winchSystem.rotorWashSystem);
        }
        if (remotePlayers[id].waterSystem && remotePlayers[id].waterSystem.particleSystem) {
            scene.remove(remotePlayers[id].waterSystem.particleSystem);
            scene.remove(remotePlayers[id].waterSystem.splashSystem);
        }
        if (remotePlayers[id].searchLight) scene.remove(remotePlayers[id].searchLight);
        delete remotePlayers[id];
    }
});

socket.on('sync-mission', (missionData) => {
    if (missionManager && missionManager.liferaftMission) {
        if (typeof missionManager.liferaftMission.setPosition === 'function') {
            missionManager.liferaftMission.setPosition(missionData.x, missionData.z);
        } else if (missionManager.liferaftMission.group) {
            missionManager.liferaftMission.group.position.set(missionData.x, 0.05, missionData.z);
        }
    }
});

socket.on('mission-completed', () => {
    if (missionManager && missionManager.liferaftMission) {
        missionManager.liferaftMission.isFullyCompleted = true;
    }
});

function spawnRemotePlayer(id, data) {
    const remoteHeli = new HelicopterPlayer(scene);
    const remoteWaterSystem = new WaterSystem(scene, remoteHeli.group, { gearDown: false });
    const remoteWinchSystem = new WinchSystem(scene, remoteHeli.group, { gearDown: false });

    const searchLight = new THREE.SpotLight(0xffffff, 0.0, 150, Math.PI / 6, 0.4, 1.5);
    const searchLightTarget = new THREE.Object3D();
    remoteHeli.group.add(searchLight);
    scene.add(searchLightTarget);
    searchLight.target = searchLightTarget;

    remotePlayers[id] = {
        group: remoteHeli.group,
        helicopter: remoteHeli,
        waterSystem: remoteWaterSystem,
        winchSystem: remoteWinchSystem,
        searchLight: searchLight,
        searchLightTarget: searchLightTarget,
        targetPos: new THREE.Vector3(data.x, data.y, data.z),
        targetQuaternion: new THREE.Quaternion(data.qx || 0, data.qy || 0, data.qz || 0, data.qw || 1),
        targetFrame: data.currentFrame || 5,
        rotorSpeed: data.rotorSpeed || 0,
        gearDown: data.gearDown ?? true,
        winchState: data.winchState || 'STOWED',
        isDroppingWater: data.isDroppingWater || false,
        searchLightState: data.searchLightState || 'OFF'
    };
}

window.addEventListener('toggle-settings', (e) => {
    const isOpen = e.detail.active;
    if (settings && typeof settings.setVisible === 'function') {
        settings.setVisible(isOpen);
    }
});

const clock = new THREE.Clock();
let networkTimer = 0;

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    if (inputManager.isDragging()) {
        inputManager.updateTarget();
    }

    const nightFactor = dayNightCycle.update(delta);
    weatherSystem.update(delta);
    
    const windForce = weatherSystem.getWindForce();
    const activeWeather = weatherSystem.targetWeather;
    cloudSystem.update(delta, nightFactor, camera.quaternion, windForce, activeWeather);

    player.update(delta, nightFactor, windForce);
    
    networkTimer += delta;
    if (networkTimer >= 0.05) {
        networkTimer = 0;
        const pos = player.getPosition();
        socket.emit('player-update', {
            x: pos.x,
            y: pos.y,
            z: pos.z,
            currentFrame: player.currentFrame,
            rotorSpeed: player.rotorSpeed,
            gearDown: player.gearDown,
            qx: player.mesh.quaternion.x,
            qy: player.mesh.quaternion.y,
            qz: player.mesh.quaternion.z,
            qw: player.mesh.quaternion.w,
            winchState: helicopterSystems.tools['WINCH'] ? helicopterSystems.tools['WINCH'].state : 'STOWED',
            isDroppingWater: helicopterSystems.isWaterActive(),
            searchLightState: searchLightSystem.state
        });

        socket.emit('world-update', {
            timeOfDay: dayNightCycle.timeOfDay,
            weather: weatherSystem.targetWeather
        });
    }

    for (const id in remotePlayers) {
        const rp = remotePlayers[id];
        rp.group.position.lerp(rp.targetPos, delta * 10.0);
        rp.helicopter.mesh.quaternion.slerp(rp.targetQuaternion, delta * 10.0);

        if (rp.helicopter && rp.helicopter.rotorBlades) {
            for (const blade of rp.helicopter.rotorBlades) {
                blade.rotation.z += rp.rotorSpeed * delta;
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
            if (rp.winchState !== 'STOWED') {
                rp.winchSystem.currentExtension = 1.0;
            } else {
                rp.winchSystem.currentExtension = 0.0;
            }
            rp.winchSystem.update(delta, rp.helicopter.mesh.quaternion);
        }

        if (rp.searchLight) {
            rp.searchLight.intensity = (rp.searchLightState !== 'OFF') ? (nightFactor * 65.0) : 0.0;
            const pos = rp.group.position;
            rp.searchLightTarget.position.set(pos.x, 0, pos.z + 15);
        }
    }

    helicopterSystems.update(delta);
    collisionManager.update();
    missionManager.update(delta, player.getPosition(), nightFactor);
    hudManager.update(helicopterSystems, searchLightSystem);

    const mouseWorldPos = inputManager.getMouseWorldPosition();
    searchLightSystem.update(delta, nightFactor, mouseWorldPos);
    navRadar.update();

    const playerPos = player.getPosition();
    ocean.update(delta, playerPos);

    const focusPoint = new THREE.Vector3(playerPos.x, playerPos.y * 0.5, playerPos.z);
    const cameraOffset = new THREE.Vector3(50, 50, 50);
    camera.position.copy(focusPoint).add(cameraOffset);
    camera.lookAt(focusPoint);

    const padCenter = new THREE.Vector2(0, 0);
    const pos2D = new THREE.Vector2(playerPos.x, playerPos.z);
    const distanceFromBase = pos2D.distanceTo(padCenter);
    const isLandedAtBase = distanceFromBase < 20.0 && player.gearDown === true && playerPos.y <= 7.0;
    
    const activeRaft = missionManager.liferaftMission;
    const isSurvivorRescued = activeRaft && (activeRaft.isRescued || helicopterSystems.tools['WINCH'].hasHookedSurvivor);
    const showRescuedSurvivor = isSurvivorRescued && isLandedAtBase;

    if (showRescuedSurvivor && activeRaft && !activeRaft.isFullyCompleted) {
        activeRaft.fadeRaft(delta);
        if (mainBase.hasFadedOut) {
            activeRaft.isFullyCompleted = true;
            socket.emit('complete-mission');
        }
    }

    mainBase.update(delta, nightFactor, camera.quaternion, searchLightSystem, showRescuedSurvivor);
    windFarm.update(delta, camera.quaternion);
    
    player.mesh.quaternion.copy(camera.quaternion);
    renderer.render(scene, camera);
}

animate();

window.addEventListener('start-loading-game', () => {
    const progressBar = document.getElementById('loading-progress');
    const loadingStatus = document.getElementById('loading-status');
    const loadingScreen = document.getElementById('loading-screen');
    const copyrightNotice = document.getElementById('copyright-notice');

    let progress = 0;
    const interval = setInterval(() => {
        progress += 20;
        if (progress > 100) progress = 100;
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (loadingStatus) loadingStatus.innerText = `Loading assets (${progress}%)...`;

        if (progress >= 100) {
            clearInterval(interval);
            if (loadingStatus) loadingStatus.innerText = 'Ready! Launching flight...';
            setTimeout(() => {
                if (loadingScreen) {
                    loadingScreen.style.opacity = '0';
                    if (copyrightNotice) copyrightNotice.style.opacity = '0';
                    setTimeout(() => {
                        loadingScreen.style.display = 'none';
                        if (copyrightNotice) copyrightNotice.style.display = 'none';
                    }, 600);
                }
            }, 300);
        }
    }, 100);
});