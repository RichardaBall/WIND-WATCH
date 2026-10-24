import * as THREE from 'three';

export class LiferaftMission {
    constructor(scene, player, navRadar, searchLightSystem = null) {
        this.scene = scene;
        this.player = player;
        this.navRadar = navRadar;
        this.searchLightSystem = searchLightSystem;

        this.group = new THREE.Group();
        this.scene.add(this.group);

        const textureLoader = new THREE.TextureLoader();

        // --- 1. Load Raft Sprite ---
        this.raftMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.4,
            transparent: true,
            alphaTest: 0.5,
            side: THREE.DoubleSide
        });

        textureLoader.load('raft1_angle_0.png', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            this.raftMat.map = tex;
            this.raftMat.needsUpdate = true;
        }, undefined, (err) => {
            console.error('Error loading raft1_angle_0.png:', err);
        });

        const raftGeo = new THREE.PlaneGeometry(8, 8);
        raftGeo.translate(0, 2, 0);

        this.raftMesh = new THREE.Mesh(raftGeo, this.raftMat);
        this.group.add(this.raftMesh);

        // --- 2. Load Survivor Animated Sprite Sheet (90 Frames) ---
        this.totalFrames = 90;
        this.currentFrame = 0;

        this.survivorMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.4,
            transparent: true,
            alphaTest: 0.5,
            side: THREE.DoubleSide
        });

        textureLoader.load('survivor_angle_0.png', (tex) => {
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
            console.error('Error loading survivor_angle_0.png:', err);
        });

        const survivorGeo = new THREE.PlaneGeometry(3, 3);
        this.survivorMesh = new THREE.Mesh(survivorGeo, this.survivorMat);
        this.survivorMesh.position.set(-1.20, 1.30, 0.30); 
        this.group.add(this.survivorMesh);

        // --- 3. Helipad-Style Glowing Red Light Setup ---
        const lightMarkerGeo = new THREE.SphereGeometry(0.18, 16, 16);
        this.flashingLightMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
        this.flashingMarker = new THREE.Mesh(lightMarkerGeo, this.flashingLightMat);
        this.flashingMarker.position.set(1.593, 5.200, 1.371);
        this.group.add(this.flashingMarker);

        this.flashingPointLight = new THREE.PointLight(0xff0033, 5.0, 12);
        this.flashingPointLight.position.set(1.593, 5.200, 1.371);
        this.group.add(this.flashingPointLight);

        // Spawned right next to the main base for easy testing
        this.group.position.set(30, 0.05, 0);

        // Register on Radar
        if (this.navRadar) {
            this.navRadar.addOrUpdateMarker('liferaft', this.group.position, '#e67e22', 'RAFT');
        }

        this.animationTimer = 0;
        this.fps = 30;
    }

    update(delta, cameraQuaternion, nightFactor = 0, searchLightSystem = null) {
        // Animate survivor sprite sheet offset
        this.animationTimer += delta;
        if (this.animationTimer >= 1.0 / this.fps) {
            this.animationTimer = 0;
            this.currentFrame = (this.currentFrame + 1) % this.totalFrames;

            if (this.survivorTexture) {
                this.survivorTexture.offset.x = this.currentFrame * (1 / this.totalFrames);
            }
        }

        // Default darkness factor based on night cycle
        let colorFactor = 1.0 - nightFactor * 0.7;

        // Check searchlight illumination for daytime reveal in light circle
        const slSys = searchLightSystem || this.searchLightSystem;
        if (slSys && slSys.state !== 'OFF') {
            const lightPos = slSys.lightPoolMesh.position;
            const raftPos = this.group.position;
            const dx = raftPos.x - lightPos.x;
            const dz = raftPos.z - lightPos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 6.0) {
                colorFactor = 1.0; // Full daytime brightness and color inside the searchlight beam!
            }
        }

        this.raftMat.color.setRGB(colorFactor, colorFactor, colorFactor);
        this.survivorMat.color.setRGB(colorFactor, colorFactor, colorFactor);

        // Pulse the flashing red light intensity and glowing mesh (slower speed)
        const isLit = Math.sin(Date.now() * 0.005) > 0;
        this.flashingPointLight.intensity = isLit ? 6.0 : 0.0;
        this.flashingLightMat.color.setHex(isLit ? 0xff0033 : 0x330000);

        // Billboard components to match camera orientation
        if (cameraQuaternion) {
            this.raftMesh.quaternion.copy(cameraQuaternion);
            this.survivorMesh.quaternion.copy(cameraQuaternion);
            this.flashingMarker.quaternion.copy(cameraQuaternion);
        }
    }
}