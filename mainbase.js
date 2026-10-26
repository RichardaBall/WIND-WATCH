import * as THREE from 'three';

export class MainBase {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        this.group = new THREE.Group();
        this.group.position.set(0, 5, 0);
        scene.add(this.group);

        const textureLoader = new THREE.TextureLoader();
        const baseTexture = textureLoader.load('mainbase.png', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
        });

        this.material = new THREE.MeshStandardMaterial({
            map: baseTexture,
            transparent: true,
            alphaTest: 0.5,
            roughness: 0.4
        });

        const baseGeometry = new THREE.PlaneGeometry(24, 24);
        this.mesh = new THREE.Mesh(baseGeometry, this.material);
        this.group.add(this.mesh);

        // --- Rescued Survivor Waving Setup ---
        this.totalFrames = 43;
        this.currentFrame = 0;
        this.lastFrameTime = 0;
        this.fadeTimer = 0;
        this.hasFadedOut = false;

        this.rescuedSurvivorMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.4,
            transparent: true,
            opacity: 1.0,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        textureLoader.load('raft_survivor_1_waving.png', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(1 / this.totalFrames, 1);
            tex.offset.x = 0;

            this.rescuedSurvivorMat.map = tex;
            this.rescuedSurvivorMat.needsUpdate = true;
            this.rescuedSurvivorTexture = tex;
        }, undefined, (err) => {
            console.error('Error loading raft_survivor_1_waving.png:', err);
        });

        const survivorGeo = new THREE.PlaneGeometry(3, 3);
        this.rescuedSurvivorMesh = new THREE.Mesh(survivorGeo, this.rescuedSurvivorMat);
        
        this.rescuedSurvivorMesh.position.set(-5.20, 1.90, 3.10);
        this.rescuedSurvivorMesh.scale.set(1.00, 1.00, 1.00);
        this.survivorRotationZ = -0.30;

        this.rescuedSurvivorMesh.visible = false; 
        this.group.add(this.rescuedSurvivorMesh);

        // --- Hardcoded Square Foam Settings ---
        this.foamParams = {
            width: 13.0,
            height: 13.0,
            cornerRadius: 2.0,
            particlesCount: 300,
            offsetX: -0.5,
            offsetZ: -0.5,
            posY: -2.9,
            rotX: -37.0,
            rotY: -3.0,
            rotZ: 50.0,
            waveSpeed: 0.2,
            waveAmplitude: 0.6,
            particleSize: 9.0,
            opacity: 0.5
        };

        this.maxParticles = 8000;
        this.foamGeometry = new THREE.BufferGeometry();
        this.foamPositions = new Float32Array(this.maxParticles * 3);
        this.foamOffsets = new Float32Array(this.maxParticles);

        for (let i = 0; i < this.maxParticles; i++) {
            this.foamPositions[i * 3] = 0;
            this.foamPositions[i * 3 + 1] = 0;
            this.foamPositions[i * 3 + 2] = 0;
            this.foamOffsets[i] = Math.random() * Math.PI * 2;
        }

        this.foamGeometry.setAttribute('position', new THREE.BufferAttribute(this.foamPositions, 3));
        this.foamGeometry.setDrawRange(0, this.foamParams.particlesCount);

        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(0.4, 'rgba(240, 248, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        const foamTexture = new THREE.CanvasTexture(canvas);

        this.foamMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: this.foamParams.particleSize,
            map: foamTexture,
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false,
            opacity: this.foamParams.opacity
        });

        this.foamParticleSystem = new THREE.Points(this.foamGeometry, this.foamMaterial);
        this.foamParticleSystem.frustumCulled = false;
        this.foamParticleSystem.position.set(this.foamParams.offsetX, this.foamParams.posY, this.foamParams.offsetZ);
        this.foamParticleSystem.rotation.x = THREE.MathUtils.degToRad(this.foamParams.rotX);
        this.foamParticleSystem.rotation.y = THREE.MathUtils.degToRad(this.foamParams.rotY);
        this.foamParticleSystem.rotation.z = THREE.MathUtils.degToRad(this.foamParams.rotZ);
        this.group.add(this.foamParticleSystem);

        this.lightConfigs = {
            green: [
                { x: -2.1, y: -1.4, scale: 0.05 },
                { x: 2, y: -1.5, scale: 0.05 },
                { x: -1.7, y: 1.2, scale: 0.05 },
                { x: 2, y: 1.1, scale: 0.05 }
            ],
            red: [
                { x: 0, y: -5, scale: 0.05 },
                { x: 6, y: 0, scale: 0.05 },
                { x: -6, y: 0, scale: 0.05 },
                { x: 0, y: 3.2, scale: 0.05 },
                { x: -10.1, y: 12, scale: 0.05 },
                { x: -10.7, y: 11.2, scale: 0.05 }
            ],
            white: [
                { x: -5, y: 2.5, scale: 0 },
                { x: 3, y: 3.5, scale: 0 }
            ]
        };

        this.allLights = [];
        this.buildLightGroup('green', 0x00ff66);
        this.buildLightGroup('red', 0xff0033);
        this.buildLightGroup('white', 0xffffff);
    }

    resetFade() {
        this.fadeTimer = 0;
        this.hasFadedOut = false;
        if (this.rescuedSurvivorMesh) {
            this.rescuedSurvivorMesh.visible = false;
            this.rescuedSurvivorMat.opacity = 1.0;
        }
    }

    buildLightGroup(category, colorHex) {
        this.lightConfigs[category].forEach((pos, idx) => {
            const markerGeo = new THREE.SphereGeometry(1, 16, 16);
            const markerMat = new THREE.MeshBasicMaterial({ color: colorHex });
            const marker = new THREE.Mesh(markerGeo, markerMat);
            marker.position.set(pos.x, pos.y, 0.2);
            marker.scale.set(pos.scale, pos.scale, pos.scale);
            this.group.add(marker);

            const pointLight = new THREE.PointLight(colorHex, 0.0, 15);
            pointLight.position.set(pos.x, pos.y, 0.2);
            this.group.add(pointLight);

            this.allLights.push({ category, index: idx, marker, pointLight });
        });
    }

    update(delta, nightFactor, cameraQuaternion, searchLightSystem = null, showRescuedSurvivor = false) {
        let baseColorFactor = 1 - nightFactor * 0.4;
        let baseBlueFactor = 1 - nightFactor * 0.3;

        if (searchLightSystem && searchLightSystem.state !== 'OFF') {
            const lightPos = searchLightSystem.lightPoolMesh.position;
            const basePos = this.group.position;
            const dx = basePos.x - lightPos.x;
            const dz = basePos.z - lightPos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 10.0) {
                baseColorFactor = 1.0;
                baseBlueFactor = 1.0;
            }
        }

        this.material.color.setRGB(baseColorFactor, baseColorFactor, baseBlueFactor);

        if (this.rescuedSurvivorMesh) {
            if (showRescuedSurvivor && !this.hasFadedOut) {
                this.rescuedSurvivorMesh.visible = true;
                
                // Track time: Full visibility for 5 seconds, then fade out over 5 seconds
                this.fadeTimer += delta;
                if (this.fadeTimer <= 5.0) {
                    this.rescuedSurvivorMat.opacity = 1.0;
                } else {
                    const fadeElapsed = this.fadeTimer - 5.0;
                    const fadeProgress = Math.min(1.0, fadeElapsed / 5.0);
                    this.rescuedSurvivorMat.opacity = 1.0 - fadeProgress;

                    if (fadeElapsed >= 5.0) {
                        this.rescuedSurvivorMesh.visible = false;
                        this.hasFadedOut = true;
                        console.log("🏁 Liferaft mission completed: Rescued survivor fully faded out.");
                    }
                }

                const now = Date.now();
                if (now - this.lastFrameTime >= 1000 / 30) {
                    this.lastFrameTime = now;
                    this.currentFrame = (this.currentFrame + 1) % this.totalFrames;
                    if (this.rescuedSurvivorTexture) {
                        this.rescuedSurvivorTexture.offset.x = this.currentFrame * (1 / this.totalFrames);
                    }
                }

                let survivorColorFactor = baseColorFactor;
                if (searchLightSystem && searchLightSystem.state !== 'OFF') {
                    const lightPos = searchLightSystem.lightPoolMesh.position;
                    const basePos = this.group.position;
                    const dx = basePos.x - lightPos.x;
                    const dz = basePos.z - lightPos.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist < 10.0) {
                        survivorColorFactor = 1.0;
                    }
                }
                this.rescuedSurvivorMat.color.setRGB(survivorColorFactor, survivorColorFactor, survivorColorFactor);

                if (cameraQuaternion) {
                    this.rescuedSurvivorMesh.quaternion.copy(cameraQuaternion);
                    this.rescuedSurvivorMesh.rotateZ(this.survivorRotationZ);
                }
            } else if (!showRescuedSurvivor && !this.hasFadedOut) {
                this.rescuedSurvivorMesh.visible = false;
                this.fadeTimer = 0;
            }
        }

        if (this.foamMaterial) {
            const baseOp = this.foamParams.opacity;
            this.foamMaterial.opacity = nightFactor > 0.5 ? baseOp * 0.4 : baseOp;
        }

        const elapsedTime = Date.now() * 0.001;
        const count = this.foamParams.particlesCount;
        const w = Math.max(0.1, this.foamParams.width);
        const h = Math.max(0.1, this.foamParams.height);
        const r = Math.min(this.foamParams.cornerRadius, w / 2, h / 2);

        const getRoundedRectPoint = (t, out = new THREE.Vector2()) => {
            const hw = w / 2;
            const hh = h / 2;
            const sw = w - 2 * r;
            const sh = h - 2 * r;
            const cLen = (Math.PI * r) / 2;
            const totalLen = 2 * sw + 2 * sh + 4 * cLen;

            let d = (t % 1.0) * totalLen;
            if (d < 0) d += totalLen;

            if (d <= sw) return out.set(-hw + r + d, -hh);
            d -= sw;
            if (d <= cLen) {
                const ang = -Math.PI / 2 + (d / cLen) * (Math.PI / 2);
                return out.set(hw - r + r * Math.cos(ang), -hh + r + r * Math.sin(ang));
            }
            d -= cLen;
            if (d <= sh) return out.set(hw, -hh + r + d);
            d -= sh;
            if (d <= cLen) {
                const ang = 0 + (d / cLen) * (Math.PI / 2);
                return out.set(hw - r + r * Math.cos(ang), hh - r + r * Math.sin(ang));
            }
            d -= cLen;
            if (d <= sw) return out.set(hw - r - d, hh);
            d -= sw;
            if (d <= cLen) {
                const ang = Math.PI / 2 + (d / cLen) * (Math.PI / 2);
                return out.set(-hw + r + r * Math.cos(ang), hh - r + r * Math.sin(ang));
            }
            d -= cLen;
            if (d <= sh) return out.set(-hw, hh - r - d);
            d -= sh;
            const ang = Math.PI + (d / cLen) * (Math.PI / 2);
            return out.set(-hw + r + r * Math.cos(ang), -hh + r + r * Math.sin(ang));
        };

        const tempVec = new THREE.Vector2();

        for (let i = 0; i < count; i++) {
            const idx = i * 3;
            const phase = this.foamOffsets[i];

            const baseT = i / count;
            getRoundedRectPoint(baseT, tempVec);
            let x = tempVec.x;
            let y = tempVec.y;

            const wave = Math.sin(elapsedTime * this.foamParams.waveSpeed * 3.0 + phase) * this.foamParams.waveAmplitude;
            const len = Math.sqrt(x * x + y * y);
            if (len > 0.001) {
                x += (x / len) * wave;
                y += (y / len) * wave;
            }

            const z = Math.sin(elapsedTime * 3.0 + i) * 0.08;

            this.foamPositions[idx] = x;
            this.foamPositions[idx + 1] = y;
            this.foamPositions[idx + 2] = z;
        }

        this.foamGeometry.attributes.position.needsUpdate = true;

        const intensityMultiplier = nightFactor * 3.0;
        this.allLights.forEach(item => {
            item.pointLight.intensity = intensityMultiplier;
        });

        if (cameraQuaternion) {
            this.group.quaternion.copy(cameraQuaternion);
        }
    }
}