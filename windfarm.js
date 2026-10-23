import * as THREE from 'three';

export class WindFarm {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.turbines = [];

        // Turbine configuration values
        this.config = {
            speed: 2.3,
            length: 14.0,
            thickness: 0.6,
            hubX: -0.7,
            hubY: 20.8,
            hubZ: 0.8
        };

        // Hardcoded foam ring configuration
        this.foamConfig = {
            radius: 1.0,
            thickness: 2.0,
            count: 200,
            offsetX: 0.0,
            offsetY: 0.2,
            offsetZ: 0.0,
            rotX: -45.0,
            rotY: 0.0,
            rotZ: 0.0,
            speed: 0.2
        };

        // Hardcoded light configuration matching mainbase.js red light style[cite: 3]
        this.lightConfig = {
            x: 1.0,
            y: 22.2,
            z: 0.15,
            scale: 0.05
        };

        this.bodyMaterial = new THREE.MeshStandardMaterial({
            transparent: true,
            alphaTest: 0.1,
            roughness: 0.4,
            side: THREE.DoubleSide
        });

        this.loadTransparentTexture('WTG.png', (texture) => {
            this.bodyMaterial.map = texture;
            this.bodyMaterial.needsUpdate = true;
        });

        // Exactly 1 turbine positioned near the base for testing
        this.createTurbine(25, -25);
    }

    loadTransparentTexture(url, callback) {
        const img = new Image();
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;

            const bgR = data[0];
            const bgG = data[1];
            const bgB = data[2];

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                if (Math.abs(r - bgR) < 20 && Math.abs(g - bgG) < 20 && Math.abs(b - bgB) < 20) {
                    data[i + 3] = 0;
                }
            }

            ctx.putImageData(imgData, 0, 0);

            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;

            if (callback) callback(texture);
        };
    }

    createTurbine(x, z) {
        const turbineGroup = new THREE.Group();
        turbineGroup.position.set(x, 0, z);

        // 1. Turbine Static Body Mesh
        const bodyGeo = new THREE.PlaneGeometry(36, 36);
        const bodyMesh = new THREE.Mesh(bodyGeo, this.bodyMaterial);
        bodyMesh.position.set(0, 18, 0);
        turbineGroup.add(bodyMesh);

        // 2. Rotor Hub Group
        const rotorGroup = new THREE.Group();
        rotorGroup.position.set(this.config.hubX, this.config.hubY, this.config.hubZ);

        const bladeMat = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            roughness: 0.3,
            side: THREE.DoubleSide
        });

        for (let i = 0; i < 3; i++) {
            const bladeGeo = new THREE.PlaneGeometry(this.config.length, this.config.thickness);
            bladeGeo.translate(this.config.length / 2, 0, 0);
            const blade = new THREE.Mesh(bladeGeo, bladeMat);
            blade.rotation.z = i * ((Math.PI * 2) / 3);
            rotorGroup.add(blade);
        }

        turbineGroup.add(rotorGroup);

        // 3. Water Foam Ring Particle System
        const count = this.foamConfig.count;
        const foamGeometry = new THREE.BufferGeometry();
        const foamPositions = new Float32Array(count * 3);
        const foamAngles = new Float32Array(count);
        const foamOffsets = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            foamPositions[i * 3] = 0;
            foamPositions[i * 3 + 1] = 0;
            foamPositions[i * 3 + 2] = 0;
            foamAngles[i] = (i / count) * Math.PI * 2;
            foamOffsets[i] = Math.random() * Math.PI * 2;
        }

        foamGeometry.setAttribute('position', new THREE.BufferAttribute(foamPositions, 3));

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
        const foamMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: this.foamConfig.thickness,
            map: foamTexture,
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false,
            opacity: 0.7
        });

        const foamParticleSystem = new THREE.Points(foamGeometry, foamMaterial);
        foamParticleSystem.frustumCulled = false;
        foamParticleSystem.position.set(this.foamConfig.offsetX, this.foamConfig.offsetY, this.foamConfig.offsetZ);
        foamParticleSystem.rotation.x = THREE.MathUtils.degToRad(this.foamConfig.rotX);
        foamParticleSystem.rotation.y = THREE.MathUtils.degToRad(this.foamConfig.rotY);
        foamParticleSystem.rotation.z = THREE.MathUtils.degToRad(this.foamConfig.rotZ);
        turbineGroup.add(foamParticleSystem);

        // 4. Red Light Mesh (Exact match to MainBase style)[cite: 3]
        const markerGeo = new THREE.SphereGeometry(1, 16, 16);
        const markerMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
        const lightMarker = new THREE.Mesh(markerGeo, markerMat);
        lightMarker.position.set(this.lightConfig.x, this.lightConfig.y, this.lightConfig.z);
        lightMarker.scale.set(this.lightConfig.scale, this.lightConfig.scale, this.lightConfig.scale);
        turbineGroup.add(lightMarker);

        const pointLight = new THREE.PointLight(0xff0033, 1.5, 15);
        pointLight.position.set(this.lightConfig.x, this.lightConfig.y, this.lightConfig.z);
        turbineGroup.add(pointLight);

        this.group.add(turbineGroup);

        this.turbines.push({
            group: turbineGroup,
            rotor: rotorGroup,
            spinSpeed: this.config.speed,
            foamGeometry: foamGeometry,
            foamPositions: foamPositions,
            foamAngles: foamAngles,
            foamOffsets: foamOffsets,
            pointLight: pointLight
        });
    }

    update(delta, cameraQuaternion) {
        for (const turbine of this.turbines) {
            const elapsedTime = Date.now() * 0.001;

            turbine.rotor.rotation.z += this.config.speed * delta;

            for (let i = 0; i < turbine.foamAngles.length; i++) {
                const idx = i * 3;
                const angle = turbine.foamAngles[i];
                const phase = turbine.foamOffsets[i];

                const surge = Math.sin(elapsedTime * this.foamConfig.speed + phase) * 0.5;
                const currentRadius = this.foamConfig.radius + surge;

                const x = Math.cos(angle) * currentRadius;
                const y = Math.sin(angle) * currentRadius;
                const z = Math.sin(elapsedTime * 3.0 + i) * 0.05;

                turbine.foamPositions[idx] = x;
                turbine.foamPositions[idx + 1] = y;
                turbine.foamPositions[idx + 2] = z;
            }
            turbine.foamGeometry.attributes.position.needsUpdate = true;

            if (cameraQuaternion) {
                turbine.group.quaternion.copy(cameraQuaternion);
            }
        }
    }
}