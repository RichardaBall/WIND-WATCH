// winchSystem.js
import * as THREE from 'three';

export class WinchSystem {
    constructor(scene, parentGroup, playerRef) {
        this.scene = scene;
        this.parentGroup = parentGroup;
        this.playerRef = playerRef;
        this.isActive = false;

        this.currentExtension = 0.0;
        this.targetExtension = 0.0; // 0 = retracted at belly, 1 = extended to sea level
        this.localAnchorY = -0.5;
        this.isDescendingForWinch = false;

        this.liferaftMissionRef = null;
        this.hasHookedSurvivor = false;

        // --- Rotor Wash Particle Mist Setup ---
        this.particlesCount = 3000;
        this.washGeometry = new THREE.BufferGeometry();
        this.washPositions = new Float32Array(this.particlesCount * 3);
        this.washVelocities = new Float32Array(this.particlesCount * 3);
        this.washLifetimes = new Float32Array(this.particlesCount);

        for (let i = 0; i < this.particlesCount; i++) {
            this.washPositions[i * 3] = 0;
            this.washPositions[i * 3 + 1] = -5000;
            this.washPositions[i * 3 + 2] = 0;
            this.washLifetimes[i] = 0;
        }

        this.washGeometry.setAttribute('position', new THREE.BufferAttribute(this.washPositions, 3));

        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(240, 248, 255, 0.7)');
        gradient.addColorStop(0.4, 'rgba(200, 230, 250, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);

        this.washMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 6.0,
            map: texture,
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false,
            opacity: 0.55
        });

        this.rotorWashSystem = new THREE.Points(this.washGeometry, this.washMaterial);
        this.rotorWashSystem.frustumCulled = false;
        this.rotorWashSystem.renderOrder = 998;
        this.scene.add(this.rotorWashSystem);
        this.washSpawnIndex = 0;

        // Hook position tracking
        this.hookWorldPos = new THREE.Vector3();
        this.lastHeliWorldPos = new THREE.Vector3();
        this.parentGroup.getWorldPosition(this.lastHeliWorldPos);
        this.hookWorldPos.copy(this.lastHeliWorldPos).add(new THREE.Vector3(0, this.localAnchorY, 0));

        // Winch cable line setup
        this.curvePointsCount = 10;
        const points = [];
        for (let i = 0; i < this.curvePointsCount; i++) {
            points.push(new THREE.Vector3(0, this.localAnchorY, 0));
        }
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x222222, linewidth: 3 });
        this.cableLine = new THREE.Line(lineGeo, lineMat);
        this.cableLine.frustumCulled = false;
        this.scene.add(this.cableLine);

        // Winch hook mesh
        const hookGeo = new THREE.ConeGeometry(0.2, 0.5, 6);
        const hookMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.3 });
        this.hookMesh = new THREE.Mesh(hookGeo, hookMat);
        this.hookMesh.rotation.x = Math.PI;
        this.hookMesh.visible = false;
        this.scene.add(this.hookMesh);

        // Survivor cargo mesh attached to hook
        const survivorGeo = new THREE.PlaneGeometry(3, 3);
        const survivorMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.4,
            transparent: true,
            alphaTest: 0.5,
            side: THREE.DoubleSide
        });
        
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load('raft_survivor_1_waving.png', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(1 / 43, 1);
            survivorMat.map = tex;
            survivorMat.needsUpdate = true;
        });

        this.hookedSurvivorMesh = new THREE.Mesh(survivorGeo, survivorMat);
        this.hookedSurvivorMesh.position.set(0, -0.8, 0);
        this.hookedSurvivorMesh.visible = false;
        this.hookMesh.add(this.hookedSurvivorMesh);
    }

    setLiferaftMission(mission) {
        this.liferaftMissionRef = mission;
    }

    toggle() {
        if (this.playerRef && this.playerRef.gearDown) {
            console.log("Cannot operate winch while landing gear is down!");
            this.isActive = false;
            this.isDescendingForWinch = false;
            this.targetExtension = 0.0;
            this.currentExtension = 0.0;
            if (this.playerRef && typeof this.playerRef.setWinchMode === 'function') {
                this.playerRef.setWinchMode(false);
            }
            if (this.playerRef && this.playerRef.audioManager) {
                this.playerRef.audioManager.stopWinch();
            }
            return;
        }

        this.isActive = !this.isActive;

        if (this.isActive) {
            this.isDescendingForWinch = true;
            this.targetExtension = 0.0;
            this.currentExtension = 0.0;
            if (this.playerRef && typeof this.playerRef.setWinchMode === 'function') {
                this.playerRef.setWinchMode(true);
            }
            console.log("Winch System: Descending to winch height first... ⚓");
        } else {
            this.isDescendingForWinch = false;
            this.targetExtension = 0.0;
            if (this.playerRef && this.playerRef.audioManager) {
                this.playerRef.audioManager.startWinch();
            }
            if (this.playerRef && typeof this.playerRef.startRetraction === 'function') {
                this.playerRef.startRetraction();
            }
            console.log("Winch System: Retracting cable before climbing...");
        }
    }

    isOverHelipad(heliPos) {
        const helipadCenter = new THREE.Vector3(0, 0, 0);
        const helipadRadius = 10.0;
        const horizontalDist = Math.sqrt(
            Math.pow(heliPos.x - helipadCenter.x, 2) + 
            Math.pow(heliPos.z - helipadCenter.z, 2)
        );
        return horizontalDist <= helipadRadius && heliPos.y > -2.0;
    }

    update(delta, cameraQuaternion) {
        if (this.playerRef && this.playerRef.gearDown && (this.isActive || this.currentExtension > 0.01 || this.isDescendingForWinch)) {
            this.isActive = false;
            this.isDescendingForWinch = false;
            this.targetExtension = 0.0;
            this.currentExtension = 0.0;
            if (this.playerRef && typeof this.playerRef.setWinchMode === 'function') {
                this.playerRef.setWinchMode(false);
            }
            if (this.playerRef && this.playerRef.audioManager) {
                this.playerRef.audioManager.stopWinch();
            }
            console.log("Winch auto-retracted: Landing gear deployed!");
        }

        const heliWorldPos = new THREE.Vector3();
        this.parentGroup.getWorldPosition(heliWorldPos);

        if (this.isActive && this.isDescendingForWinch) {
            const atWinchHeight = Math.abs(heliWorldPos.y - 12.0) < 0.5;
            if (atWinchHeight) {
                this.isDescendingForWinch = false;
                this.targetExtension = 1.0; 
                if (this.playerRef && this.playerRef.audioManager) {
                    this.playerRef.audioManager.startWinch();
                }
                console.log("Winch System: Reached winch height, now extending cable to sea level ⚓");
            }
        }

        const speed = 1.5;
        const prevExtension = this.currentExtension;
        
        if (!this.isDescendingForWinch) {
            this.currentExtension = THREE.MathUtils.lerp(this.currentExtension, this.targetExtension, delta * speed);
        }

        // Trigger finishRetraction as soon as the cable is fully retracted and no longer visible
        if (!this.isActive && this.currentExtension < 0.01) {
            if (this.hasHookedSurvivor) {
                this.hasHookedSurvivor = false;
                this.hookedSurvivorMesh.visible = false;
                if (this.liferaftMissionRef) {
                    this.liferaftMissionRef.setSurvivorRescued(true);
                }
            }
            if (this.playerRef && typeof this.playerRef.finishRetraction === 'function') {
                this.playerRef.finishRetraction();
            }
        }

        if (Math.abs(this.currentExtension - prevExtension) < 0.0005) {
            if ((this.targetExtension === 1.0 && this.currentExtension > 0.99) || 
                (this.targetExtension === 0.0 && this.currentExtension < 0.01)) {
                if (this.playerRef && this.playerRef.audioManager) {
                    this.playerRef.audioManager.stopWinch();
                }
            }
        }

        // --- Update Rotor Wash Mist Particles ---
        const washPos = this.washGeometry.attributes.position.array;
        const waterLevel = 0.0;
        const heightAboveWater = heliWorldPos.y - waterLevel;

        for (let i = 0; i < this.particlesCount; i++) {
            const idx = i * 3;
            if (this.washLifetimes[i] > 0) {
                washPos[idx] += this.washVelocities[idx] * delta;
                washPos[idx + 1] += this.washVelocities[idx + 1] * delta;
                washPos[idx + 2] += this.washVelocities[idx + 2] * delta;

                this.washVelocities[idx] *= 0.92;
                this.washVelocities[idx + 2] *= 0.92;
                this.washVelocities[idx + 1] -= 5.5 * delta; 

                this.washLifetimes[i] -= delta;
                if (washPos[idx + 1] <= waterLevel || this.washLifetimes[i] <= 0) {
                    washPos[idx + 1] = -5000;
                    this.washLifetimes[i] = 0;
                }
            }
        }

        const overHelipad = this.isOverHelipad(heliWorldPos);
        const isLowHover = heliWorldPos.y <= 15.0;

        if (!overHelipad && !this.isDescendingForWinch && isLowHover && heightAboveWater > 0 && heightAboveWater <= 35.0) {
            const intensity = Math.max(0, (35.0 - heightAboveWater) / 35.0);
            const spawnCount = Math.floor(intensity * 12); 

            for (let s = 0; s < spawnCount; s++) {
                const i = this.washSpawnIndex;
                const idx = i * 3;

                const angle = Math.random() * Math.PI * 2;
                const radius = 1.0 + Math.random() * 8.0;

                washPos[idx] = heliWorldPos.x + Math.cos(angle) * radius;
                washPos[idx + 1] = waterLevel + 0.1;
                washPos[idx + 2] = heliWorldPos.z + Math.sin(angle) * radius;

                const outwardSpeed = 3.0 + Math.random() * 6.0;
                this.washVelocities[idx] = Math.cos(angle) * outwardSpeed;
                this.washVelocities[idx + 1] = 1.0 + Math.random() * 2.5;
                this.washVelocities[idx + 2] = Math.sin(angle) * outwardSpeed;

                this.washLifetimes[i] = 0.8 + Math.random() * 0.5;
                this.washSpawnIndex = (this.washSpawnIndex + 1) % this.particlesCount;
            }
        }
        this.washGeometry.attributes.position.needsUpdate = true;

        const heliVelocity = heliWorldPos.clone().sub(this.lastHeliWorldPos);
        this.lastHeliWorldPos.copy(heliWorldPos);

        const startWorldPos = heliWorldPos.clone().add(new THREE.Vector3(0, this.localAnchorY, 0));
        const heliWorldY = heliWorldPos.y;
        
        // FIX 1: Account for the helicopter's altitude so the cable fully reaches sea level (y = 0.0) when fully extended
        const distanceToSeaLevel = Math.max(0, heliWorldY - this.localAnchorY);
        const targetCableLength = distanceToSeaLevel * this.currentExtension;

        const targetHookWorldY = heliWorldY + this.localAnchorY - targetCableLength;
        const targetHookWorldPos = new THREE.Vector3(
            heliWorldPos.x,
            targetHookWorldY,
            heliWorldPos.z
        );

        if ((this.currentExtension < 0.01 && !this.isActive) || this.isDescendingForWinch) {
            this.hookWorldPos.copy(startWorldPos);
            this.hookMesh.visible = false;
            this.cableLine.visible = false;
        } else {
            this.hookMesh.visible = true;
            this.cableLine.visible = true;

            const followSpeed = 4.0;
            this.hookWorldPos.lerp(targetHookWorldPos, delta * followSpeed);
            this.hookWorldPos.sub(heliVelocity.clone().multiplyScalar(0.5));
            if (this.currentExtension > 0.99) {
                this.hookWorldPos.y = Math.max(0.0, this.hookWorldPos.y);
            }

            // FIX 2: Tightened the collision distance threshold from 4.5 to 1.8 so the hook must physically get close to the survivor
            if (this.isActive && this.currentExtension > 0.95 && this.liferaftMissionRef && !this.hasHookedSurvivor && !this.liferaftMissionRef.isRescued) {
                const survivorPos = this.liferaftMissionRef.getSurvivorWorldPosition();
                const dist = this.hookWorldPos.distanceTo(survivorPos);
                if (dist < 1.8) {
                    this.hasHookedSurvivor = true;
                    this.hookedSurvivorMesh.visible = true;
                    if (this.liferaftMissionRef) {
                        this.liferaftMissionRef.setSurvivorRescued(true);
                    }
                    console.log("🪝 Winch hook latched onto survivor! Retracting...");
                    this.toggle();
                }
            }
        }

        this.hookMesh.position.copy(this.hookWorldPos);
        if (cameraQuaternion) {
            this.hookMesh.quaternion.copy(cameraQuaternion);
            this.hookedSurvivorMesh.quaternion.copy(cameraQuaternion);
        }

        const positions = this.cableLine.geometry.attributes.position.array;
        const midPoint = startWorldPos.clone().add(this.hookWorldPos).multiplyScalar(0.5);
        
        const sag = Math.max(0, startWorldPos.distanceTo(this.hookWorldPos) * 0.15) * this.currentExtension;
        midPoint.y -= sag;
        midPoint.sub(heliVelocity.clone().multiplyScalar(0.3));

        const curve = new THREE.QuadraticBezierCurve3(startWorldPos, midPoint, this.hookWorldPos);
        const sampledPoints = curve.getPoints(this.curvePointsCount - 1);

        for (let i = 0; i < this.curvePointsCount; i++) {
            positions[i * 3] = sampledPoints[i].x;
            positions[i * 3 + 1] = sampledPoints[i].y;
            positions[i * 3 + 2] = sampledPoints[i].z;
        }
        this.cableLine.geometry.attributes.position.needsUpdate = true;
    }
}