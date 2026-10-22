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

        // --- Exact Configured Foam Settings (Flat on XZ plane with correct rotation, offsets, and height) ---
        this.foamParams = {
            radius: 7.5,
            offsetX: -0.6,
            offsetZ: -1.0,
            posY: -2.9,
            rotX: -45.0,
            rotY: 0.0,
            rotZ: 0.0,
            speed: 0.2
        };

        this.particlesCount = 2400;
        this.foamGeometry = new THREE.BufferGeometry();
        this.foamPositions = new Float32Array(this.particlesCount * 3);
        this.foamAngles = new Float32Array(this.particlesCount);
        this.foamOffsets = new Float32Array(this.particlesCount);

        for (let i = 0; i < this.particlesCount; i++) {
            this.foamPositions[i * 3] = 0;
            this.foamPositions[i * 3 + 1] = 0;
            this.foamPositions[i * 3 + 2] = 0;
            this.foamAngles[i] = (i / this.particlesCount) * Math.PI * 2;
            this.foamOffsets[i] = Math.random() * Math.PI * 2;
        }

        this.foamGeometry.setAttribute('position', new THREE.BufferAttribute(this.foamPositions, 3));

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
            size: 10.0,
            map: foamTexture,
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false,
            opacity: 0.7
        });

        this.foamParticleSystem = new THREE.Points(this.foamGeometry, this.foamMaterial);
        this.foamParticleSystem.frustumCulled = false;
        this.foamParticleSystem.position.set(this.foamParams.offsetX, this.foamParams.posY, this.foamParams.offsetZ);
        this.foamParticleSystem.rotation.x = THREE.MathUtils.degToRad(this.foamParams.rotX);
        this.foamParticleSystem.rotation.y = THREE.MathUtils.degToRad(this.foamParams.rotY);
        this.foamParticleSystem.rotation.z = THREE.MathUtils.degToRad(this.foamParams.rotZ);
        this.group.add(this.foamParticleSystem);

        // --- Final Saved Light Layout Configurations ---
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

    update(nightFactor, cameraQuaternion) {
        this.material.color.setRGB(1 - nightFactor * 0.4, 1 - nightFactor * 0.4, 1 - nightFactor * 0.3);

        if (this.foamMaterial) {
            this.foamMaterial.opacity = nightFactor > 0.5 ? 0.25 : 0.7;
        }

        const elapsedTime = Date.now() * 0.001;

        for (let i = 0; i < this.particlesCount; i++) {
            const idx = i * 3;
            const angle = this.foamAngles[i];
            const phase = this.foamOffsets[i];

            const surge = Math.sin(elapsedTime * this.foamParams.speed + phase) * 0.8;
            const currentRadius = this.foamParams.radius + surge;

            const x = Math.cos(angle) * currentRadius;
            const y = Math.sin(angle) * currentRadius;
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