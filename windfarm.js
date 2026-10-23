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

        // Hardcoded light configuration
        this.lightConfig = {
            x: 1.0,
            y: 22.2,
            z: 0.15,
            scale: 0.05
        };

        // Hardcoded Sparks & Smoke Stack parameters
        this.fxParams = {
            sparkSize: 3,
            sparkSpeed: 10,
            stackSize: 30,
            stackSpeed: 2
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
        this.initFaultListener();
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

    createSparkTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        grad.addColorStop(0.3, 'rgba(255, 220, 50, 0.9)');
        grad.addColorStop(0.7, 'rgba(255, 100, 0, 0.4)');
        grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);
        return new THREE.CanvasTexture(canvas);
    }

    createStackTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(100, 100, 100, 0.8)');
        grad.addColorStop(0.5, 'rgba(60, 60, 60, 0.4)');
        grad.addColorStop(1, 'rgba(20, 20, 20, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(canvas);
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

        // 4. Red Light Mesh
        const markerGeo = new THREE.SphereGeometry(1, 16, 16);
        const markerMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
        const lightMarker = new THREE.Mesh(markerGeo, markerMat);
        lightMarker.position.set(this.lightConfig.x, this.lightConfig.y, this.lightConfig.z);
        lightMarker.scale.set(this.lightConfig.scale, this.lightConfig.scale, this.lightConfig.scale);
        turbineGroup.add(lightMarker);

        const pointLight = new THREE.PointLight(0xff0033, 1.5, 15);
        pointLight.position.set(this.lightConfig.x, this.lightConfig.y, this.lightConfig.z);
        turbineGroup.add(pointLight);

        // 5. Spark Particle System
        const sparkCount = 100;
        const sparkGeometry = new THREE.BufferGeometry();
        const sparkPositions = new Float32Array(sparkCount * 3);
        const sparkVelocities = new Float32Array(sparkCount * 3);
        const sparkLifetimes = new Float32Array(sparkCount);

        for (let i = 0; i < sparkCount; i++) {
            sparkPositions[i * 3] = this.lightConfig.x;
            sparkPositions[i * 3 + 1] = this.lightConfig.y;
            sparkPositions[i * 3 + 2] = this.lightConfig.z;

            sparkVelocities[i * 3] = (Math.random() - 0.5) * 6.0;
            sparkVelocities[i * 3 + 1] = Math.random() * 8.0 + 2.0;
            sparkVelocities[i * 3 + 2] = (Math.random() - 0.5) * 6.0;

            sparkLifetimes[i] = Math.random();
        }

        sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));

        const sparkMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: this.fxParams.sparkSize,
            map: this.createSparkTexture(),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.0
        });

        const sparkSystem = new THREE.Points(sparkGeometry, sparkMaterial);
        sparkSystem.frustumCulled = false;
        turbineGroup.add(sparkSystem);

        // 6. Vertical Smoke Stack Particle System
        const stackCount = 60;
        const stackGeometry = new THREE.BufferGeometry();
        const stackPositions = new Float32Array(stackCount * 3);
        const stackOffsets = new Float32Array(stackCount);

        for (let i = 0; i < stackCount; i++) {
            stackPositions[i * 3] = this.lightConfig.x + (Math.random() - 0.5) * 0.4;
            stackPositions[i * 3 + 1] = this.lightConfig.y + 1.0 + (i / stackCount) * 10.0;
            stackPositions[i * 3 + 2] = this.lightConfig.z + (Math.random() - 0.5) * 0.4;
            stackOffsets[i] = Math.random() * Math.PI * 2;
        }

        stackGeometry.setAttribute('position', new THREE.BufferAttribute(stackPositions, 3));

        const stackMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: this.fxParams.stackSize,
            map: this.createStackTexture(),
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false,
            opacity: 0.0
        });

        const stackSystem = new THREE.Points(stackGeometry, stackMaterial);
        stackSystem.frustumCulled = false;
        turbineGroup.add(stackSystem);

        // 7. Electrical Spark Flash Light
        const sparkLight = new THREE.PointLight(0x00aaff, 0.0, 20);
        sparkLight.position.set(this.lightConfig.x, this.lightConfig.y, this.lightConfig.z);
        turbineGroup.add(sparkLight);

        this.group.add(turbineGroup);

        this.turbines.push({
            group: turbineGroup,
            rotor: rotorGroup,
            spinSpeed: this.config.speed,
            foamGeometry: foamGeometry,
            foamPositions: foamPositions,
            foamAngles: foamAngles,
            foamOffsets: foamOffsets,
            pointLight: pointLight,
            sparkSystem: sparkSystem,
            sparkMaterial: sparkMaterial,
            sparkVelocities: sparkVelocities,
            sparkLifetimes: sparkLifetimes,
            stackSystem: stackSystem,
            stackMaterial: stackMaterial,
            stackOffsets: stackOffsets,
            sparkLight: sparkLight,
            isSparking: false
        });
    }

    initFaultListener() {
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'f') {
                for (const turbine of this.turbines) {
                    turbine.isSparking = !turbine.isSparking;
                    turbine.sparkMaterial.opacity = turbine.isSparking ? 0.9 : 0.0;
                    turbine.stackMaterial.opacity = turbine.isSparking ? 0.6 : 0.0;
                    turbine.sparkLight.intensity = turbine.isSparking ? 5.0 : 0.0;
                    
                    const statusEl = document.getElementById('spark-status');
                    if (statusEl) {
                        statusEl.innerText = turbine.isSparking ? 'FAULT SPARKING ⚡' : 'NORMAL';
                        statusEl.style.color = turbine.isSparking ? '#00ccff' : '#ff4444';
                    }
                }
            }
        });
    }

    update(delta, cameraQuaternion) {
        for (const turbine of this.turbines) {
            const elapsedTime = Date.now() * 0.001;

            turbine.rotor.rotation.z += this.config.speed * delta;

            // Water foam ring animation
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

            // Sparks & Smoke Stack animation when active
            if (turbine.isSparking) {
                turbine.sparkLight.intensity = Math.random() > 0.3 ? 6.0 : 0.5;

                // Spark burst physics
                const sparkPos = turbine.sparkSystem.geometry.attributes.position.array;
                for (let i = 0; i < turbine.sparkLifetimes.length; i++) {
                    const idx = i * 3;
                    turbine.sparkLifetimes[i] -= delta * 1.5;

                    sparkPos[idx] += turbine.sparkVelocities[idx] * delta * (this.fxParams.sparkSpeed / 10);
                    sparkPos[idx + 1] += turbine.sparkVelocities[idx + 1] * delta * (this.fxParams.sparkSpeed / 10) - (9.8 * delta * delta);
                    sparkPos[idx + 2] += turbine.sparkVelocities[idx + 2] * delta * (this.fxParams.sparkSpeed / 10);

                    if (turbine.sparkLifetimes[i] <= 0 || sparkPos[idx + 1] < this.lightConfig.y - 2.0) {
                        sparkPos[idx] = this.lightConfig.x + (Math.random() - 0.5) * 0.5;
                        sparkPos[idx + 1] = this.lightConfig.y;
                        sparkPos[idx + 2] = this.lightConfig.z + (Math.random() - 0.5) * 0.5;

                        turbine.sparkVelocities[idx] = (Math.random() - 0.5) * 8.0;
                        turbine.sparkVelocities[idx + 1] = Math.random() * 10.0 + 3.0;
                        turbine.sparkVelocities[idx + 2] = (Math.random() - 0.5) * 8.0;

                        turbine.sparkLifetimes[i] = Math.random() * 0.8 + 0.2;
                    }
                }
                turbine.sparkSystem.geometry.attributes.position.needsUpdate = true;

                // Vertical Smoke Stack rising animation
                const stackPos = turbine.stackSystem.geometry.attributes.position.array;
                for (let i = 0; i < turbine.stackOffsets.length; i++) {
                    const idx = i * 3;
                    const phase = turbine.stackOffsets[i];

                    stackPos[idx + 1] += delta * this.fxParams.stackSpeed;
                    stackPos[idx] += Math.sin(elapsedTime * 4 + phase) * 0.02;
                    stackPos[idx + 2] += Math.cos(elapsedTime * 3 + phase) * 0.02;

                    if (stackPos[idx + 1] > this.lightConfig.y + 12.0) {
                        stackPos[idx] = this.lightConfig.x + (Math.random() - 0.5) * 0.4;
                        stackPos[idx + 1] = this.lightConfig.y + 1.0;
                        stackPos[idx + 2] = this.lightConfig.z + (Math.random() - 0.5) * 0.4;
                    }
                }
                turbine.stackSystem.geometry.attributes.position.needsUpdate = true;
            }

            if (cameraQuaternion) {
                turbine.group.quaternion.copy(cameraQuaternion);
            }
        }
    }
}