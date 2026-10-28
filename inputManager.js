// inputManager.js
import * as THREE from 'three';

export class InputManager {
    constructor(camera, player, helicopterSystems, searchLightSystem, dayNightCycle) {
        this.camera = camera;
        this.player = player;
        this.helicopterSystems = helicopterSystems;
        this.searchLightSystem = searchLightSystem;
        this.dayNightCycle = dayNightCycle;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.planeIntersectTarget = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.isMouseDown = false;

        // Clean up any old stray radar hud elements if present
        const oldRadar = document.getElementById('nav-radar-hud');
        if (oldRadar) oldRadar.remove();

        // Set initial zoom to 1.0 (max zoomed out)
        this.camera.zoom = 1.0;
        this.camera.updateProjectionMatrix();

        this.initListeners();
    }

    initListeners() {
        window.addEventListener('pointerdown', (e) => {
            // Ignore clicks originating on UI buttons or interactive overlays
            if (e.target.closest('button') || e.target.closest('#settings-btn') || e.target.closest('#fullscreen-btn') || e.target.closest('div[style*="position: absolute"]')) {
                return;
            }

            if (e.button === 0) {
                this.isMouseDown = true;
                this.updateMouseCoords(e);
                this.updateTarget();
            }
        });

        window.addEventListener('pointermove', (e) => {
            this.updateMouseCoords(e);
            if (this.isMouseDown) {
                this.updateTarget();
            }
        });

        window.addEventListener('pointerup', (e) => {
            if (e.button === 0) {
                this.isMouseDown = false;
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyG') {
                this.player.toggleGear();
            }
            if (e.code === 'KeyE') {
                this.player.handleEngineKey();
            }
            /*
            if (e.code === 'KeyL') {
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const mouseWorldPos = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(this.planeIntersectTarget, mouseWorldPos);
                this.searchLightSystem.cycleState(mouseWorldPos);
            }
            */
            if (e.code === 'Digit1') {
                this.helicopterSystems.setTool('WATER');
            }
            if (e.code === 'Digit2') {
                this.helicopterSystems.setTool('WINCH');
            }
            if (e.code === 'Space') {
                if (!e.repeat) {
                    if (this.helicopterSystems.activeToolKey === 'WATER') {
                        this.helicopterSystems.startActiveTool();
                    } else if (this.helicopterSystems.activeToolKey === 'WINCH') {
                        this.helicopterSystems.toggleActiveTool();
                    }
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                if (this.helicopterSystems.activeToolKey === 'WATER') {
                    this.helicopterSystems.stopActiveTool();
                }
            }
        });

        // Mouse wheel zoom listener: zoom in (deltaY < 0) up to 3.0, zoom out down to 1.0
        window.addEventListener('wheel', (e) => {
            const zoomSpeed = 0.1;
            if (e.deltaY < 0) {
                this.camera.zoom = Math.min(3.0, this.camera.zoom + zoomSpeed);
            } else {
                this.camera.zoom = Math.max(1.0, this.camera.zoom - zoomSpeed);
            }
            this.camera.updateProjectionMatrix();
        }, { passive: true });
    }

    updateMouseCoords(e) {
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    updateTarget() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const targetPoint = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.planeIntersectTarget, targetPoint);

        if (targetPoint) {
            targetPoint.y = 32;
            this.player.setTarget(targetPoint);
        }
    }

    getMouseWorldPosition() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const mouseWorldPos = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.planeIntersectTarget, mouseWorldPos);
        return mouseWorldPos;
    }

    isDragging() {
        return this.isMouseDown;
    }
}