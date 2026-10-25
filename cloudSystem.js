// cloudSystem.js
import * as THREE from 'three';

export class CloudSystem {
    constructor(scene) {
        this.scene = scene;
        this.cloudGroup = new THREE.Group();
        this.scene.add(this.cloudGroup);

        this.currentWeatherState = 'CLEAR';
        
        this.params = {
            maxCount: 135,        // Maximum pool size for worst-case storm weather
            baseCount: 100,       // Normal clear weather count
            altitudeLow: 14,
            altitudeHigh: 45,
            size: 35.0,
            opacity: 0.65,
            speed: 5.0
        };

        this.currentTint = 1.0;
        this.targetTint = 1.0;
        this.currentOpacity = this.params.opacity;
        this.targetOpacity = this.params.opacity;
        
        this.targetActiveCount = this.params.baseCount;
        this.currentActiveCount = this.params.baseCount;

        this.buildCloudPool();
    }

    buildCloudPool() {
        // Create canvas texture once
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        gradient.addColorStop(0.4, 'rgba(240, 245, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);

        const texture = new THREE.CanvasTexture(canvas);
        this.material = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            opacity: 0.0, // Start invisible for smooth fade-in
            depthWrite: false,
            blending: THREE.NormalBlending,
            roughness: 1.0,
            side: THREE.DoubleSide
        });

        const puffGeo = new THREE.PlaneGeometry(this.params.size, this.params.size * 0.5);
        this.clouds = [];

        // Pre-spawn maximum pool of clouds
        for (let i = 0; i < this.params.maxCount; i++) {
            const cluster = new THREE.Group();
            const puffCount = 4 + Math.floor(Math.random() * 3);

            for (let p = 0; p < puffCount; p++) {
                const mesh = new THREE.Mesh(puffGeo, this.material);
                mesh.position.set(
                    (Math.random() - 0.5) * (this.params.size * 0.8),
                    (Math.random() - 0.5) * 6,
                    (Math.random() - 0.5) * (this.params.size * 0.8)
                );
                mesh.rotation.z = (Math.random() - 0.5) * 0.5;
                
                const scaleVariation = 0.7 + Math.random() * 0.6;
                mesh.scale.set(scaleVariation, scaleVariation * (0.8 + Math.random() * 0.4), 1.0);

                cluster.add(mesh);
            }

            const isLower = Math.random() < 0.45;
            const posY = isLower ? (this.params.altitudeLow + Math.random() * 8) : (this.params.altitudeHigh + Math.random() * 15);

            cluster.position.set(
                (Math.random() - 0.5) * 1800,
                posY,
                (Math.random() - 0.5) * 1800
            );

            // Initially set scale to 0 so they can smoothly scale/pop in
            cluster.scale.set(0, 0, 0);

            this.cloudGroup.add(cluster);
            this.clouds.push({ 
                mesh: cluster, 
                speedX: this.params.speed + Math.random() * 3,
                pulseOffset: Math.random() * Math.PI * 2,
                isActive: false
            });
        }
    }

    update(delta, nightFactor, cameraQuaternion, windForce, weatherType = 'CLEAR') {
        if (this.currentWeatherState !== weatherType) {
            this.currentWeatherState = weatherType;

            // Set targets based on weather without destroying any geometry
            if (weatherType === 'STORM') {
                this.targetActiveCount = Math.round(this.params.baseCount * 1.8);
                this.targetTint = 0.35;
                this.targetOpacity = 0.9;
            } else if (weatherType === 'RAIN' || weatherType === 'SNOW') {
                this.targetActiveCount = Math.round(this.params.baseCount * 1.4);
                this.targetTint = 0.6;
                this.targetOpacity = 0.82;
            } else if (weatherType === 'FOG' || weatherType === 'RAIN_FOG' || weatherType === 'SNOW_FOG') {
                this.targetActiveCount = Math.round(this.params.baseCount * 1.3);
                this.targetTint = 0.8;
                this.targetOpacity = 0.88;
            } else {
                this.targetActiveCount = this.params.baseCount;
                this.targetTint = 1.0;
                this.targetOpacity = this.params.opacity;
            }
        }

        // Smoothly transition active cloud counts
        this.currentActiveCount = THREE.MathUtils.lerp(this.currentActiveCount, this.targetActiveCount, delta * 2.0);

        // Smooth opacity and tint transitions
        if (this.material && this.material.opacity !== undefined) {
            this.currentOpacity = THREE.MathUtils.lerp(this.currentOpacity, this.targetOpacity, delta * 2.0);
            this.material.opacity = this.currentOpacity;
        }

        let speedMultiplier = 1.0;
        if (weatherType === 'STORM') speedMultiplier = 2.6;
        else if (weatherType === 'RAIN' || weatherType === 'RAIN_FOG') speedMultiplier = 1.6;
        else if (weatherType === 'FOG') speedMultiplier = 0.5;

        const elapsedTime = Date.now() * 0.001;

        // Update each cloud in the pool smoothly
        for (let i = 0; i < this.clouds.length; i++) {
            const cloud = this.clouds[i];
            const shouldBeActive = i < Math.round(this.currentActiveCount);

            // Smoothly scale clouds in or out based on whether they should be active
            const targetClusterScale = shouldBeActive ? 1.0 : 0.0;
            cloud.mesh.scale.x = THREE.MathUtils.lerp(cloud.mesh.scale.x, targetClusterScale, delta * 3.0);
            cloud.mesh.scale.y = THREE.MathUtils.lerp(cloud.mesh.scale.y, targetClusterScale, delta * 3.0);
            cloud.mesh.scale.z = THREE.MathUtils.lerp(cloud.mesh.scale.z, targetClusterScale, delta * 3.0);

            if (cloud.mesh.scale.x > 0.05) {
                const wx = windForce ? windForce.x * 0.5 : 0;
                cloud.mesh.position.x += (cloud.speedX * speedMultiplier + wx) * delta;

                if (cloud.mesh.position.x > 900) {
                    cloud.mesh.position.x = -900;
                }

                // Subtle organic pulsing
                const pulse = 1.0 + Math.sin(elapsedTime * 1.5 + cloud.pulseOffset) * 0.03;
                
                if (cameraQuaternion) {
                    cloud.mesh.quaternion.copy(cameraQuaternion);
                }
            }
        }

        const baseTint = 1.0 - (nightFactor * 0.75);
        this.currentTint = THREE.MathUtils.lerp(this.currentTint, baseTint * this.targetTint, delta * 2.0);
        
        if (this.material) {
            this.material.color.setRGB(this.currentTint, this.currentTint, this.currentTint);
        }
    }
}