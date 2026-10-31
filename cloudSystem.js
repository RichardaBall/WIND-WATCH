import * as THREE from 'three';

export class CloudSystem {
    constructor(scene) {
        this.scene = scene;
        this.cloudsGroup = new THREE.Group();
        this.scene.add(this.cloudsGroup);

        this.currentWeatherState = 'CLEAR';
        this.seed = 123456; // Default deterministic seed
        
        this.params = {
            maxCount: 250,        // Maximum total pool size allocated in memory
            altitudeLow: 30,
            altitudeHigh: 52,
            size: 38.0,
            opacity: 0.65
        };

        this.currentTint = 1.0;
        this.targetTint = 1.0;
        this.currentOpacity = this.params.opacity;
        this.targetOpacity = this.params.opacity;
        
        this.targetActiveCount = 70; // Default starting count
        this.currentActiveCount = 70;

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
            const puffCount = 5 + Math.floor(this.nextRandom() * 4);

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
                (this.nextRandom() - 0.5) * 2000,
                posY,
                (this.nextRandom() - 0.5) * 2000
            );

            cluster.scale.set(1.0, 1.0, 1.0);

            this.cloudsGroup.add(cluster);
            this.clouds.push({ 
                mesh: cluster, 
                baseSpeedX: 1.0 + this.nextRandom() * 0.5,
                baseSpeedZ: (this.nextRandom() - 0.5) * 0.3,
                pulseSpeed: 0.5 + this.nextRandom() * 1.5,
                pulseOffset: this.nextRandom() * Math.PI * 2,
                isActive: false
            });
        }
    }

    update(delta, nightFactor, cameraQuaternion, windForce, weatherType = 'CLEAR') {
        const targetSeed = Math.floor(Date.now() / 300000);
        if (this.currentCloudSeed !== targetSeed) {
            this.currentCloudSeed = targetSeed;
            this.setSeed(targetSeed);
        }

        if (!this.cloudsGroup.parent) {
            this.scene.add(this.cloudsGroup);
        }

        let targetDriftSpeed = 2.0;

        if (this.currentWeatherState !== weatherType) {
            this.currentWeatherState = weatherType;
        }

        // =========================================================================
        // FIXED CLOUD COUNTS AND EXACT DRIFT SPEEDS PER WEATHER TYPE:
        // =========================================================================
        switch (weatherType) {
            case 'STORM':
                this.targetActiveCount = 250;     // <--- Set exact cloud count for Storms
                targetDriftSpeed = 5.0;          // <--- Set exact drift speed for Storms
                this.targetTint = 0.25; 
                this.targetOpacity = 0.95;
                break;
            case 'RAIN':
                this.targetActiveCount = 200;     // <--- Set exact cloud count for Rain
                targetDriftSpeed = 3.0;          // <--- Set exact drift speed for Rain
                this.targetTint = 0.55; 
                this.targetOpacity = 0.85;
                break;
            case 'FOG':
                this.targetActiveCount = 150;     // <--- Set exact cloud count for Fog
                targetDriftSpeed = 1.0;           // <--- Set exact drift speed for Fog
                this.targetTint = 0.80; 
                this.targetOpacity = 0.92;
                break;
            case 'RAIN_FOG':
                this.targetActiveCount = 175;     // <--- Set exact cloud count for Rain + Fog
                targetDriftSpeed = 2.0;          // <--- Set exact drift speed for Rain + Fog
                this.targetTint = 0.60;
                this.targetOpacity = 0.90;
                break;
            case 'SNOW':
                this.targetActiveCount = 150;     // <--- Set exact cloud count for Snow
                targetDriftSpeed = 1.0;           // <--- Set exact drift speed for Snow
                this.targetTint = 0.85; 
                this.targetOpacity = 0.88;
                break;
            case 'SNOW_FOG':
                this.targetActiveCount = 175;     // <--- Set exact cloud count for Snow + Fog
                targetDriftSpeed = 1.0;           // <--- Set exact drift speed for Snow + Fog
                this.targetTint = 0.80;
                this.targetOpacity = 0.90;
                break;
            case 'CLEAR':
            default:
                this.targetActiveCount = 100;      // <--- Set exact cloud count for Clear weather
                targetDriftSpeed = 1.0;           // <--- Set exact drift speed for Clear weather
                this.targetTint = 1.0; 
                this.targetOpacity = this.params.opacity;
                break;
        }
        // =========================================================================

        this.currentActiveCount = THREE.MathUtils.lerp(this.currentActiveCount, this.targetActiveCount, delta * 2.0);

        if (this.material && this.material.opacity !== undefined) {
            this.currentOpacity = THREE.MathUtils.lerp(this.currentOpacity, this.targetOpacity, delta * 2.0);
            this.material.opacity = this.currentOpacity;
        }

        const elapsedTime = Date.now() * 0.001;

        for (let i = 0; i < this.clouds.length; i++) {
            const cloud = this.clouds[i];
            const shouldBeActive = i < Math.round(this.currentActiveCount);

            const targetClusterScale = shouldBeActive ? 1.0 : 0.0;
            cloud.mesh.scale.x = THREE.MathUtils.lerp(cloud.mesh.scale.x, targetClusterScale, delta * 3.0);
            cloud.mesh.scale.y = THREE.MathUtils.lerp(cloud.mesh.scale.y, targetClusterScale, delta * 3.0);
            cloud.mesh.scale.z = THREE.MathUtils.lerp(cloud.mesh.scale.z, targetClusterScale, delta * 3.0);

            if (cloud.mesh.scale.x > 0.05) {
                cloud.mesh.position.x += cloud.baseSpeedX * targetDriftSpeed * delta;
                cloud.mesh.position.z += cloud.baseSpeedZ * targetDriftSpeed * delta;

                const pulse = 1.0 + Math.sin(elapsedTime * cloud.pulseSpeed + cloud.pulseOffset) * 0.06;
                cloud.mesh.scale.set(targetClusterScale * pulse, targetClusterScale * pulse, targetClusterScale);

                if (cloud.mesh.position.x > 1000) {
                    cloud.mesh.position.x = -1000;
                } else if (cloud.mesh.position.x < -1000) {
                    cloud.mesh.position.x = 1000;
                }

                if (cloud.mesh.position.z > 1000) {
                    cloud.mesh.position.z = -1000;
                } else if (cloud.mesh.position.z < -1000) {
                    cloud.mesh.position.z = 1000;
                }

                if (cameraQuaternion) {
                    cloud.mesh.quaternion.copy(cameraQuaternion);
                }
            }
        }

        const baseTint = 1.0 - (nightFactor * 0.6);
        this.currentTint = THREE.MathUtils.lerp(this.currentTint, baseTint * this.targetTint, delta * 2.0);
        
        if (this.material) {
            this.material.color.setRGB(this.currentTint, this.currentTint, this.currentTint);
        }
    }
}