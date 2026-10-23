import * as THREE from 'three';
import { setupScene } from './sceneSetup.js';
import { OceanWater } from './ocean.js';
import { MainBase } from './mainbase.js';
import { HelicopterPlayer } from './player.js';
import { HelicopterSystems } from './helicopterSystems.js';
import { DayNightCycle } from './dayNightCycle.js';
import { setupSettings } from './settings.js';
import { WindFarm } from './windfarm.js';

const { scene, camera, renderer, sunLight, ambientLight } = setupScene();

const ocean = new OceanWater(scene, sunLight);
const mainBase = new MainBase(scene, camera, renderer);
const windFarm = new WindFarm(scene, camera);
const dayNightCycle = new DayNightCycle(scene, sunLight, ambientLight, ocean);

const player = new HelicopterPlayer(scene);

const helicopterSystems = new HelicopterSystems(scene, player.group, player);

setupSettings(dayNightCycle, player);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Raycast intersection plane at ground level (y = 0)
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
    if (isMouseDown) {
        updateMouseCoords(e);
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
    if (e.code === 'Space') {
        if (!e.repeat) {
            helicopterSystems.startActiveTool();
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        helicopterSystems.stopActiveTool();
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

    const playerPos = player.getPosition();
    ocean.update(delta, playerPos);

    camera.position.x = playerPos.x + 50;
    camera.position.z = playerPos.z + 50;
    camera.position.y = playerPos.y + 50;
    
    // Offset the lookAt target to shift the helicopter higher up on the screen
    camera.lookAt(playerPos.x + 15, playerPos.y, playerPos.z + 15);

    mainBase.update(nightFactor, camera.quaternion);
    windFarm.update(delta, camera.quaternion);
    
    player.mesh.quaternion.copy(camera.quaternion);

    renderer.render(scene, camera);
}

animate();