import * as THREE from 'three';
import { setupScene } from './sceneSetup.js';
import { OceanWater } from './ocean.js';
import { MainBase } from './mainbase.js';
import { HelicopterPlayer } from './player.js';
import { DayNightCycle } from './dayNightCycle.js';
import { setupSettings } from './settings.js';

const { scene, camera, renderer, sunLight, ambientLight } = setupScene();

const ocean = new OceanWater(scene, sunLight);
const mainBase = new MainBase(scene, camera, renderer);
const dayNightCycle = new DayNightCycle(scene, sunLight, ambientLight, ocean);

const player = new HelicopterPlayer(scene);

setupSettings(dayNightCycle, player);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const planeIntersectTarget = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

window.addEventListener('click', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const targetPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(planeIntersectTarget, targetPoint);

    if (targetPoint) {
        player.setTarget(targetPoint);
    }
});

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyG') {
        player.toggleGear();
    }
    if (e.code === 'KeyE') {
        player.handleEngineKey();
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

    const nightFactor = dayNightCycle.update(delta);

    player.update(delta);

    const playerPos = player.getPosition();
    ocean.update(delta, playerPos);

    camera.position.x = playerPos.x + 50;
    camera.position.z = playerPos.z + 50;
    camera.lookAt(playerPos.x, 0, playerPos.z);

    mainBase.update(nightFactor, camera.quaternion);
    
    player.mesh.quaternion.copy(camera.quaternion);

    renderer.render(scene, camera);
}

animate();