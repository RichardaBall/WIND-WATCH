import * as THREE from 'three';
import { AudioManager } from './audioManager.js';
import { crash } from './crash.js';

export class HelicopterPlayer {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        scene.add(this.group);

        const textureLoader = new THREE.TextureLoader();
        this.totalFrames = 8;

        const geometry = new THREE.PlaneGeometry(24, 24);
        
        // Single material handling base shading and emissive map for both nav lights and cockpit glow
        this.material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.4,
            transparent: true,
            alphaTest: 0.5,
            side: THREE.DoubleSide,
            emissive: 0xffffff,
            emissiveIntensity: 2.0
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
        this.group.add(this.mesh);

        // --- Rotor Group Permanent Settings ---
        this.rotorGroup = new THREE.Group();
        this.rotorGroup.position.set(0, 2.0, 0); 
        this.group.add(this.rotorGroup);

        const rotorGeo = new THREE.PlaneGeometry(8, 0.6);
        const rotorMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.5,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide
        });

        this.rotor1 = new THREE.Mesh(rotorGeo, rotorMat);
        this.rotor1.rotation.x = -Math.PI / 2;
        this.rotor1.scale.set(1.0, 0.6, 1.0); 
        this.rotorGroup.add(this.rotor1);

        this.rotor2 = new THREE.Mesh(rotorGeo, rotorMat);
        this.rotor2.rotation.x = -Math.PI / 2;
        this.rotor2.rotation.z = Math.PI / 2;
        this.rotor2.scale.set(1.0, 0.6, 1.0);
        this.rotorGroup.add(this.rotor2);

        this.rotorBlades = [this.rotor1, this.rotor2];
        this.rotorSpeed = 0;
        this.maxRotorSpeed = 90.0;

        this.gearDown = true;

        // --- Ground Shadow Setup ---
        const shadowCanvas = document.createElement('canvas');
        shadowCanvas.width = 64;
        shadowCanvas.height = 64;
        const sCtx = shadowCanvas.getContext('2d');
        const sGrad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
        sGrad.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
        sGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.15)');
        sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        sCtx.fillStyle = sGrad;
        sCtx.fillRect(0, 0, 64, 64);

        const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
        const shadowGeo = new THREE.PlaneGeometry(10, 10);
        const shadowMat = new THREE.MeshBasicMaterial({
            map: shadowTexture,
            transparent: true,
            depthWrite: false,
            depthTest: false
        });
        this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        this.shadowMesh.rotation.x = -Math.PI / 2; 
        this.shadowMesh.position.set(0, 0.2, 0);   
        this.scene.add(this.shadowMesh);

        // --- Vertical Tracking Line Setup ---
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, 0)
        ]);
        const lineMat = new THREE.LineDashedMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.25,
            dashSize: 0.2,
            gapSize: 0.6
        });
        this.dropLine = new THREE.Line(lineGeo, lineMat);
        this.dropLine.frustumCulled = false;
        this.scene.add(this.dropLine);

        // Start facing down using frame index 5
        this.currentFrame = 5;

        textureLoader.load('helicopter_gear.png', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(1 / this.totalFrames, 1);
            tex.offset.x = this.currentFrame * (1 / this.totalFrames);

            this.gearDownTex = tex; 
            if (this.gearDown) {
                this.material.map = tex;
                this.material.needsUpdate = true;
            }
        }, undefined, (err) => {
            console.error('Error loading helicopter_gear.png:', err);
        });

        textureLoader.load('helicopter.png', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(1 / this.totalFrames, 1);
            tex.offset.x = this.currentFrame * (1 / this.totalFrames);

            this.gearUpTex = tex; 
        }, undefined, (err) => {
            console.error('Error loading helicopter.png:', err);
        });

        textureLoader.load('helicopter_emissive.png', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(1 / this.totalFrames, 1);
            tex.offset.x = this.currentFrame * (1 / this.totalFrames);

            this.emissiveTex = tex;
            this.material.emissiveMap = tex;
            this.material.needsUpdate = true;
        }, undefined, (err) => {
            console.warn('helicopter_emissive.png not found.');
        });

        this.group.position.set(0, 6, 0);
        this.targetPosition = new THREE.Vector3(0, 6, 0);
        this.speed = 25.0;
        this.isMoving = false;

        this.engineState = 'OFF'; 
        this.targetAltitude = 6;  

        this.audioManager = new AudioManager();
        
        this.crashHandler = new crash(scene);
        this.crashHandler.hideRestart();
        this.crashHandler.showRestart(() => {
            this.resetFlight();
        });
        this.crashHandler.hideRestart();

        this.hasCrashed = false;
        this.flightStarted = false;
    }

    setVisibility(visible) {
        if (this.group) {
            this.group.visible = visible;
            if (this.shadowMesh) this.shadowMesh.visible = visible;
            if (this.dropLine) this.dropLine.visible = visible;
        }
    }

    resetFlight() {
        this.hasCrashed = false;
        this.flightStarted = false;
        this.engineState = 'OFF';
        this.gearDown = true;
        this.currentFrame = 5;
        if (this.gearDownTex && this.material) {
            this.material.map = this.gearDownTex;
            this.material.map.offset.x = 5 * (1 / this.totalFrames);
            this.material.needsUpdate = true;
        }
        if (this.emissiveTex && this.material) {
            this.material.emissiveMap.offset.x = 5 * (1 / this.totalFrames);
            this.material.needsUpdate = true;
        }
        this.group.position.set(0, 6, 0);
        this.targetPosition.set(0, 6, 0);
        this.targetAltitude = 6;
        this.isMoving = false;
        this.rotorSpeed = 0;
        this.audioManager.stopAllAudio();
        this.crashHandler.hideRestart();
        if (this.shadowMesh) this.shadowMesh.visible = true;
        if (this.dropLine) this.dropLine.visible = true;
    }

    triggerCrash(isOceanCrash = false) {
        if (this.hasCrashed) return;
        this.hasCrashed = true;
        this.engineState = 'CRASHED';
        this.isMoving = false;
        if (this.shadowMesh) this.shadowMesh.visible = false;
        if (this.dropLine) this.dropLine.visible = false;
        
        if (isOceanCrash) {
            this.audioManager.playSplash();
        } else {
            this.audioManager.playExplosion();
        }

        this.crashHandler.deploy(this.group.position);
    }

    handleEngineKey() {
        if (this.hasCrashed) return;

        const padCenter = new THREE.Vector2(0, 0);
        const pos2D = new THREE.Vector2(this.group.position.x, this.group.position.z);
        const isOverOcean = pos2D.distanceTo(padCenter) > 10.0;

        if (this.engineState === 'OFF') {
            this.engineState = 'STARTING';
            this.targetPosition.copy(this.group.position);
            this.isMoving = false;
            this.flightStarted = true;
            
            this.audioManager.playStartup(() => {
                if (this.engineState === 'STARTING') {
                    this.engineState = 'RUNNING';
                    this.audioManager.startRotor();
                    this.targetAltitude = 32; 
                }
            });
        } else if (this.engineState === 'RUNNING') {
            this.engineState = 'SHUTTING_DOWN';
            this.targetPosition.copy(this.group.position);
            this.isMoving = false;
            this.audioManager.stopRotor();

            this.targetAltitude = isOverOcean ? 0.0 : 6.0; 
            
            this.audioManager.playShutdown(() => {
                if (this.engineState === 'SHUTTING_DOWN') {
                    this.engineState = 'OFF';
                }
            });
        }
    }

    setTarget(newPos) {
        if (this.hasCrashed || this.engineState !== 'RUNNING' || Math.abs(this.group.position.y - 32) > 1.0) {
            return;
        }

        const padCenter = new THREE.Vector2(0, 0);
        const clickPos2D = new THREE.Vector2(newPos.x, newPos.z);
        
        const snapThreshold = 8.0;
        if (clickPos2D.distanceTo(padCenter) < snapThreshold) {
            this.targetPosition.set(0, 32, 0);
        } else {
            this.targetPosition.copy(newPos);
            this.targetPosition.y = 32; 
        }

        this.isMoving = true;
    }

    toggleGear() {
        if (this.hasCrashed) return;

        if (this.gearDown && this.group.position.y < 10.0) {
            return;
        }

        this.gearDown = !this.gearDown;
        const currentOffset = this.material.map ? this.material.map.offset.x : 0;

        if (this.gearDown && this.gearDownTex) {
            this.material.map = this.gearDownTex;
        } else if (!this.gearDown && this.gearUpTex) {
            this.material.map = this.gearUpTex;
        }
        if (this.material.map) {
            this.material.map.offset.x = currentOffset;
        }
        this.material.needsUpdate = true;

        this.audioManager.playGear();
    }

    update(delta) {
        if (this.hasCrashed) return;

        const padCenter = new THREE.Vector2(0, 0);
        const pos2D = new THREE.Vector2(this.group.position.x, this.group.position.z);
        const distanceFromBase = pos2D.distanceTo(padCenter);
        const isOverOcean = distanceFromBase > 10.0;

        if (this.flightStarted) {
            if (isOverOcean && this.group.position.y <= 1.0) {
                this.triggerCrash(true);
                return;
            }

            if (this.engineState === 'SHUTTING_DOWN' && Math.abs(this.group.position.y - 6.0) < 0.5) {
                if (distanceFromBase < 8.0 && !this.gearDown) {
                    this.triggerCrash(false);
                    return;
                }
            }
        }

        if (this.engineState === 'STARTING') {
            const duration = this.audioManager.getStartupDuration();
            const currentTime = this.audioManager.getStartupCurrentTime();
            if (duration && !isNaN(duration)) {
                const progress = Math.min(1.0, currentTime / duration);
                this.rotorSpeed = progress * this.maxRotorSpeed;
            } else {
                this.rotorSpeed = Math.min(this.maxRotorSpeed, this.rotorSpeed + delta * 30);
            }
        } else if (this.engineState === 'RUNNING') {
            this.rotorSpeed = this.maxRotorSpeed;
        } else if (this.engineState === 'SHUTTING_DOWN') {
            const duration = this.audioManager.getShutdownDuration();
            const currentTime = this.audioManager.getShutdownCurrentTime();
            if (duration && !isNaN(duration)) {
                const progress = Math.max(0.0, 1.0 - (currentTime / duration));
                this.rotorSpeed = progress * this.maxRotorSpeed;
            } else {
                this.rotorSpeed = Math.max(0.0, this.rotorSpeed - delta * 30);
            }
        } else {
            this.rotorSpeed = 0;
        }

        for (const blade of this.rotorBlades) {
            blade.rotation.z += this.rotorSpeed * delta;
        }

        const currentPos = this.group.position;
        currentPos.y = THREE.MathUtils.lerp(currentPos.y, this.targetAltitude, delta * 3.0);

        if (this.shadowMesh && this.dropLine) {
            this.shadowMesh.position.set(currentPos.x, 0.2, currentPos.z);
            
            const heightFactor = Math.max(0.4, 1.0 - (currentPos.y / 60.0));
            this.shadowMesh.scale.set(heightFactor, heightFactor, heightFactor);

            const positions = this.dropLine.geometry.attributes.position.array;
            positions[0] = currentPos.x;
            positions[1] = 0.2;
            positions[2] = currentPos.z;

            positions[3] = currentPos.x;
            positions[4] = currentPos.y;
            positions[5] = currentPos.z;

            this.dropLine.geometry.attributes.position.needsUpdate = true;
            this.dropLine.computeLineDistances();
        }

        if (this.engineState !== 'RUNNING' || Math.abs(currentPos.y - 32) > 1.0) {
            this.targetPosition.x = currentPos.x;
            this.targetPosition.z = currentPos.z;
            this.isMoving = false;
        }

        if (this.isMoving && this.engineState === 'RUNNING') {
            const targetXZ = new THREE.Vector2(this.targetPosition.x, this.targetPosition.z);
            const currentXZ = new THREE.Vector2(currentPos.x, currentPos.z);
            const distance = currentXZ.distanceTo(targetXZ);

            if (distance > 0.3) {
                // Lower lerp value (0.8) makes acceleration much slower, heavier, and gradual
                currentXZ.lerp(targetXZ, delta * 0.8);
                
                const moveDir = new THREE.Vector2().subVectors(targetXZ, currentXZ).normalize();
                
                currentPos.x = currentXZ.x;
                currentPos.z = currentXZ.y;

                const angle = Math.atan2(moveDir.y, moveDir.x) + Math.PI;
                let normalized = (angle + Math.PI * 2) % (Math.PI * 2);
                
                const frameIndex = Math.floor((normalized / (Math.PI * 2)) * this.totalFrames + 0.5) % this.totalFrames;
                this.currentFrame = frameIndex;

                const frameOffset = this.currentFrame * (1 / this.totalFrames);
                if (this.material.map) {
                    this.material.map.offset.x = frameOffset;
                }
                if (this.material.emissiveMap) {
                    this.material.emissiveMap.offset.x = frameOffset;
                }
            } else {
                this.isMoving = false;
            }
        }
    }

    getPosition() {
        return this.group.position;
    }
}