import * as THREE from 'three';

export class SearchLightSystem {
    constructor(scene, playerGroup) {
        this.scene = scene;
        this.playerGroup = playerGroup;
        this.state = 'OFF';
        this.lockedPosition = new THREE.Vector3();

        // High-intensity daylight searchlight with pure white color and balanced attenuation for vibrant daytime illumination
        this.spotLight = new THREE.SpotLight(0xffffff, 0.0, 250, Math.PI / 6, 0.3, 1.0);
        this.spotLight.position.set(0, -0.5, 0);
        this.playerGroup.add(this.spotLight);

        // Target object placed in the scene
        this.lightTarget = new THREE.Object3D();
        this.scene.add(this.lightTarget);
        this.spotLight.target = this.lightTarget;

        // Clean daylight-lit circle disc on the water surface using NormalBlending to avoid washing out
        const discGeo = new THREE.CircleGeometry(6.0, 32);
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
            console.log("Searchlight: ON (Tracking Mouse) 🔦");
        } else if (this.state === 'TRACKING') {
            this.state = 'LOCKED';
            if (worldPos) {
                this.lockedPosition.copy(worldPos);
            }
            console.log("Searchlight: LOCKED to point 🎯");
        } else {
            this.state = 'OFF';
            console.log("Searchlight: OFF");
        }
    }

    update(delta, nightFactor, mouseWorldPos) {
        if (this.state === 'OFF') {
            this.spotLight.intensity = 0.0;
            this.lightPoolMesh.material.opacity = 0.0;
            return;
        }

        // Full daytime illumination intensity inside the light cone at night
        this.spotLight.intensity = nightFactor * 90.0;
        this.lightPoolMesh.material.opacity = nightFactor * 0.9;

        // Determine target based on current state
        let targetPos = (this.state === 'LOCKED') ? this.lockedPosition : mouseWorldPos;

        if (targetPos) {
            this.lightTarget.position.copy(targetPos);
            this.lightTarget.y = 0.0;
            this.lightPoolMesh.position.set(targetPos.x, 0.05, targetPos.z);
        } else {
            const heliPos = this.playerGroup.position;
            this.lightTarget.position.set(heliPos.x, 0.0, heliPos.z + 15.0);
            this.lightPoolMesh.position.set(heliPos.x, 0.05, heliPos.z + 15.0);
        }
    }
}