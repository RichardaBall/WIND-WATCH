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

// Connect to your online cloud server
const socket = io('https://wind-watch-server.onrender.com');

socket.on('connect', () => {
    console.log('Connected to internet co-op server!');
});

// Initialize Game Systems immediately in the background
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

// Dictionary to track remote players
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

socket.on('remote-player-update', (data) => {
    if (remotePlayers[data.id]) {
        const rp = remotePlayers[data.id];
        rp.targetPos.set(data.x, data.y, data.z);
        rp.gearDown = data.gearDown;
    }
});

socket.on('player-disconnected', (id) => {
    if (remotePlayers[id]) {
        scene.remove(remotePlayers[id].group);
        delete remotePlayers[id];
    }
});

function spawnRemotePlayer(id, data) {
    const remoteHeli = new HelicopterPlayer(scene);
    remotePlayers[id] = {
        group: remoteHeli.group,
        targetPos: new THREE.Vector3(data.x, data.y, data.z),
        helicopter: remoteHeli
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
    
    // Send local player position to the server periodically (~20 times a second)
    networkTimer += delta;
    if (networkTimer >= 0.05) {
        networkTimer = 0;
        const pos = player.getPosition();
        socket.emit('player-update', {
            x: pos.x,
            y: pos.y,
            z: pos.z,
            gearDown: player.gearDown,
            winchState: player.winchState
        });
    }

    // Smoothly update remote players
    for (const id in remotePlayers) {
        const rp = remotePlayers[id];
        rp.group.position.lerp(rp.targetPos, delta * 10.0);
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

    const waterLevel = 0.0;
    const focusPoint = new THREE.Vector3(
        playerPos.x,
        (playerPos.y + waterLevel) * 0.5,
        playerPos.z
    );

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

    if (showRescuedSurvivor && activeRaft) {
        activeRaft.fadeRaft(delta);
        if (mainBase.hasFadedOut) {
            activeRaft.isFullyCompleted = true;
        }
    }

    mainBase.update(delta, nightFactor, camera.quaternion, searchLightSystem, showRescuedSurvivor);
    windFarm.update(delta, camera.quaternion);
    
    player.mesh.quaternion.copy(camera.quaternion);

    renderer.render(scene, camera);
}

// Start render loop immediately in background
animate();

// Handle smooth loading screen progress and fade-out when START is clicked
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