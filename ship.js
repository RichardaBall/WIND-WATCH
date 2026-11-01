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
        this.buildWake();
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

    // Foam just above the sea: a trail behind the stern that widens and fades. A flat see-through strip; the foam
    // pattern scrolls backwards (update) so the ship seems to move through still water
    buildWake() {
        const stern = -this.length / 2;
        const y = -1.85; // just above the water (-2) and its night overlay (-1.9)

        this.foamTexture = this.createFoamTexture();
        this.foamTexture.wrapS = THREE.RepeatWrapping;
        this.foamTexture.wrapT = THREE.RepeatWrapping;
        this.wakeMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            map: this.foamTexture,
            alphaMap: this.createWakeFadeTexture(),
            transparent: true,
            depthWrite: false,
            opacity: 0.0
        });

        // Strip from (x0, half-width w0) to (x1, w1). v runs 0..1 from start to end (the fade); the foam repeats along it
        const strip = (x0, w0, x1, w1) => {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute([
                x0, y, -w0, x0, y, w0, x1, y, -w1, x1, y, w1
            ], 3));
            geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
            geo.setIndex([0, 2, 1, 1, 2, 3]);
            const mesh = new THREE.Mesh(geo, this.wakeMaterial);
            mesh.renderOrder = 1;
            this.group.add(mesh);
        };
        this.wakeLength = 47;
        strip(stern + 1.0, 4.5, stern - this.wakeLength, 16.0);  // stern wake
        this.foamTexture.repeat.set(1, this.wakeLength / 12);
    }

    // White foam flecks, denser along both edges (the churned water off the quarters) than in the middle
    createFoamTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        for (let i = 0; i < 700; i++) {
            const u = Math.random();
            const edge = Math.min(u, 1 - u);
            if (Math.random() < edge * 1.6) continue; // fewer flecks towards the middle
            const v = Math.random();
            const r = 1 + Math.random() * 3;
            ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + Math.random() * 0.6})`;
            for (const dy of [-128, 0, 128]) { // drawn three times so the pattern tiles seamlessly along the wake
                ctx.beginPath();
                ctx.arc(u * 128, v * 128 + dy, r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        return new THREE.CanvasTexture(canvas);
    }

    // Wake strength along and across a strip (alpha map): strongest at the start, fading to nothing at the end and sides
    createWakeFadeTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(64, 128);
        for (let py = 0; py < 128; py++) {
            const along = 1 - py / 127; // canvas top is v = 1 (the far end)
            const lengthFade = Math.pow(1 - along, 1.5);
            for (let px = 0; px < 64; px++) {
                const across = Math.abs(px / 63 - 0.5) * 2;
                const sideFade = 1 - Math.pow(across, 4);
                const a = Math.round(255 * lengthFade * sideFade);
                const i = (py * 64 + px) * 4;
                img.data[i] = img.data[i + 1] = img.data[i + 2] = a;
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return new THREE.CanvasTexture(canvas);
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
        // Deck light pools fade in with nightfall; the wake dims at night like the island's surf
        this.poolMaterial.opacity = nightFactor * 0.5;
        this.wakeMaterial.opacity = 0.7 * (1 - 0.6 * nightFactor);
        // Foam stays put in the water, so along the ship it drifts backwards at the ship's speed (one repeat = 12 units)
        this.foamTexture.offset.y = -((Date.now() / 1000) * this.speed / 12) % 1;

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
