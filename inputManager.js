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

        this.initListeners();
    }

    initListeners() {
        window.addEventListener('pointerdown', (e) => {
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
            if (e.code === 'KeyL') {
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const mouseWorldPos = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(this.planeIntersectTarget, mouseWorldPos);
                this.searchLightSystem.cycleState(mouseWorldPos);
            }
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
                    } else {
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

        window.addEventListener('wheel', (e) => {
            this.camera.zoom = Math.max(0.5, Math.min(2.5, this.camera.zoom - e.deltaY * 0.001));
            this.camera.updateProjectionMatrix();
        });
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