import * as THREE from 'three';

export class CloudSystem {
    constructor(scene) {
        this.scene = scene;
        this.cloudsGroup = new THREE.Group();
        this.scene.add(this.cloudsGroup);

        this.cloudCount = 35;
        this.clouds = [];
        this.seedValue = 123456;

        this.initClouds();
    }

    setSeed(seed) {
        this.seedValue = seed;
        this.initClouds();
    }

    // Pseudo-random generator using seed so all clients position clouds identically
    seededRandom() {
        this.seedValue = (this.seedValue * 9301 + 49297) % 233280;
        return this.seedValue / 233280;
    }

    initClouds() {
        // Clear existing clouds if re-seeding
        while (this.cloudsGroup.children.length > 0) {
            this.cloudsGroup.remove(this.cloudsGroup.children[0]);
        }
        this.clouds = [];

        // Temporary backup of Math.random to enforce strict determinism per seed
        const originalRandom = Math.random;
        Math.random = () => this.seededRandom();

        const cloudGeo = new THREE.DodecahedronGeometry(35, 1);
        const cloudMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.9,
            metalness: 0.1,
            transparent: true,
            opacity: 0.85
        });

        for (let i = 0; i < this.cloudCount; i++) {
            const cloudCluster = new THREE.Group();
            const puffCount = 4 + Math.floor(Math.random() * 5);

            for (let p = 0; p < puffCount; p++) {
                const mesh = new THREE.Mesh(cloudGeo, cloudMat);
                mesh.position.set(
                    (Math.random() - 0.5) * 60,
                    (Math.random() - 0.5) * 15,
                    (Math.random() - 0.5) * 60
                );
                const scale = 0.6 + Math.random() * 0.8;
                mesh.scale.set(scale, scale * 0.6, scale);
                cloudCluster.add(mesh);
            }

            const x = (Math.random() - 0.5) * 2500;
            const y = 180 + Math.random() * 80;
            const z = (Math.random() - 0.5) * 2500;

            cloudCluster.position.set(x, y, z);
            this.cloudsGroup.add(cloudCluster);
            this.clouds.push(cloudCluster);
        }

        // Restore default Math.random
        Math.random = originalRandom;
        console.log("☁️ Cloud system synchronized with server seed.");
    }

    update(delta, nightFactor, cameraQuaternion, windForce, activeWeather) {
        const driftSpeed = 4.0;
        const driftX = windForce.x * driftSpeed * delta;
        const driftZ = windForce.z * driftSpeed * delta;

        for (const cloud of this.clouds) {
            cloud.position.x += driftX;
            cloud.position.z += driftZ;

            // Wrap around boundaries
            if (cloud.position.x > 1500) cloud.position.x = -1500;
            if (cloud.position.x < -1500) cloud.position.x = 1500;
            if (cloud.position.z > 1500) cloud.position.z = -1500;
            if (cloud.position.z < -1500) cloud.position.z = 1500;

            // Adjust cloud color/darkness depending on weather and night factor
            const baseColor = activeWeather === 'STORM' ? 0x444444 : (activeWeather === 'RAIN' ? 0x888888 : 0xffffff);
            const r = ((baseColor >> 16) & 255) / 255 * (1.0 - nightFactor * 0.5);
            const g = ((baseColor >> 8) & 255) / 255 * (1.0 - nightFactor * 0.5);
            const b = (baseColor & 255) / 255 * (1.0 - nightFactor * 0.5);

            cloud.children.forEach(puff => {
                puff.material.color.setRGB(r, g, b);
            });
        }
    }
}