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
        
        this.material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            alphaTest: 0.5,
            roughness: 0.4,
            side: THREE.DoubleSide
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

        textureLoader.load('helicopter_gear.png', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(1 / this.totalFrames, 1);
            tex.offset.x = 0;

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
            tex.offset.x = 0;

            this.gearUpTex = tex; 
        }, undefined, (err) => {
            console.error('Error loading helicopter.png:', err);
        });

        this.group.position.set(0, 6, 0);
        this.targetPosition = new THREE.Vector3(0, 6, 0);
        this.speed = 25.0;
        this.isMoving = false;
        this.currentFrame = 3;

        this.engineState = 'OFF'; 
        this.targetAltitude = 6;  

        this.audioManager = new AudioManager();
        
        // Initialize Crash Handler
        this.crashHandler = new crash(scene);
        this.crashHandler.hideRestart();
        this.crashHandler.showRestart(() => {
            this.resetFlight();
        });
        this.crashHandler.hideRestart();

        this.hasCrashed = false;
        this.flightStarted = false;
    }

    resetFlight() {
        this.hasCrashed = false;
        this.flightStarted = false;
        this.engineState = 'OFF';
        this.gearDown = true;
        this.material.map = this.gearDownTex;
        this.material.needsUpdate = true;
        this.group.position.set(0, 6, 0);
        this.targetPosition.set(0, 6, 0);
        this.targetAltitude = 6;
        this.isMoving = false;
        this.rotorSpeed = 0;
        this.audioManager.stopAllAudio();
        this.crashHandler.hideRestart();
    }

    triggerCrash(isOceanCrash = false) {
        if (this.hasCrashed) return;
        this.hasCrashed = true;
        this.engineState = 'CRASHED';
        this.isMoving = false;
        
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
                    this.targetAltitude = 16; 
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
        if (this.hasCrashed || this.engineState !== 'RUNNING' || Math.abs(this.group.position.y - 16) > 1.0) {
            return;
        }

        const padCenter = new THREE.Vector2(0, 0);
        const clickPos2D = new THREE.Vector2(newPos.x, newPos.z);
        
        const snapThreshold = 8.0;
        if (clickPos2D.distanceTo(padCenter) < snapThreshold) {
            this.targetPosition.set(0, 16, 0);
        } else {
            this.targetPosition.copy(newPos);
            this.targetPosition.y = 16; 
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

        if (this.engineState !== 'RUNNING' || Math.abs(currentPos.y - 16) > 1.0) {
            this.targetPosition.x = currentPos.x;
            this.targetPosition.z = currentPos.z;
            this.isMoving = false;
        }

        if (this.isMoving && this.engineState === 'RUNNING') {
            const distance = new THREE.Vector2(currentPos.x, currentPos.z).distanceTo(new THREE.Vector2(this.targetPosition.x, this.targetPosition.z));

            if (distance > 0.5) {
                const dir = new THREE.Vector3().subVectors(this.targetPosition, currentPos);
                dir.y = 0;
                dir.normalize();
                
                currentPos.x += dir.x * this.speed * delta;
                currentPos.z += dir.z * this.speed * delta;

                const angle = Math.atan2(dir.z, dir.x) + Math.PI;
                let normalized = (angle + Math.PI * 2) % (Math.PI * 2);
                
                const frameIndex = Math.floor((normalized / (Math.PI * 2)) * this.totalFrames + 0.5) % this.totalFrames;
                this.currentFrame = frameIndex;

                if (this.material.map) {
                    this.material.map.offset.x = this.currentFrame * (1 / this.totalFrames);
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