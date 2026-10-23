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

const { scene, camera, renderer, sunLight, ambientLight } = setupScene();

const ocean = new OceanWater(scene, sunLight);
const mainBase = new MainBase(scene, camera, renderer);
const windFarm = new WindFarm(scene, camera);
const dayNightCycle = new DayNightCycle(scene, sunLight, ambientLight, ocean);

const player = new HelicopterPlayer(scene);
const helicopterSystems = new HelicopterSystems(scene, player.group, player);
const searchLightSystem = new SearchLightSystem(scene, player.group);

setupSettings(dayNightCycle, player);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Raycast intersection plane at ground/sea level (y = 0)
const planeIntersectTarget = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

let isMouseDown = false;

window.addEventListener('pointerdown', (e) => {
    if (e.button === 0) {
        isMouseDown = true;
        updateMouseCoords(e);
        updateTarget();
    }
});

window.addEventListener('pointermove', (e) => {
    updateMouseCoords(e);
    if (isMouseDown) {
        updateTarget();
    }
});

window.addEventListener('pointerup', (e) => {
    if (e.button === 0) {
        isMouseDown = false;
    }
});

function updateMouseCoords(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

function updateTarget() {
    raycaster.setFromCamera(mouse, camera);
    const targetPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(planeIntersectTarget, targetPoint);

    if (targetPoint) {
        targetPoint.y = 32;
        player.setTarget(targetPoint);
    }
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyG') {
        player.toggleGear();
    }
    if (e.code === 'KeyE') {
        player.handleEngineKey();
    }
    if (e.code === 'KeyL') {
        raycaster.setFromCamera(mouse, camera);
        const mouseWorldPos = new THREE.Vector3();
        raycaster.ray.intersectPlane(planeIntersectTarget, mouseWorldPos);
        searchLightSystem.cycleState(mouseWorldPos);
    }
    if (e.code === 'Digit1') {
        helicopterSystems.setTool('WATER');
    }
    if (e.code === 'Digit2') {
        helicopterSystems.setTool('WINCH');
    }
    if (e.code === 'Space') {
        if (!e.repeat) {
            helicopterSystems.toggleActiveTool();
        }
    }
});

window.addEventListener('wheel', (e) => {
    camera.zoom = Math.max(0.5, Math.min(2.5, camera.zoom - e.deltaY * 0.001));
    camera.updateProjectionMatrix();
});

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (isMouseDown) {
        updateTarget();
    }

    const nightFactor = dayNightCycle.update(delta);

    player.update(delta);
    helicopterSystems.update(delta);

    // Calculate mouse world position on the water surface for the searchlight
    raycaster.setFromCamera(mouse, camera);
    const mouseWorldPos = new THREE.Vector3();
    raycaster.ray.intersectPlane(planeIntersectTarget, mouseWorldPos);

    searchLightSystem.update(delta, nightFactor, mouseWorldPos);

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

    mainBase.update(nightFactor, camera.quaternion);
    windFarm.update(delta, camera.quaternion);
    
    player.mesh.quaternion.copy(camera.quaternion);

    renderer.render(scene, camera);
}

animate();