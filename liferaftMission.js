import * as THREE from 'three';

export class LiferaftMission {
    constructor(scene, player, navRadar, searchLightSystem = null, customPosition = null) {
        this.scene = scene;
        this.player = player;
        this.navRadar = navRadar;
        this.searchLightSystem = searchLightSystem;

        this.group = new THREE.Group();
        this.scene.add(this.group);

        const textureLoader = new THREE.TextureLoader();

        // --- Randomly choose between variation 0 and variation 1 ---
        this.variantIndex = Math.random() < 0.5 ? 0 : 1;
        const raftTextureName = `raft1_angle_${this.variantIndex}.png`;
        const survivorTextureName = `survivor_angle_${this.variantIndex}.png`;

        console.log(`🛟 Spawning Liferaft Mission with variant set: ${raftTextureName} & ${survivorTextureName} (Variant Index: ${this.variantIndex})`);

        // --- 1. Load Raft Sprite ---
        this.raftMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.4,
            transparent: true,
            opacity: 1.0,
            depthWrite: false,
            alphaTest: 0.5,
            side: THREE.DoubleSide
        });

        textureLoader.load(raftTextureName, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            this.raftMat.map = tex;
            this.raftMat.needsUpdate = true;
        }, undefined, (err) => {
            console.error(`Error loading ${raftTextureName}:`, err);
        });

        const raftGeo = new THREE.PlaneGeometry(8, 8);
        raftGeo.translate(0, 2, 0);

        this.raftMesh = new THREE.Mesh(raftGeo, this.raftMat);
        this.group.add(this.raftMesh);

        // --- 2. Load Survivor Animated Sprite Sheet (90 Frames) ---
        this.totalFrames = 90;
        this.currentFrame = 0;
        this.isRescued = false;
        this.isFullyCompleted = false;

        this.survivorMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.4,
            transparent: true,
            alphaTest: 0.5,
            side: THREE.DoubleSide
        });

        textureLoader.load(survivorTextureName, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(1 / this.totalFrames, 1);
            tex.offset.x = 0;

            this.survivorMat.map = tex;
            this.survivorMat.needsUpdate = true;
            this.survivorTexture = tex;
        }, undefined, (err) => {
            console.error(`Error loading ${survivorTextureName}:`, err);
        });

        const survivorGeo = new THREE.PlaneGeometry(3, 3);
        this.survivorMesh = new THREE.Mesh(survivorGeo, this.survivorMat);
        
        // --- Variant-specific positions using a fixed holder group ---
        this.survivorHolder = new THREE.Group();
        if (this.variantIndex === 1) {
            this.survivorHolder.position.set(1.95, 3.30, 0.30);
        } else {
            this.survivorHolder.position.set(-1.20, 1.30, 0.30);
        }
        this.survivorHolder.add(this.survivorMesh);
        this.group.add(this.survivorHolder);

        // --- 3. Helipad-Style Glowing Red Light Setup ---
        const lightMarkerGeo = new THREE.SphereGeometry(0.18, 16, 16);
        this.flashingLightMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
        this.flashingMarker = new THREE.Mesh(lightMarkerGeo, this.flashingLightMat);
        
        this.flashingPointLight = new THREE.PointLight(0xff0033, 5.0, 12);

        this.lightHolder = new THREE.Group();
        if (this.variantIndex === 1) {
            this.lightHolder.position.set(1.30, 5.00, 1.37);
        } else {
            this.lightHolder.position.set(1.593, 5.200, 1.371);
        }
        this.lightHolder.add(this.flashingMarker);
        this.lightHolder.add(this.flashingPointLight);
        this.group.add(this.lightHolder);

        // Use custom position if provided, otherwise generate a random ocean location
        if (customPosition) {
            this.group.position.copy(customPosition);
        } else {
            this.group.position.copy(LiferaftMission.generateRandomSpawnPosition());
        }

        // Register on Radar with red marker for active mission
        if (this.navRadar) {
            this.navRadar.addOrUpdateMarker('liferaft', this.group.position, '#e74c3c', 'RAFT');
        }

        this.animationTimer = 0;
        this.fps = 30;
    }

    static generateRandomSpawnPosition() {
        const minDistance = 350;
        const maxDistance = 750;
        
        const angle = Math.random() * Math.PI * 2;
        const distance = minDistance + Math.random() * (maxDistance - minDistance);

        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;

        let finalX = x;
        let finalZ = z;
        if (finalX > 300 && finalX < 550 && finalZ > -500 && finalZ < -150) {
            finalX += 300; 
            finalZ -= 300;
        }

        console.log(`🛟 Liferaft spawned at ocean coordinates: x=${finalX.toFixed(0)}, z=${finalZ.toFixed(0)}`);
        return new THREE.Vector3(finalX, 0.05, finalZ);
    }

    getSurvivorWorldPosition() {
        const pos = new THREE.Vector3();
        this.survivorHolder.getWorldPosition(pos);
        return pos;
    }

    setSurvivorRescued(rescued) {
        if (this.isRescued === rescued) return;
        this.isRescued = rescued;
        if (rescued) {
            this.survivorMesh.visible = false;
            this.flashingMarker.visible = false;
            this.flashingPointLight.intensity = 0;
            if (this.navRadar) {
                this.navRadar.removeMarker('liferaft');
            }
            console.log("🎉 Survivor successfully rescued into the helicopter!");
        }
    }

    fadeRaft(delta) {
        if (this.raftMat.opacity > 0) {
            this.raftMat.opacity = Math.max(0, this.raftMat.opacity - delta / 5.0); 
            if (this.raftMat.opacity <= 0) {
                this.raftMesh.visible = false;
                this.isFullyCompleted = true;
                if (this.group) {
                    this.scene.remove(this.group);
                }
            }
        }
    }

    update(delta, cameraQuaternion, nightFactor = 0, searchLightSystem = null) {
        if (this.isFullyCompleted) return;

        if (this.isRescued) {
            return;
        }

        this.animationTimer += delta;
        if (this.animationTimer >= 1.0 / this.fps) {
            this.animationTimer = 0;
            this.currentFrame = (this.currentFrame + 1) % this.totalFrames;

            if (this.survivorTexture) {
                this.survivorTexture.offset.x = this.currentFrame * (1 / this.totalFrames);
            }
        }

        let colorFactor = 1.0 - nightFactor * 0.7;

        const slSys = searchLightSystem || this.searchLightSystem;
        if (slSys && slSys.state !== 'OFF') {
            const lightPos = slSys.lightPoolMesh.position;
            const raftPos = this.group.position;
            const dx = raftPos.x - lightPos.x;
            const dz = raftPos.z - lightPos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 6.0) {
                colorFactor = 1.0; 
            }
        }

        this.raftMat.color.setRGB(colorFactor, colorFactor, colorFactor);
        this.survivorMat.color.setRGB(colorFactor, colorFactor, colorFactor);

        const isLit = Math.sin(Date.now() * 0.005) > 0;
        this.flashingPointLight.intensity = isLit ? 6.0 : 0.0;
        this.flashingLightMat.color.setHex(isLit ? 0xff0033 : 0x330000);

        if (cameraQuaternion) {
            this.raftMesh.quaternion.copy(cameraQuaternion);
            this.survivorMesh.quaternion.copy(cameraQuaternion);
            this.flashingMarker.quaternion.copy(cameraQuaternion);
        }
    }
}