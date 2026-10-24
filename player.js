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
            depthWrite: true,
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
        this.isWinchActive = false;
        this.winchState = 'STOWED'; // 'STOWED', 'DESCENDING', 'LOWERING', 'DEPLOYED', 'RAISING', 'CLIMBING'
        this.winchTimer = 0;

        // --- Belly Night Searchlight Setup ---
        this.searchLight = new THREE.SpotLight(0xffffee, 0.0, 120.0, Math.PI / 5, 0.4, 1.5);
        this.searchLight.position.set(0, -0.5, 0);
        this.searchLightTarget = new THREE.Object3D();
        this.searchLightTarget.position.set(0, -15, 10);
        this.group.add(this.searchLight);
        this.group.add(this.searchLightTarget);
        this.searchLight.target = this.searchLightTarget;

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
        this.verticalVelocity = 0;

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
        this.isWinchActive = false;
        this.winchState = 'STOWED';
        this.winchTimer = 0;
        this.currentFrame = 5;
        this.verticalVelocity = 0;
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
        this.searchLight.intensity = 0;
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
        this.verticalVelocity = 0;
        this.searchLight.intensity = 0;
        if (this.shadowMesh) this.shadowMesh.visible = false;
        if (this.dropLine) this.dropLine.visible = false;
        
        if (isOceanCrash) {
            this.audioManager.playSplash();
        } else {
            this.audioManager.playExplosion();
        }

        this.crashHandler.deploy(this.group.position);
    }

    setWinchMode(isWinchActive) {
        if (this.hasCrashed || this.engineState !== 'RUNNING') return;

        if (isWinchActive) {
            if (this.winchState === 'STOWED') {
                this.isWinchActive = true;
                this.winchState = 'DESCENDING';
                this.targetAltitude = 12.0;
            }
        }
    }

    startRetraction() {
        if (this.hasCrashed || this.engineState !== 'RUNNING') return;
        if (this.winchState === 'DEPLOYED') {
            this.winchState = 'RAISING';
            this.targetAltitude = 12.0;
            this.isMoving = false;
            this.targetPosition.copy(this.group.position);
        }
    }

    finishRetraction() {
        if (this.winchState === 'RAISING') {
            this.winchState = 'CLIMBING';
            this.targetAltitude = 32.0;
        }
    }

    shutdownEngine() {
        if (this.hasCrashed || this.engineState !== 'RUNNING') return;

        const padCenter = new THREE.Vector2(0, 0);
        const pos2D = new THREE.Vector2(this.group.position.x, this.group.position.z);
        const isOverOcean = pos2D.distanceTo(padCenter) > 10.0;

        this.engineState = 'SHUTTING_DOWN';
        this.targetPosition.copy(this.group.position);
        this.isMoving = false;

        this.audioManager.playShutdown(() => {
            this.audioManager.stopRotor();
        }, () => {
            if (this.engineState === 'SHUTTING_DOWN') {
                this.engineState = 'OFF';
            }
        });

        this.targetAltitude = isOverOcean ? 0.0 : 6.0; 
    }

    handleEngineKey() {
        if (this.hasCrashed) return;

        if (this.engineState === 'OFF') {
            this.engineState = 'STARTING';
            this.targetPosition.copy(this.group.position);
            this.isMoving = false;
            this.flightStarted = true;
            
            this.audioManager.playStartup(() => {
                if (this.engineState === 'STARTING') {
                    this.audioManager.startRotor();
                }
            }, () => {
                if (this.engineState === 'STARTING') {
                    this.engineState = 'RUNNING';
                    this.targetAltitude = this.isWinchActive ? 12.0 : 32.0; 
                }
            });
        } else if (this.engineState === 'RUNNING') {
            this.shutdownEngine();
        }
    }

    setTarget(newPos) {
        // Prevent movement controls strictly during LOWERING or RAISING winch operations
        if (this.winchState === 'LOWERING' || this.winchState === 'RAISING') {
            return;
        }

        const currentTargetAlt = (this.winchState === 'STOWED' || this.winchState === 'CLIMBING') ? 32.0 : 12.0;
        if (this.hasCrashed || this.engineState !== 'RUNNING' || Math.abs(this.group.position.y - currentTargetAlt) > 15.0) {
            return;
        }

        const padCenter = new THREE.Vector2(0, 0);
        const clickPos2D = new THREE.Vector2(newPos.x, newPos.z);
        
        const snapThreshold = 8.0;
        if (clickPos2D.distanceTo(padCenter) < snapThreshold) {
            this.targetPosition.set(0, currentTargetAlt, 0);
        } else {
            this.targetPosition.copy(newPos);
            this.targetPosition.y = currentTargetAlt; 
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

    update(delta, nightFactor = 0.0, windForce = new THREE.Vector3()) {
        if (this.hasCrashed) return;

        this.searchLight.intensity = (this.engineState === 'RUNNING') ? (nightFactor * 65.0) : 0.0;

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

        // Handle Winch State Machine Transitions & Timers
        if (this.winchState === 'DESCENDING') {
            this.targetAltitude = 12.0;
            if (Math.abs(this.group.position.y - 12.0) < 1.0) {
                this.winchState = 'LOWERING';
                this.winchTimer = 1.5; // duration to lower winch
                this.isMoving = false;
                this.targetPosition.copy(this.group.position);
            }
        } else if (this.winchState === 'LOWERING') {
            this.targetAltitude = 12.0;
            this.isMoving = false;
            this.targetPosition.copy(this.group.position);
            this.winchTimer -= delta;
            if (this.winchTimer <= 0) {
                this.winchState = 'DEPLOYED'; // Winch lowered, player can move again freely at 50% speed
            }
        } else if (this.winchState === 'RAISING') {
            this.targetAltitude = 12.0;
            this.isMoving = false;
            this.targetPosition.copy(this.group.position);
            // Handled externally by WinchSystem calling finishRetraction() when cable is fully up
        } else if (this.winchState === 'CLIMBING') {
            this.targetAltitude = 32.0;
            if (Math.abs(this.group.position.y - 32.0) < 1.0) {
                this.isWinchActive = false;
                this.winchState = 'STOWED';
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
        
        const altitudeError = this.targetAltitude - currentPos.y;
        const verticalAccel = 2.5; 
        const verticalDamping = 3.0; 
        
        this.verticalVelocity += (altitudeError * verticalAccel - this.verticalVelocity * verticalDamping) * delta;
        currentPos.y += this.verticalVelocity * delta;

        if (this.engineState === 'RUNNING') {
            currentPos.x += windForce.x * delta * 0.15;
            currentPos.z += windForce.z * delta * 0.15;
        }

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

        const activeCruiseHeight = (this.winchState === 'STOWED' && !this.isWinchActive) ? 32.0 : (this.winchState === 'CLIMBING' ? 32.0 : 12.0);
        if (this.engineState !== 'RUNNING' || (Math.abs(currentPos.y - activeCruiseHeight) > 2.0 && this.winchState !== 'DESCENDING' && this.winchState !== 'CLIMBING')) {
            if (this.winchState !== 'LOWERING' && this.winchState !== 'RAISING') {
                this.targetPosition.x = currentPos.x;
                this.targetPosition.z = currentPos.z;
                this.isMoving = false;
            }
        }

        if (this.isMoving && this.engineState === 'RUNNING' && this.winchState !== 'LOWERING' && this.winchState !== 'RAISING') {
            const targetXZ = new THREE.Vector2(this.targetPosition.x, this.targetPosition.z);
            const currentXZ = new THREE.Vector2(currentPos.x, currentPos.z);
            const distance = currentXZ.distanceTo(targetXZ);

            if (distance > 0.3) {
                const isSlow = this.gearDown || (this.winchState === 'DEPLOYED');
                const speedMultiplier = isSlow ? 0.5 : 1.0;
                currentXZ.lerp(targetXZ, delta * 0.8 * speedMultiplier);
                
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