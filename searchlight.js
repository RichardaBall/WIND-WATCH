// searchlight.js
import * as THREE from 'three';

export class SearchLightSystem {
    constructor(scene, playerGroup) {
        this.scene = scene;
        this.playerGroup = playerGroup;
        this.state = 'TRACKING'; // Active by default
        this.lockedPosition = new THREE.Vector3();

        // Focused downwards spotlight with reduced range so it doesn't spill over to the water
        this.spotLight = new THREE.SpotLight(0xffffee, 40.0, 50.0, Math.PI / 6, 0.5, 1.0);
        
        // Position directly under the helicopter pointing straight down
        this.spotLight.position.set(0, -0.5, 0);
        this.playerGroup.add(this.spotLight);

        // Target object placed right below the helicopter
        this.lightTarget = new THREE.Object3D();
        this.scene.add(this.lightTarget);
        this.spotLight.target = this.lightTarget;

        // Clean light circle disc directly beneath
        const discGeo = new THREE.CircleGeometry(4.0, 32);
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

        this.lightPoolMesh = new THREE.Mesh(discGeo, discMat);
        this.lightPoolMesh.position.set(0, 0.05, 0);
        this.scene.add(this.lightPoolMesh);
    }

    cycleState(worldPos) {
        if (this.state === 'OFF') {
            this.state = 'TRACKING';
        } else {
            this.state = 'OFF';
        }
    }

    update(delta, nightFactor, mouseWorldPos, currentFrame = 5, totalFrames = 8) {
        if (this.state === 'OFF') {
            this.spotLight.intensity = 0.0;
            this.lightPoolMesh.material.opacity = 0.0;
            return;
        }

        this.spotLight.intensity = nightFactor * 45.0;
        
        // Only show the ground light pool if the helicopter is over the main base area (near the center island)
        const heliPos = this.playerGroup.position;
        const distFromCenter = Math.sqrt(heliPos.x * heliPos.x + heliPos.z * heliPos.z);
        const isOverMainBase = distFromCenter < 45.0;

        this.lightPoolMesh.material.opacity = isOverMainBase ? nightFactor * 0.8 : 0.0;

        // Point straight down below the helicopter
        this.lightTarget.position.set(heliPos.x, heliPos.y - 20.0, heliPos.z);
        this.lightPoolMesh.position.set(heliPos.x, 0.05, heliPos.z);
    }
}