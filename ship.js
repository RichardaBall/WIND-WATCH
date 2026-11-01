// ship.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Frigate sailing a circle around the island, between the inner (150) and outer (300) turbine rings.
// Its place comes from the clock, like the weather, so every player sees it in the same spot with no network traffic.
// Model: frigate-low.glb, a reduced copy of frigate.glb (fewer triangles, 1024 px WebP textures, Draco compressed).
// In the ship's group the bow points along +X and the helideck is at the stern.
export class SupportShip {
    constructor(scene) {
        this.scene = scene;

        this.routeRadius = 225.0;
        this.speed = 3.0;          // units per second: one lap of the island takes about 8 minutes
        this.length = 80.0;        // the model is scaled to this length and centred on the group

        // Helideck, measured on the model at 80 long with the sea surface at -2 (ocean.js). Move these with the model
        this.deckHeight = 1.82;    // helideck surface, where a landed helicopter sits
        this.deckOffset = -35.3;   // centre of the painted circle, from the middle of the ship towards the stern

        this.group = new THREE.Group();
        this.group.visible = false; // shown once the model has loaded
        scene.add(this.group);

        // Landing pad on the helideck. The player's landingPads list holds this same vector, so it is updated in place
        this.deckPosition = new THREE.Vector3();
        // How far the helideck moved in the last update, so a helicopter on it can move along exactly
        this.deckMovement = new THREE.Vector3();
        this._lastDeckPosition = new THREE.Vector3();

        this.loadModel();
        this.buildLights();
        this.update();
        this.deckMovement.set(0, 0, 0);
    }

    loadModel() {
        // The model is Draco compressed; the decoder comes from the same three.js version as the import map
        const draco = new DRACOLoader();
        draco.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/gltf/');
        const loader = new GLTFLoader();
        loader.setDRACOLoader(draco);

        loader.load('frigate-low.glb', (gltf) => {
            const model = gltf.scene;
            model.traverse((child) => {
                if (child.isMesh) {
                    const old = child.material;
                    child.material = this.toStandardMaterial(old);
                    old.dispose();
                }
            });

            // Model runs bow to stern along its -Z/+Z: turn the bow onto +X, scale to length, centre it, sea at -2
            const holder = new THREE.Group();
            holder.rotation.y = -Math.PI / 2;
            holder.add(model);
            holder.updateMatrixWorld(true);
            const size = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3());
            holder.scale.setScalar(this.length / size.x);
            holder.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(holder);
            holder.position.set(-(box.min.x + box.max.x) / 2, -2.0, 0);
            this.group.add(holder);
            this.group.visible = true;
            draco.dispose();
        }, undefined, (error) => {
            console.error('Ship model failed to load:', error);
        });
    }

    // Plain lit materials instead of the model's physical ones: same look from this camera and cheaper to draw. The
    // model's see-through glass in particular would make three.js render the whole scene a second time every frame
    toStandardMaterial(material) {
        if (material.transmission > 0) {
            return new THREE.MeshStandardMaterial({ color: 0x1b2633, roughness: 0.2 });
        }
        return new THREE.MeshStandardMaterial({
            map: material.map,
            color: material.color,
            roughness: material.roughness,
            metalness: material.metalness,
            side: material.side
        });
    }

    // Night lighting, like the island's helipads: green lamps round the helideck's painted square with soft pools of
    // light (additive glow, no real lights), plus the navigation lights. All unlit dots: no per-pixel light cost
    buildLights() {
        const deckX = this.deckOffset;
        const deckY = this.deckHeight;

        const lampMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
        const lampGeo = new THREE.SphereGeometry(0.15, 8, 6);
        const poolGeo = new THREE.PlaneGeometry(4.5, 4.5);
        poolGeo.rotateX(-Math.PI / 2);
        this.poolMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff66,
            map: this.createGlowTexture(),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.0
        });
        for (const along of [-3.7, 0, 3.7]) {
            for (const across of [-4.4, 4.4]) {
                const lamp = new THREE.Mesh(lampGeo, lampMat);
                lamp.position.set(deckX + along, deckY + 0.15, across);
                this.group.add(lamp);
                const pool = new THREE.Mesh(poolGeo, this.poolMaterial);
                pool.position.set(deckX + along, deckY + 0.03, across * 0.85);
                this.group.add(pool);
            }
        }

        const navLight = (color, x, y, z) => {
            const dot = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color }));
            dot.position.set(x, y, z);
            this.group.add(dot);
        };
        navLight(0xff2222, 13.5, 8.3, -4.7);  // port (left) bridge wing, red
        navLight(0x22ff44, 13.5, 8.3, 4.7);   // starboard (right) bridge wing, green
        navLight(0xffffff, 1.5, 16.2, 0);     // masthead, white
    }

    createGlowTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.35)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(canvas);
    }

    update(nightFactor = 0) {
        // Deck light pools fade in with nightfall
        this.poolMaterial.opacity = nightFactor * 0.5;

        const angle = ((Date.now() / 1000) * this.speed / this.routeRadius) % (Math.PI * 2);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // Sailing direction is the circle's tangent (-sin, cos); turn local +X (the bow) onto it
        this.group.position.set(this.routeRadius * cos, 0, this.routeRadius * sin);
        this.group.rotation.y = Math.atan2(-cos, -sin);

        this._lastDeckPosition.copy(this.deckPosition);
        this.deckPosition.set(
            this.group.position.x - sin * this.deckOffset,
            this.deckHeight,
            this.group.position.z + cos * this.deckOffset
        );
        this.deckMovement.subVectors(this.deckPosition, this._lastDeckPosition);
    }
}
