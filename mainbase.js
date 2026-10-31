import * as THREE from 'three';

export class MainBase {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        this.group = new THREE.Group();
        this.group.position.set(0, 20, 0); 
        scene.add(this.group);

        this.baseTexture = new THREE.Texture();
        this.snowTexture = new THREE.Texture();
        this.rainTexture = new THREE.Texture();

        this.basePixelData = null;
        this.snowPixelData = null;
        this.rainPixelData = null;
        this.texWidth = 512;
        this.texHeight = 512;

        this.loadTextureWithPixelData('mainbase.webp', (tex, data, w, h) => {
            this.baseTexture = tex;
            this.basePixelData = data;
            this.texWidth = w;
            this.texHeight = h;
            if (this.material.map === this.baseTexture || !this.material.map) {
                this.material.map = this.baseTexture;
                this.material.needsUpdate = true;
            }
        });

        this.loadTextureWithPixelData('mainbase_snow.webp', (tex, data, w, h) => {
            this.snowTexture = tex;
            this.snowPixelData = data;
        });

        this.loadTextureWithPixelData('mainbase_rain.webp', (tex, data, w, h) => {
            this.rainTexture = tex;
            this.rainPixelData = data;
        });

        this.material = new THREE.MeshStandardMaterial({
            map: this.baseTexture,
            transparent: true,
            depthTest: true, 
            depthWrite: false,
            roughness: 0.4
        });

        const baseGeometry = new THREE.PlaneGeometry(72, 72);
        this.mesh = new THREE.Mesh(baseGeometry, this.material);
        this.mesh.renderOrder = 0;
        this.group.add(this.mesh);

        // --- 3D Landing Area Safe Zone Boxes (Invisible Collision/Landing Volumes) ---
        const boxHeight = 6.0;
        const padBoxGeo = new THREE.BoxGeometry(8.0, boxHeight, 8.0);
        const padBoxMat = new THREE.MeshBasicMaterial({
            color: 0x00ffcc,
            wireframe: true,
            transparent: true,
            opacity: 0.0,
            visible: false
        });

        const pad1Mesh = new THREE.Mesh(padBoxGeo, padBoxMat);
        pad1Mesh.position.set(8.41, (19.81 - 20) + (boxHeight / 2), -6.54);
        this.group.add(pad1Mesh);

        const pad2Mesh = new THREE.Mesh(padBoxGeo, padBoxMat);
        pad2Mesh.position.set(-10.28, (27.29 - 20) + (boxHeight / 2), 3.74);
        this.group.add(pad2Mesh);

        this.foamParams = {
            particlesCount: 1200,
            offsetX: -1.5,
            offsetZ: -1.5,
            posY: -8.7,
            rotX: -37,
            rotY: -3,
            rotZ: 50,
            waveSpeed: 0.2,
            waveAmplitude: 1.8,
            particleSize: 27,
            opacity: 0.5
        };

        this.lineSegments = [
            { x: 29, y: -14, rotation: 54, length: 16, count: 70 },
            { x: 5, y: -25, rotation: 158, length: 14, count: 70 },
            { x: -10, y: 31.5, rotation: 2, length: 13, count: 50 },
            { x: -19.5, y: 10.5, rotation: 85, length: 38, count: 180 },
            { x: -17, y: -11.5, rotation: 144, length: 11.5, count: 40 }
        ];

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
            depthTest: true,
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
                { x: 9.21, y: -2.63, z: 2, scale: 0.15 },
                { x: 12.26, y: 1.19, z: 2, scale: 0.15 },
                { x: 7.52, y: 0.56, z: 2, scale: 0.15 },
                { x: 14.0, y: -1.71, z: 2, scale: 0.15 },
                { x: -11.81, y: 6.49, z: 2, scale: 0.15 },
                { x: -12.71, y: 9.1, z: 2, scale: 0.15 },
                { x: -7.44, y: 7.03, z: 2, scale: 0.15 },
                { x: -8.18, y: 9.53, z: 2, scale: 0.15 },
                { x: 29.95, y: -10.27, z: 2, scale: 0.1, flashing: false },
            ],
            red: [
                { x: 13.34, y: -6.22, z: 2, scale: 0.15 },
                { x: 18.45, y: 0.05, z: 2, scale: 0.15 },
                { x: 2.37, y: -1.55, z: 2, scale: 0.15 },
                { x: 8.29, y: 4.18, z: 2, scale: 0.15 },
                { x: -8.69, y: 3.51, z: 2, scale: 0.15 },
                { x: -11.19, y: 11.92, z: 2, scale: 0.15 },
                { x: -17.8, y: 7.27, z: 2, scale: 0.15 },
                { x: -2.75, y: 8.55, z: 2, scale: 0.15 },
                { x: 9.13, y: 20.43, z: 2, scale: 0.14, flashing: true, flashInterval: 0.9 },
                { x: 2.93, y: 21.27, z: 2, scale: 0.1, flashing: false },
                { x: 26.1, y: -11.7, z: 2, scale: 0.1, flashing: false },
            ],
            amber: [
                { x: 3.3, y: 6.3, z: 2, scale: 0.1, flashing: false },
                { x: 0.38, y: 3.79, z: 2, scale: 0.1, flashing: false },
                { x: -3.0, y: 0.6, z: 2, scale: 0.1, flashing: false },
            ],
            white: [
                { x: 23.75, y: 1.31, z: 2.0, scale: 0.1, flashing: false },
                { x: 3.25, y: -5.86, z: 2, scale: 0.1, flashing: false },
                { x: -0.54, y: -6.75, z: 2, scale: 0.1, flashing: false },
                { x: -11.99, y: 0, z: 2, scale: 0.1, flashing: false },
                { x: -19.41, y: 3.64, z: 2, scale: 0.1, flashing: false },
                { x: -6.15, y: 1.4, z: 2, scale: 0.1, flashing: false },
                { x: 25.89, y: -2.22, z: 2, scale: 0.1, flashing: false },
                { x: 30.99, y: -4.23, z: 2, scale: 0.1, flashing: false },
                { x: 29.67, y: -7.01, z: 2, scale: 0.1, flashing: false },
                { x: 32.74, y: -3.87, z: 2, scale: 0.1, flashing: false },
                { x: 31.65, y: -7.74, z: 2, scale: 0.1, flashing: false },
                { x: 13.64, y: -8.4, z: 2, scale: 0.1, flashing: false },
                { x: 20.1, y: -0.3, z: 2, scale: 0.1, flashing: false },
                { x: -21.42, y: 8.76, z: 2, scale: 0.1, flashing: false },
                { x: -8.03, y: 14.08, z: 2, scale: 0.1, flashing: false },
                { x: -1.08, y: 15.54, z: 2, scale: 0.1, flashing: false },
                { x: 2.7, y: 10.5, z: 2, scale: 0.1, flashing: false },
                { x: 0.96, y: 11.09, z: 2, scale: 0.1, flashing: false },
                { x: 4.58, y: 10.01, z: 2, scale: 0.1, flashing: false },
                { x: 10.62, y: 7.55, z: 2, scale: 0.1, flashing: false },
                { x: 11.22, y: 12.28, z: 2, scale: 0.1, flashing: false },
                { x: 15.3, y: 10.8, z: 2, scale: 0.1, flashing: false },
                { x: 17.86, y: 4.28, z: 2, scale: 0.1, flashing: false },
                { x: -8.4, y: -5.1, z: 4, scale: 0, flashing: false },
            ]
        };

        this.allLights = [];
        this.buildLightGroup('green', 0x00ff66);
        this.buildLightGroup('red', 0xff0033);
        this.buildLightGroup('amber', 0xffaa00);
        this.buildLightGroup('white', 0xffffff);
    }

    loadTextureWithPixelData(url, callback) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;

            if (callback) callback(texture, imgData, img.width, img.height);
        };
        img.onerror = () => {
            const texture = new THREE.TextureLoader().load(url);
            if (callback) callback(texture, null, 512, 512);
        };
    }

    isOpaqueAtWorldPosition(worldPos) {
        let pixelData = this.basePixelData;
        if (this.material.map === this.snowTexture && this.snowPixelData) {
            pixelData = this.snowPixelData;
        } else if (this.material.map === this.rainTexture && this.rainPixelData) {
            pixelData = this.rainPixelData;
        }

        if (!pixelData) {
            const dx = worldPos.x;
            const dz = worldPos.z;
            return (dx * dx + dz * dz) < (28.0 * 28.0);
        }

        const localPos = worldPos.clone();
        this.group.worldToLocal(localPos);

        const halfSize = 36.0;
        if (localPos.x < -halfSize || localPos.x > halfSize || localPos.z < -halfSize || localPos.z > halfSize) {
            return false;
        }

        const u = (localPos.x + halfSize) / (halfSize * 2);
        const v = 1.0 - (localPos.z + halfSize) / (halfSize * 2);

        const px = Math.floor(u * this.texWidth);
        const py = Math.floor(v * this.texHeight);

        if (px < 0 || px >= this.texWidth || py < 0 || py >= this.texHeight) {
            return false;
        }

        const index = (py * this.texWidth + px) * 4 + 3;
        const alpha = pixelData.data[index];

        return alpha > 40;
    }

    buildLightGroup(category, colorHex) {
        if (!this.lightConfigs[category]) return;
        this.lightConfigs[category].forEach((pos, idx) => {
            const zVal = pos.z !== undefined ? pos.z : 0.2;
            const markerGeo = new THREE.SphereGeometry(1, 16, 16);
            const markerMat = new THREE.MeshBasicMaterial({ 
                color: colorHex, 
                depthTest: true, 
                depthWrite: true 
            });
            const marker = new THREE.Mesh(markerGeo, markerMat);
            marker.renderOrder = 1;
            marker.position.set(pos.x, pos.y, zVal);
            marker.scale.set(pos.scale, pos.scale, pos.scale);
            this.group.add(marker);

            const pointLight = new THREE.PointLight(colorHex, 0.0, 15);
            pointLight.position.set(pos.x, pos.y, zVal);
            this.group.add(pointLight);

            const lightObj = { category, index: idx, marker, pointLight, config: pos };
            if (pos.flashing) {
                lightObj.flashTimer = Math.random() * (pos.flashInterval || 0.5);
                lightObj.flashState = true;
            }
            this.allLights.push(lightObj);
        });
    }

    update(delta, nightFactor, cameraQuaternion, searchLightSystem = null, weather = '') {
        const weatherStr = (weather || window.weather || window.currentWeather || '').toString().toUpperCase();
        const hasSnow = weatherStr.includes('SNOW');
        const hasRain = weatherStr.includes('RAIN') || weatherStr.includes('STORM');
        const targetMap = hasSnow ? this.snowTexture : (hasRain ? this.rainTexture : this.baseTexture);
        if (this.material.map !== targetMap && targetMap.image) {
            this.material.map = targetMap;
            this.material.needsUpdate = true;
        }

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

        if (this.foamMaterial) {
            const baseOp = this.foamParams.opacity;
            this.foamMaterial.opacity = nightFactor > 0.5 ? baseOp * 0.4 : baseOp;
        }

        const elapsedTime = Date.now() * 0.001;

        let particleIdx = 0;

        for (let l = 0; l < this.lineSegments.length; l++) {
            const seg = this.lineSegments[l];
            const count = seg.count;
            const rad = THREE.MathUtils.degToRad(seg.rotation);
            const halfLen = seg.length / 2;

            const startX = seg.x - Math.cos(rad) * halfLen;
            const startY = seg.y - Math.sin(rad) * halfLen;
            const endX = seg.x + Math.cos(rad) * halfLen;
            const endY = seg.y + Math.sin(rad) * halfLen;

            for (let i = 0; i < count; i++) {
                if (particleIdx >= this.maxParticles) break;

                const idx = particleIdx * 3;
                const phase = this.foamOffsets[particleIdx];

                const t = count > 1 ? i / (count - 1) : 0.5;
                let x = startX + t * (endX - startX);
                let y = startY + t * (endY - startY);

                const wave = Math.sin(elapsedTime * this.foamParams.waveSpeed * 3.0 + phase) * this.foamParams.waveAmplitude;
                
                const dx = endX - startX;
                const dy = endY - startY;
                const len = Math.sqrt(dx * dx + dy * dy);

                if (len > 0.001) {
                    const nx = -dy / len;
                    const ny = dx / len;
                    x += nx * wave;
                    y += ny * wave;
                }

                const z = Math.sin(elapsedTime * 3.0 + particleIdx) * 0.08;

                this.foamPositions[idx] = x;
                this.foamPositions[idx + 1] = y;
                this.foamPositions[idx + 2] = z;

                particleIdx++;
            }
        }

        this.foamGeometry.setDrawRange(0, particleIdx);
        this.foamGeometry.attributes.position.needsUpdate = true;

        const intensityMultiplier = nightFactor * 3.0;
        this.allLights.forEach(item => {
            if (item.config.flashing) {
                item.flashTimer += delta;
                const interval = item.config.flashInterval || 0.5;
                if (item.flashTimer >= interval) {
                    item.flashState = !item.flashState;
                    item.flashTimer = 0;
                }
                const active = item.flashState && nightFactor > 0.1;
                item.pointLight.intensity = active ? intensityMultiplier * 1.5 : 0;
                item.marker.visible = item.flashState;
            } else {
                item.pointLight.intensity = intensityMultiplier;
            }
        });

        if (cameraQuaternion) {
            this.group.quaternion.copy(cameraQuaternion);
        }
    }
}