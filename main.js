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
import { LiferaftMission } from './liferaftMission.js';

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
const liferaftMission = new LiferaftMission(scene, player, navRadar, searchLightSystem);

// Initialize modular managers
const collisionManager = new CollisionManager(scene, player, windFarm);
const missionManager = new MissionManager(scene, navRadar, windFarm, helicopterSystems);
const hudManager = new HudManager(player, helicopterSystems, searchLightSystem);

const settings = setupSettings(dayNightCycle, player, weatherSystem);
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
    missionManager.update(delta, player.getPosition());
    hudManager.update(helicopterSystems, searchLightSystem);

    const mouseWorldPos = inputManager.getMouseWorldPosition();

    searchLightSystem.update(delta, nightFactor, mouseWorldPos);
    navRadar.update();
    liferaftMission.update(delta, camera.quaternion, nightFactor, searchLightSystem);

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

    mainBase.update(nightFactor, camera.quaternion, searchLightSystem);
    windFarm.update(delta, camera.quaternion);
    
    player.mesh.quaternion.copy(camera.quaternion);

    renderer.render(scene, camera);
}

animate();