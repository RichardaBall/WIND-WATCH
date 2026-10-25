// main.js
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

const { scene, camera, renderer, sunLight, ambientLight } = setupScene();

const ocean = new OceanWater(scene, sunLight);
const mainBase = new MainBase(scene, camera, renderer);
const windFarm = new WindFarm(scene, camera);
const dayNightCycle = new DayNightCycle(scene, sunLight, ambientLight, ocean);

const player = new HelicopterPlayer(scene);

// Pass player.audioManager into WeatherSystem so it has access to the audio context
const weatherSystem = new WeatherSystem(scene, camera, ocean, player.audioManager);

const helicopterSystems = new HelicopterSystems(scene, player.group, player);
const searchLightSystem = new SearchLightSystem(scene, player.group);
const navRadar = new NavRadar(scene, player, camera);

// Initialize modular managers
const collisionManager = new CollisionManager(scene, player, windFarm);
const missionManager = new MissionManager(scene, navRadar, windFarm, helicopterSystems, player, camera, searchLightSystem);
const hudManager = new HudManager(player, helicopterSystems, searchLightSystem);

const settings = setupSettings(dayNightCycle, player, weatherSystem, missionManager);
const inputManager = new InputManager(camera, player, helicopterSystems, searchLightSystem, dayNightCycle);

window.addEventListener('toggle-settings', (e) => {
    const isOpen = e.detail.active;
    if (settings && typeof settings.setVisible === 'function') {
        settings.setVisible(isOpen);
    }
});

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    // Cap delta to prevent physics/particle explosions when switching browser tabs
    const delta = Math.min(clock.getDelta(), 0.1);

    if (inputManager.isDragging()) {
        inputManager.updateTarget();
    }

    const nightFactor = dayNightCycle.update(delta);
    weatherSystem.update(delta);

    const windForce = weatherSystem.getWindForce();
    player.update(delta, nightFactor, windForce);
    
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

    // Check if survivor has been picked up/rescued AND helicopter is landed near base
    const padCenter = new THREE.Vector2(0, 0);
    const pos2D = new THREE.Vector2(playerPos.x, playerPos.z);
    const distanceFromBase = pos2D.distanceTo(padCenter);

    const isLandedAtBase = distanceFromBase < 20.0 && player.gearDown === true && playerPos.y <= 7.0;
    
    const activeRaft = missionManager.liferaftMission;
    const isSurvivorRescued = activeRaft && (activeRaft.isRescued || helicopterSystems.tools['WINCH'].hasHookedSurvivor);

    const showRescuedSurvivor = isSurvivorRescued && isLandedAtBase;

    // Fade out raft alongside the base survivor display
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

animate();