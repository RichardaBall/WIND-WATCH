import * as THREE from 'three';

export class CloudSystem {
    constructor(scene) {
        this.scene = scene;
        this.cloudsGroup = new THREE.Group();
        this.scene.add(this.cloudsGroup);

        this.currentWeatherState = 'CLEAR';
        this.seed = 123456; // Default deterministic seed
        
        this.params = {
            maxCount: 150,        // Maximum pool size for worst-case weather
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

    setSeed(seed) {
        if (this.seed !== seed) {
            this.seed = seed;
            while (this.cloudsGroup.children.length > 0) {
                this.cloudsGroup.remove(this.cloudsGroup.children[0]);
            }
            this.clouds = [];
            this.buildCloudPool();
        }
    }

    // Deterministic pseudo-random number generator (Linear Congruential Generator)
    nextRandom() {
        this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
        return this.seed / 4294967296;
    }

    buildCloudPool() {
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
        this.material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: this.params.opacity,
            depthWrite: false,
            blending: THREE.NormalBlending,
            side: THREE.DoubleSide
        });

        const puffGeo = new THREE.PlaneGeometry(this.params.size, this.params.size * 0.5);
        this.clouds = [];

        for (let i = 0; i < this.params.maxCount; i++) {
            const cluster = new THREE.Group();
            const puffCount = 4 + Math.floor(this.nextRandom() * 3);

            for (let p = 0; p < puffCount; p++) {
                const mesh = new THREE.Mesh(puffGeo, this.material);
                mesh.position.set(
                    (this.nextRandom() - 0.5) * (this.params.size * 0.8),
                    (this.nextRandom() - 0.5) * 6,
                    (this.nextRandom() - 0.5) * (this.params.size * 0.8)
                );
                mesh.rotation.z = (this.nextRandom() - 0.5) * 0.5;
                
                const scaleVariation = 0.7 + this.nextRandom() * 0.6;
                mesh.scale.set(scaleVariation, scaleVariation * (0.8 + this.nextRandom() * 0.4), 1.0);

                cluster.add(mesh);
            }

            const isLower = this.nextRandom() < 0.45;
            const posY = isLower ? (this.params.altitudeLow + this.nextRandom() * 8) : (this.params.altitudeHigh + this.nextRandom() * 15);

            cluster.position.set(
                (this.nextRandom() - 0.5) * 1800,
                posY,
                (this.nextRandom() - 0.5) * 1800
            );

            cluster.scale.set(1.0, 1.0, 1.0);

            this.cloudsGroup.add(cluster);
            this.clouds.push({ 
                mesh: cluster, 
                speedX: this.params.speed + this.nextRandom() * 3,
                pulseOffset: this.nextRandom() * Math.PI * 2,
                isActive: false
            });
        }
    }

    update(delta, nightFactor, cameraQuaternion, windForce, weatherType = 'CLEAR') {
        if (!this.cloudsGroup.parent) {
            this.scene.add(this.cloudsGroup);
        }

        if (this.currentWeatherState !== weatherType) {
            this.currentWeatherState = weatherType;

            // Dynamic cloud behavior mapped to all 7 weather types
            switch (weatherType) {
                case 'STORM':
                    this.targetActiveCount = Math.round(this.params.baseCount * 1.8);
                    this.targetTint = 0.35; // Dark, ominous storm clouds
                    this.targetOpacity = 0.95;
                    break;
                case 'RAIN':
                    this.targetActiveCount = Math.round(this.params.baseCount * 1.4);
                    this.targetTint = 0.65;
                    this.targetOpacity = 0.85;
                    break;
                case 'FOG':
                    this.targetActiveCount = Math.round(this.params.baseCount * 1.6);
                    this.targetTint = 0.9;
                    this.targetOpacity = 0.92; // Thick low hanging fog clouds
                    break;
                case 'RAIN_FOG':
                    this.targetActiveCount = Math.round(this.params.baseCount * 1.7);
                    this.targetTint = 0.75;
                    this.targetOpacity = 0.90;
                    break;
                case 'SNOW':
                    this.targetActiveCount = Math.round(this.params.baseCount * 1.3);
                    this.targetTint = 0.95; // Bright snowy winter clouds
                    this.targetOpacity = 0.85;
                    break;
                case 'SNOW_FOG':
                    this.targetActiveCount = Math.round(this.params.baseCount * 1.5);
                    this.targetTint = 0.90;
                    this.targetOpacity = 0.90;
                    break;
                case 'CLEAR':
                default:
                    this.targetActiveCount = this.params.baseCount;
                    this.targetTint = 1.0;
                    this.targetOpacity = this.params.opacity;
                    break;
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
        if (weatherType === 'STORM') speedMultiplier = 2.8;
        else if (weatherType === 'RAIN' || weatherType === 'RAIN_FOG') speedMultiplier = 1.7;
        else if (weatherType === 'FOG' || weatherType === 'SNOW_FOG') speedMultiplier = 0.4;

        const elapsedTime = Date.now() * 0.001;

        // Update each cloud in the pool smoothly
        for (let i = 0; i < this.clouds.length; i++) {
            const cloud = this.clouds[i];
            const shouldBeActive = i < Math.round(this.currentActiveCount);

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

                if (cameraQuaternion) {
                    cloud.mesh.quaternion.copy(cameraQuaternion);
                }
            }
        }

        const baseTint = 1.0 - (nightFactor * 0.5);
        this.currentTint = THREE.MathUtils.lerp(this.currentTint, baseTint * this.targetTint, delta * 2.0);
        
        if (this.material) {
            this.material.color.setRGB(this.currentTint, this.currentTint, this.currentTint);
        }
    }
}