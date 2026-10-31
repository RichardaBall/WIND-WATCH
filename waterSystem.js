// waterSystem.js
import * as THREE from 'three';

export class WaterSystem {
    constructor(scene, parentGroup, playerRef) {
        this.scene = scene;
        this.parentGroup = parentGroup;
        this.playerRef = playerRef;
        this.isActive = false;

        this.particlesCount = 4000;
        this.splashCount = 1500;

        this.params = {
            particleSize: 9.0,
            particleOpacity: 0.35,
            fallSpeed: 4.0,
            spread: 8.0,
            spawnRate: 10,
            splashSize: 7.0,
            splashOpacity: 0.5
        };

        this.lastHeliWorldPos = new THREE.Vector3();
        this.parentGroup.getWorldPosition(this.lastHeliWorldPos);
        this.heliVelocity = new THREE.Vector3();

        // Pre-allocated scratch vector for calculations
        this._scratchSpawnCenter = new THREE.Vector3();

        this.particleGeometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.particlesCount * 3);
        this.velocities = new Float32Array(this.particlesCount * 3);
        this.lifetimes = new Float32Array(this.particlesCount);
        this.sizes = new Float32Array(this.particlesCount);

        for (let i = 0; i < this.particlesCount; i++) {
            this.positions[i * 3] = 0;
            this.positions[i * 3 + 1] = -5000; 
            this.positions[i * 3 + 2] = 0;
            this.lifetimes[i] = 0;
            this.sizes[i] = 1.0;
        }

        this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.particleGeometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(235, 245, 255, 0.85)');
        gradient.addColorStop(0.3, 'rgba(200, 225, 245, 0.45)');
        gradient.addColorStop(0.7, 'rgba(175, 210, 240, 0.15)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);

        this.particleMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: this.params.particleSize,
            map: texture,
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false, 
            depthTest: true,
            opacity: this.params.particleOpacity
        });

        this.particleSystem = new THREE.Points(this.particleGeometry, this.particleMaterial);
        this.particleSystem.frustumCulled = false;
        this.particleSystem.renderOrder = 999;
        this.scene.add(this.particleSystem);

        this.splashGeometry = new THREE.BufferGeometry();
        this.splashPositions = new Float32Array(this.splashCount * 3);
        this.splashVelocities = new Float32Array(this.splashCount * 3);
        this.splashLifetimes = new Float32Array(this.splashCount);

        for (let i = 0; i < this.splashCount; i++) {
            this.splashPositions[i * 3] = 0;
            this.splashPositions[i * 3 + 1] = -5000;
            this.splashPositions[i * 3 + 2] = 0;
            this.splashLifetimes[i] = 0;
        }

        this.splashGeometry.setAttribute('position', new THREE.BufferAttribute(this.splashPositions, 3));

        this.splashMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: this.params.splashSize,
            map: texture,
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false,
            depthTest: true,
            opacity: this.params.splashOpacity
        });

        this.splashSystem = new THREE.Points(this.splashGeometry, this.splashMaterial);
        this.splashSystem.frustumCulled = false;
        this.splashSystem.renderOrder = 999;
        this.scene.add(this.splashSystem);
        
        this.spawnIndex = 0;
        this.splashSpawnIndex = 0;
    }

    triggerSplash(x, z, count = 1) {
        const waterLevel = 0.0;
        const splashPos = this.splashGeometry.attributes.position.array;

        for (let s = 0; s < count; s++) {
            const i = this.splashSpawnIndex;
            const idx = i * 3;

            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 4.5;

            splashPos[idx] = x + Math.cos(angle) * radius;
            splashPos[idx + 1] = waterLevel + 0.1;
            splashPos[idx + 2] = z + Math.sin(angle) * radius;

            const outwardSpeed = 4.0 + Math.random() * 7.0;
            this.splashVelocities[idx] = Math.cos(angle) * outwardSpeed;
            this.splashVelocities[idx + 1] = 1.5 + Math.random() * 3.0; 
            this.splashVelocities[idx + 2] = Math.sin(angle) * outwardSpeed;

            this.splashLifetimes[i] = 0.9 + Math.random() * 0.7;
            this.splashSpawnIndex = (this.splashSpawnIndex + 1) % this.splashCount;
        }
    }

    start() {
        if (this.playerRef && this.playerRef.gearDown) {
            this.isActive = false;
            return;
        }
        this.isActive = true;
        if (this.playerRef && this.playerRef.audioManager) {
            this.playerRef.audioManager.startWaterSpray();
        }
    }

    stop() {
        this.isActive = false;
        if (this.playerRef && this.playerRef.audioManager) {
            this.playerRef.audioManager.stopWaterSpray();
        }
    }

    toggle() {
        if (this.isActive) {
            this.stop();
        } else {
            this.start();
        }
    }

    update(delta) {
        if (this.isActive && this.playerRef && this.playerRef.gearDown) {
            this.isActive = false;
            if (this.playerRef.audioManager) {
                this.playerRef.audioManager.stopWaterSpray();
            }
        }

        const currentHeliWorldPos = this._scratchSpawnCenter;
        this.parentGroup.getWorldPosition(currentHeliWorldPos);
        if (delta > 0) {
            this.heliVelocity.copy(currentHeliWorldPos).sub(this.lastHeliWorldPos).divideScalar(delta);
        }
        this.lastHeliWorldPos.copy(currentHeliWorldPos);

        const positions = this.particleGeometry.attributes.position.array;
        const splashPos = this.splashGeometry.attributes.position.array;
        const waterLevel = 0.0;

        for (let i = 0; i < this.particlesCount; i++) {
            const idx = i * 3;

            if (this.lifetimes[i] > 0) {
                positions[idx] += this.velocities[idx] * delta;
                positions[idx + 1] += this.velocities[idx + 1] * delta;
                positions[idx + 2] += this.velocities[idx + 2] * delta;

                this.velocities[idx] *= 0.93;
                this.velocities[idx + 2] *= 0.93;
                this.velocities[idx + 1] -= 9.8 * delta; 
                this.lifetimes[i] -= delta;

                if (positions[idx + 1] <= waterLevel || this.lifetimes[i] <= 0) {
                    if (positions[idx + 1] <= waterLevel) {
                        this.triggerSplash(positions[idx], positions[idx + 2], 2);
                    }
                    positions[idx + 1] = -5000;
                    this.lifetimes[i] = 0;
                }
            }
        }

        for (let i = 0; i < this.splashCount; i++) {
            const idx = i * 3;
            if (this.splashLifetimes[i] > 0) {
                splashPos[idx] += this.splashVelocities[idx] * delta;
                splashPos[idx + 1] += this.splashVelocities[idx + 1] * delta;
                splashPos[idx + 2] += this.splashVelocities[idx + 2] * delta;

                this.splashVelocities[idx] *= 0.88;
                this.splashVelocities[idx + 2] *= 0.88;
                this.splashVelocities[idx + 1] -= 4.5 * delta; 

                this.splashLifetimes[i] -= delta;
                if (splashPos[idx + 1] <= waterLevel || this.splashLifetimes[i] <= 0) {
                    splashPos[idx + 1] = -5000;
                    this.splashLifetimes[i] = 0;
                }
            }
        }

        if (this.isActive) {
            const spawnBatch = Math.floor(this.params.spawnRate);

            for (let b = 0; b < spawnBatch; b++) {
                const i = this.spawnIndex;
                const idx = i * 3;

                const angle = Math.random() * Math.PI * 2;
                const radius = 0.2 + Math.random() * 2.5;

                positions[idx] = currentHeliWorldPos.x + Math.cos(angle) * radius;
                positions[idx + 1] = currentHeliWorldPos.y - 1.8;
                positions[idx + 2] = currentHeliWorldPos.z + Math.sin(angle) * radius;

                const scatter = this.params.spread;
                const trailX = -this.heliVelocity.x * 0.3;
                const trailZ = -this.heliVelocity.z * 0.3;

                this.velocities[idx] = (Math.random() - 0.5) * scatter + trailX;
                this.velocities[idx + 1] = -this.params.fallSpeed - Math.random() * 4.0; 
                this.velocities[idx + 2] = (Math.random() - 0.5) * scatter + trailZ;

                this.lifetimes[i] = 4.0; 

                this.spawnIndex = (this.spawnIndex + 1) % this.particlesCount;
            }
        }

        this.particleGeometry.attributes.position.needsUpdate = true;
        this.splashGeometry.attributes.position.needsUpdate = true;
    }
}