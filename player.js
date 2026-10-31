import * as THREE from 'three';
import { AudioManager } from './audioManager.js';
import { crash } from './crash.js';

// Sprite sheets are loaded once and shared by every helicopter (local and remote).
// Each helicopter gets its own clone so it can show its own frame; clones share the decoded image and GPU upload.
const sharedSheets = {};
function loadSharedSheet(url, onLoad, onError = () => {}) {
    if (!sharedSheets[url]) {
        sharedSheets[url] = new Promise((resolve, reject) => {
            new THREE.TextureLoader().load(url, resolve, undefined, reject);
        });
    }
    sharedSheets[url].then((tex) => onLoad(tex.clone()), onError);
}

export default class HelicopterPlayer {
    constructor(scene, options = {}) {
        this.scene = scene;
        // Remote helicopters are driven by game.js: they never crash and play sound through the local player's AudioManager
        this.isRemote = !!options.isRemote;
        this.group = new THREE.Group();
        scene.add(this.group);

        // Pre-allocated scratch vectors to prevent allocations in high-frequency update loops
        this._scratchVector2D_1 = new THREE.Vector2();
        this._scratchVector2D_2 = new THREE.Vector2();
        this._scratchVector2D_3 = new THREE.Vector2();
        this._scratchVector2D_moveDir = new THREE.Vector2();

        this.totalFrames = 16;

        const geometry = new THREE.PlaneGeometry(24, 24);
        
        this.material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.4,
            transparent: true,
            alphaTest: 0.5,
            depthWrite: true,
            side: THREE.DoubleSide,
            // Transparent + DoubleSide is otherwise drawn in two passes, flagging needsUpdate twice per frame
            forceSinglePass: true,
            emissive: 0xffffff,
            emissiveIntensity: 2.0
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
        this.group.add(this.mesh);

        this.rotorGroup = new THREE.Group();
        this.rotorGroup.position.set(0, 2.0, 0); 
        this.group.add(this.rotorGroup);

        const rotorGeo = new THREE.PlaneGeometry(8, 0.6);
        const rotorMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.5,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            forceSinglePass: true
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
        // The two-blade cross looks the same every 90 degrees. At 90 rad/s and 60 fps it turns ~86 degrees per
        // frame, which the eye reads as a slow, twitching backwards crawl (wagon-wheel effect). Capping the
        // visible turn per frame keeps it reading as a fast forward spin at any frame rate.
        this.maxRotorStep = 0.35;

        this.gearDown = true;
        this.isWinchActive = false;
        this.winchState = 'STOWED'; 
        this.winchTimer = 0;
        this.landingPadTarget = null;
        this.isTakingOff = false;

        this.searchLight = new THREE.SpotLight(0xffffee, 150.0, 300.0, Math.PI / 4, 0.5, 1.0);
        this.searchLight.position.set(0, -0.5, 0);
        
        this.searchLightTarget = new THREE.Object3D();
        this.scene.add(this.searchLightTarget);
        this.searchLight.target = this.searchLightTarget;

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

        // Landing aid: near a helipad the drop line ends on the pad surface (not at sea level, which in this
        // view sits far from the pad) and a ring marks the touchdown point. Colour says what pressing E does now:
        // green = lands on the pad, amber = inside the landing zone but gear is up, white = not inside yet.
        this.landingPads = [
            new THREE.Vector3(8.41, 19.81, -6.54),
            new THREE.Vector3(-10.28, 27.29, 3.74)
        ];
        this.landingZoneHalfSize = 6.0; // Same zone shutdownEngine() checks
        this.landingAidRange = 20.0;
        this.landingRingHideHeight = 10.0; // Ring disappears when closer than this above the pad
        if (!this.isRemote) {
            const ringGeo = new THREE.RingGeometry(1.2, 1.8, 32);
            ringGeo.rotateX(-Math.PI / 2);
            this.landingMarker = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.9,
                depthTest: false,
                depthWrite: false
            }));
            this.landingMarker.renderOrder = 10;
            this.landingMarker.visible = false;
            this.scene.add(this.landingMarker);
        }

        // Southeast (SE) is 135 degrees clockwise from North, which corresponds to index 6 (2 * 22.5° + 4 * 22.5° = 135°)
        this.currentFrame = 6;

        loadSharedSheet('helicopter_gear.png', (tex) => {
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
        });

        loadSharedSheet('helicopter.png', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(1 / this.totalFrames, 1);
            tex.offset.x = this.currentFrame * (1 / this.totalFrames);

            this.gearUpTex = tex; 
        });

        loadSharedSheet('helicopter_emissive.png', (tex) => {
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
        }, () => {});

        this.group.position.set(8.41, 19.81, -6.54);
        this.targetPosition = new THREE.Vector3(8.41, 19.81, -6.54);
        this.maxSpeed = 37.5;
        this.currentSpeed = 0;
        this.isMoving = false;

        // Momentum: direction of travel is kept between frames, so turns at speed are arcs, not snaps
        this.moveHeading = new THREE.Vector2(0, -1);
        this.acceleration = 40.0;      // speed up / brake rate at empty weight
        this.turnAcceleration = 40.0;  // sideways rate at empty weight (arc radius = speed^2 / this)
        this.maxTurnRate = 6.0;        // radians per second, when nearly hovering
        this.fuelWeight = 0.3;         // full tank, as a share of the empty helicopter
        this.waterWeight = 1.2;        // full bucket, as a share of the empty helicopter
        this.loadSpeedLoss = 0.1;      // top speed lost per extra helicopter-weight (15% at full load)

        this.engineState = 'OFF'; 
        this.targetAltitude = 19.81;  
        this.verticalVelocity = 0;

        this.audioManager = options.audioManager || new AudioManager();

        if (!this.isRemote) {
            this.crashHandler = new crash(scene);
            this.crashHandler.hideRestart();
            this.crashHandler.showRestart(() => {
                this.resetFlight();
            });
            this.crashHandler.hideRestart();
        }

        this.hasCrashed = false;
        this.flightStarted = false;
    }

    setVisibility(visible) {
        if (this.group) {
            this.group.visible = visible;
            if (this.shadowMesh) this.shadowMesh.visible = visible;
            if (this.dropLine) this.dropLine.visible = visible;
            if (this.landingMarker && !visible) this.landingMarker.visible = false;
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
        this.currentFrame = 6; // SE on reset
        this.verticalVelocity = 0;
        this.currentSpeed = 0;
        this.landingPadTarget = null;
        this.isTakingOff = false;

        if (this.helicopterSystems) {
            this.helicopterSystems.fuel = this.helicopterSystems.maxFuel;
            this.helicopterSystems.water = this.helicopterSystems.maxWater;
            this.helicopterSystems.lowFuelTriggered = false;
        }

        if (this.gearDownTex && this.material) {
            this.material.map = this.gearDownTex;
            this.material.map.offset.x = 6 * (1 / this.totalFrames);
            this.material.needsUpdate = true;
        }
        if (this.emissiveTex && this.material) {
            this.material.emissiveMap.offset.x = 6 * (1 / this.totalFrames);
            this.material.needsUpdate = true;
        }
        this.group.position.set(8.41, 19.81, -6.54);
        this.targetPosition.set(8.41, 19.81, -6.54);
        this.targetAltitude = 19.81;
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
        if (this.landingMarker) this.landingMarker.visible = false;
        this.isMoving = false;
        this.currentSpeed = 0;
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
        if (this.hasCrashed || this.engineState !== 'RUNNING' || this.isTakingOff) return;

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
            this.currentSpeed = 0;
            this.targetPosition.copy(this.group.position);
        }
    }

    finishRetraction() {
        if (this.winchState === 'RAISING') {
            this.winchState = 'CLIMBING';
            this.targetAltitude = 45.0;
        }
    }

    isInside3DBox(pos) {
        const pad1X = 8.41, pad1Z = -6.54, pad1Y = 19.81;
        const pad2X = -10.28, pad2Z = 3.74, pad2Y = 27.29;
        const halfSize = 4.0; 
        const boxHeight = 6.0;

        const inPad1 = Math.abs(pos.x - pad1X) <= halfSize && Math.abs(pos.z - pad1Z) <= halfSize && pos.y >= pad1Y && pos.y <= pad1Y + boxHeight;
        const inPad2 = Math.abs(pos.x - pad2X) <= halfSize && Math.abs(pos.z - pad2Z) <= halfSize && pos.y >= pad2Y && pos.y <= pad2Y + boxHeight;
        
        return { inPad1, inPad2, isInside: inPad1 || inPad2 };
    }

    shutdownEngine() {
        if (this.hasCrashed || this.engineState !== 'RUNNING' || this.isTakingOff) return;

        const pad1X = 8.41, pad1Z = -6.54;
        const pad2X = -10.28, pad2Z = 3.74;
        const halfSize = 6.0; 
        const pos2D = this._scratchVector2D_1.set(this.group.position.x, this.group.position.z);

        const inPad1 = Math.abs(pos2D.x - pad1X) <= halfSize && Math.abs(pos2D.y - pad1Z) <= halfSize;
        const inPad2 = Math.abs(pos2D.x - pad2X) <= halfSize && Math.abs(pos2D.y - pad2Z) <= halfSize;

        this.engineState = 'SHUTTING_DOWN';
        this.isMoving = false;
        this.currentSpeed = 0;

        if ((inPad1 || inPad2) && this.gearDown) {
            this.landingPadTarget = inPad1 ? new THREE.Vector3(pad1X, 19.81, pad1Z) : new THREE.Vector3(pad2X, 27.29, pad2Z);
            this.targetAltitude = 45.0; 
        } else {
            this.landingPadTarget = null;
            this.targetAltitude = 0.0;
        }

        this.audioManager.playShutdown(() => {
            this.audioManager.stopRotor();
        }, () => {
            if (this.engineState === 'SHUTTING_DOWN') {
                this.engineState = 'OFF';
                this.landingPadTarget = null;
                this.isTakingOff = false;
            }
        });
    }

    handleEngineKey() {
        if (this.hasCrashed) return;

        if (this.engineState === 'OFF') {
            this.engineState = 'STARTING';
            this.isMoving = false;
            this.currentSpeed = 0;
            this.flightStarted = true;
            this.isTakingOff = true;
            this.landingPadTarget = null;
            
            this.audioManager.playStartup(() => {
                if (this.engineState === 'STARTING') {
                    this.audioManager.startRotor();
                }
            }, () => {
                if (this.engineState === 'STARTING') {
                    this.engineState = 'RUNNING';
                    this.targetAltitude = 45.0;
                    this.targetPosition.copy(this.group.position);
                    this.targetPosition.y = 45.0;
                }
            });
        } else if (this.engineState === 'RUNNING') {
            this.shutdownEngine();
        }
    }

    setTarget(newPos) {
        if (this.hasCrashed || this.engineState !== 'RUNNING' || this.isTakingOff || this.engineState === 'SHUTTING_DOWN') {
            return;
        }
        if (this.winchState === 'LOWERING' || this.winchState === 'RAISING') {
            return;
        }

        this.targetPosition.copy(newPos);
        const clickPos2D = this._scratchVector2D_1.set(newPos.x, newPos.z);
        const isDestOverIsland = clickPos2D.length() < 50.0;
        const flightAlt = (this.winchState === 'STOWED') ? (isDestOverIsland ? 45.0 : 38.0) : 12.0;
        this.targetPosition.y = flightAlt;
        this.targetAltitude = flightAlt;
        this.isMoving = true;
    }

    toggleGear() {
        if (this.hasCrashed) return;

        if (this.winchState !== 'STOWED') {
            return;
        }

        const { isInside } = this.isInside3DBox(this.group.position);
        if (this.gearDown && (isInside || this.group.position.y < 35.0)) {
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

        this.searchLight.intensity = (this.engineState === 'RUNNING') ? Math.max(40.0, nightFactor * 150.0) : 0.0;

        const pos = this.group.position;
        const { inPad1, inPad2, isInside } = this.isInside3DBox(pos);
        const pos2D = this._scratchVector2D_1.set(pos.x, pos.z);
        const isOverOcean = pos2D.length() > 55.0;

        if (this.isTakingOff && this.engineState === 'RUNNING') {
            this.targetAltitude = 45.0;
            this.isMoving = false;
            this.currentSpeed = 0;
            if (Math.abs(pos.y - 45.0) < 1.0) {
                this.isTakingOff = false; 
            }
        }

        if (this.engineState === 'RUNNING' && this.winchState === 'STOWED' && !this.isMoving && !this.isTakingOff && this.engineState !== 'SHUTTING_DOWN') {
            const isOverIsland = pos2D.length() < 50.0;
            this.targetAltitude = isOverIsland ? 45.0 : 38.0;
        }

        if (this.flightStarted) {
            if (this.engineState === 'SHUTTING_DOWN' && !this.landingPadTarget) {
                if (pos.y <= 2.0) {
                    this.triggerCrash(isOverOcean);
                    return;
                }
            }

            if (isOverOcean && pos.y <= 2.0) {
                this.triggerCrash(true);
                return;
            }

            const minSafeAlt = (this.winchState !== 'STOWED') ? 8.0 : 15.0;
            if (!isInside && pos.y <= minSafeAlt && this.engineState === 'RUNNING' && this.engineState !== 'SHUTTING_DOWN') {
                this.triggerCrash(false);
                return;
            }

            if (this.engineState === 'SHUTTING_DOWN' && this.landingPadTarget) {
                const targetPadY = this.landingPadTarget.y;
                if (Math.abs(pos.y - targetPadY) < 0.8) {
                    if (!this.gearDown) {
                        this.triggerCrash(false);
                        return;
                    }
                }
            }
        }

        if (this.winchState === 'DESCENDING') {
            this.targetAltitude = 12.0;
            if (Math.abs(this.group.position.y - 12.0) < 1.0) {
                this.winchState = 'LOWERING';
                this.winchTimer = 1.5; 
                this.isMoving = false;
                this.currentSpeed = 0;
                this.targetPosition.copy(this.group.position);
            }
        } else if (this.winchState === 'LOWERING') {
            this.targetAltitude = 12.0;
            this.isMoving = false;
            this.currentSpeed = 0;
            this.targetPosition.copy(this.group.position);
            this.winchTimer -= delta;
            if (this.winchTimer <= 0) {
                this.winchState = 'DEPLOYED'; 
            }
        } else if (this.winchState === 'RAISING') {
            this.targetAltitude = 12.0;
            this.isMoving = false;
            this.currentSpeed = 0;
            this.targetPosition.copy(this.group.position);
        } else if (this.winchState === 'CLIMBING') {
            this.targetAltitude = 45.0;
            if (Math.abs(this.group.position.y - 45.0) < 1.0) {
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
            blade.rotation.z += Math.min(this.rotorSpeed * delta, this.maxRotorStep);
        }

        const currentPos = this.group.position;
        
        const altitudeError = this.targetAltitude - currentPos.y;
        const verticalAccel = 2.5; 
        const verticalDamping = 3.0; 
        
        this.verticalVelocity += (altitudeError * verticalAccel - this.verticalVelocity * verticalDamping) * delta;
        currentPos.y += this.verticalVelocity * delta;

        if (this.engineState === 'SHUTTING_DOWN' && this.landingPadTarget) {
            const padXZ = this._scratchVector2D_2.set(this.landingPadTarget.x, this.landingPadTarget.z);
            const currentXZ = this._scratchVector2D_3.set(currentPos.x, currentPos.z);
            const dist = currentXZ.distanceTo(padXZ);

            if (dist > 0.4) {
                this.targetAltitude = 45.0; 
                currentXZ.lerp(padXZ, delta * 4.0);
                currentPos.x = currentXZ.x;
                currentPos.z = currentXZ.y;
            } else {
                currentPos.x = this.landingPadTarget.x;
                currentPos.z = this.landingPadTarget.z;
                this.targetAltitude = this.landingPadTarget.y;
            }
        }

        if (this.engineState === 'RUNNING' && this.engineState !== 'SHUTTING_DOWN' && !this.isTakingOff) {
            currentPos.x += windForce.x * delta * 0.15;
            currentPos.z += windForce.z * delta * 0.15;
        }

        if (this.shadowMesh && this.dropLine) {
            this.shadowMesh.position.set(currentPos.x, 0.2, currentPos.z);
            
            const heightFactor = Math.max(0.4, 1.0 - (currentPos.y / 60.0));
            this.shadowMesh.scale.set(heightFactor, heightFactor, heightFactor);

            // Nearest helipad by the same square distance the landing zone uses
            let nearPad = null;
            let padDist = Infinity;
            for (const pad of this.landingPads) {
                const dist = Math.max(Math.abs(currentPos.x - pad.x), Math.abs(currentPos.z - pad.z));
                if (dist < padDist && dist <= this.landingAidRange && currentPos.y > pad.y) {
                    nearPad = pad;
                    padDist = dist;
                }
            }

            const lineMat = this.dropLine.material;
            let lineBottomY = 0.2;
            if (nearPad && this.engineState !== 'OFF') {
                const inZone = padDist <= this.landingZoneHalfSize;
                const aidColor = inZone ? (this.gearDown ? 0x22c55e : 0xf59e0b) : 0xffffff;
                lineBottomY = nearPad.y;
                lineMat.color.setHex(aidColor);
                lineMat.opacity = 0.95;
                lineMat.dashSize = 0.6;
                lineMat.gapSize = 0.3;
                if (this.landingMarker) {
                    this.landingMarker.position.set(currentPos.x, nearPad.y + 0.05, currentPos.z);
                    this.landingMarker.material.color.setHex(aidColor);
                    // Hide the ring in the last stretch above the pad (final descent, or just lifted off)
                    this.landingMarker.visible = currentPos.y - nearPad.y > this.landingRingHideHeight;
                }
            } else {
                lineMat.color.setHex(0xffffff);
                lineMat.opacity = 0.25;
                lineMat.dashSize = 0.2;
                lineMat.gapSize = 0.6;
                if (this.landingMarker) this.landingMarker.visible = false;
            }

            const positions = this.dropLine.geometry.attributes.position.array;
            positions[0] = currentPos.x;
            positions[1] = lineBottomY;
            positions[2] = currentPos.z;

            positions[3] = currentPos.x;
            positions[4] = currentPos.y;
            positions[5] = currentPos.z;

            this.dropLine.geometry.attributes.position.needsUpdate = true;
            this.dropLine.computeLineDistances();
        }

        if (this.isMoving && this.engineState === 'RUNNING' && !this.isTakingOff && this.winchState !== 'LOWERING' && this.winchState !== 'RAISING') {
            const targetXZ = this._scratchVector2D_2.set(this.targetPosition.x, this.targetPosition.z);
            const currentXZ = this._scratchVector2D_3.set(currentPos.x, currentPos.z);
            const distance = currentXZ.distanceTo(targetXZ);

            if (distance > 0.2) {
                const isSlow = this.gearDown || (this.winchState === 'DEPLOYED');
                const load = this.getLoadFactor();
                const loadedMaxSpeed = this.maxSpeed * (1.0 - this.loadSpeedLoss * (load - 1.0));
                const targetMaxSpeed = isSlow ? loadedMaxSpeed * 0.5 : loadedMaxSpeed;
                const accel = this.acceleration / load;

                const moveDir = this._scratchVector2D_moveDir.subVectors(targetXZ, currentXZ).normalize();
                const heading = this.moveHeading;

                // Nearly hovering: can set off in any direction. At speed: turn rate limited by sideways grip, so it carves an arc
                if (this.currentSpeed < 1.0) {
                    heading.copy(moveDir);
                } else {
                    const turnAngle = Math.atan2(heading.x * moveDir.y - heading.y * moveDir.x, heading.dot(moveDir));
                    const maxTurn = Math.min(this.maxTurnRate, (this.turnAcceleration / load) / this.currentSpeed) * delta;
                    heading.rotateAround(this._scratchVector2D_1.set(0, 0), THREE.MathUtils.clamp(turnAngle, -maxTurn, maxTurn));
                }

                // Brake in time to stop at the target, and slow down when the target is off the nose (full stop if behind)
                const offNose = Math.atan2(heading.x * moveDir.y - heading.y * moveDir.x, heading.dot(moveDir));
                let desiredSpeed = Math.min(targetMaxSpeed, Math.sqrt(2.0 * accel * 0.8 * distance));
                desiredSpeed = Math.max(desiredSpeed, 2.0) * Math.max(0, Math.cos(offNose));

                const speedChange = THREE.MathUtils.clamp(desiredSpeed - this.currentSpeed, -accel * delta, accel * delta);
                this.currentSpeed += speedChange;

                const step = this.currentSpeed * delta;

                if (distance < step && Math.cos(offNose) > 0.9) {
                    currentXZ.copy(targetXZ);
                    this.currentSpeed = 0;
                } else {
                    currentXZ.addScaledVector(heading, step);
                }

                currentPos.x = currentXZ.x;
                currentPos.z = currentXZ.y;

                // Calculate angle clockwise from North where Index 2 = North (0 radians); sprite follows direction of travel
                const angle = Math.atan2(heading.x, -heading.y);
                const stepSize = (Math.PI * 2) / this.totalFrames;

                // Only change sprite frame once the heading is clearly past the edge of the current frame's sector
                // (dead zone, so wind cannot flip it back and forth on the border), and not in the last 2 units
                // before the target, where the direction to the target swings around
                const frameAngle = (this.currentFrame - 2) * stepSize;
                const angleDiff = Math.atan2(Math.sin(angle - frameAngle), Math.cos(angle - frameAngle));
                if (distance > 2.0 && Math.abs(angleDiff) > stepSize * 0.65) {
                    const steps = Math.round(angle / stepSize);
                    const frameIndex = (2 + steps) % this.totalFrames;
                    this.currentFrame = (frameIndex + this.totalFrames) % this.totalFrames;

                    const frameOffset = this.currentFrame * (1 / this.totalFrames);
                    if (this.material.map) {
                        this.material.map.offset.x = frameOffset;
                    }
                    if (this.material.emissiveMap) {
                        this.material.emissiveMap.offset.x = frameOffset;
                    }
                }
            } else {
                this.isMoving = false;
                this.currentSpeed = 0;
            }
        } else {
            this.currentSpeed = 0;
        }

        const headingAngle = ((this.currentFrame - 2) / this.totalFrames) * (Math.PI * 2);
        const forwardDist = 5.0;
        const targetX = currentPos.x + Math.sin(headingAngle) * forwardDist;
        const targetZ = currentPos.z - Math.cos(headingAngle) * forwardDist;
        const targetY = currentPos.y - 5.5;
        
        this.searchLightTarget.position.set(targetX, targetY, targetZ);
    }

    // Empty helicopter = 1.0; fuel and water add to it. Remote helicopters have no systems and stay at 1.0
    getLoadFactor() {
        const systems = this.helicopterSystems;
        if (!systems) return 1.0;
        return 1.0 + this.fuelWeight * (systems.fuel / systems.maxFuel) + this.waterWeight * (systems.water / systems.maxWater);
    }

    getPosition() {
        return this.group.position;
    }
}