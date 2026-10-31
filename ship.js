// ship.js
import * as THREE from 'three';

// Support ship sailing a circle around the island, between the inner (150) and outer (300) turbine rings.
// Its place comes from the clock, like the weather, so every player sees it in the same spot with no network traffic.
// Simple stand-in model: bow points along local +X, the helideck sits at the stern.
export class SupportShip {
    constructor(scene) {
        this.scene = scene;

        this.routeRadius = 225.0;
        this.speed = 3.0;          // units per second: one lap of the island takes about 8 minutes
        this.length = 56.0;
        this.beam = 14.0;
        this.hullTop = 6.0;        // sea surface is at -2 (ocean.js)
        this.deckHeight = 7.0;     // helideck surface, where a landed helicopter sits
        this.deckOffset = -17.0;   // helideck centre, from the middle of the ship towards the stern

        this.group = new THREE.Group();
        scene.add(this.group);

        // Landing pad on the helideck. The player's landingPads list holds this same vector, so it is updated in place
        this.deckPosition = new THREE.Vector3();
        // How far the helideck moved in the last update, so a helicopter on it can move along exactly
        this.deckMovement = new THREE.Vector3();
        this._lastDeckPosition = new THREE.Vector3();

        this.buildModel();
        this.update();
        this.deckMovement.set(0, 0, 0);
    }

    buildModel() {
        const halfL = this.length / 2;
        const halfB = this.beam / 2;

        // Hull: top-view outline with a pointed bow, extruded upward. Caps (top/bottom) get the deck colour
        const outline = new THREE.Shape();
        outline.moveTo(-halfL, -halfB);
        outline.lineTo(halfL - 10, -halfB);
        outline.lineTo(halfL, 0);
        outline.lineTo(halfL - 10, halfB);
        outline.lineTo(-halfL, halfB);
        outline.closePath();

        const hullHeight = this.hullTop + 4.0;
        const hullGeo = new THREE.ExtrudeGeometry(outline, { depth: hullHeight, bevelEnabled: false });
        // Shape is drawn in X/Y and extruded along +Z: turn it so the outline lies flat and the extrusion points up
        hullGeo.rotateX(-Math.PI / 2);
        hullGeo.translate(0, this.hullTop - hullHeight, 0);

        const deckMat = new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.9 });
        const hullMat = new THREE.MeshStandardMaterial({ color: 0xb3321e, roughness: 0.7 });
        this.group.add(new THREE.Mesh(hullGeo, [deckMat, hullMat]));

        // Bridge towards the bow, with a dark window band and a mast
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 });
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 11), whiteMat);
        bridge.position.set(8, this.hullTop + 4, 0);
        this.group.add(bridge);

        // Self-lit so the ship can be found at night
        const windowMat = new THREE.MeshStandardMaterial({ color: 0x1b2633, roughness: 0.2, emissive: 0xffc870, emissiveIntensity: 0.5 });
        const windows = new THREE.Mesh(new THREE.BoxGeometry(14.2, 1.4, 11.2), windowMat);
        windows.position.set(8, this.hullTop + 6.5, 0);
        this.group.add(windows);

        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 7, 6), whiteMat);
        mast.position.set(6, this.hullTop + 11.5, 0);
        this.group.add(mast);

        // Helideck at the stern: raised platform with a painted H, ring and edge
        const padSize = 13.0;
        const platform = new THREE.Mesh(new THREE.BoxGeometry(padSize, this.deckHeight - this.hullTop, padSize), deckMat);
        platform.position.set(this.deckOffset, (this.hullTop + this.deckHeight) / 2, 0);
        this.group.add(platform);

        const markGeo = new THREE.PlaneGeometry(padSize, padSize);
        markGeo.rotateX(-Math.PI / 2);
        // Markings glow faintly (deck floodlights) so a night landing has something to aim at
        const deckTexture = this.createHelideckTexture();
        const marking = new THREE.Mesh(markGeo, new THREE.MeshStandardMaterial({
            map: deckTexture,
            emissive: 0xffffff,
            emissiveMap: deckTexture,
            emissiveIntensity: 0.35,
            roughness: 0.8
        }));
        marking.position.set(this.deckOffset, this.deckHeight + 0.02, 0);
        this.group.add(marking);

        // Navigation lights as small unlit dots (no real lights: they cost every lit material per pixel)
        const navLight = (color, x, y, z) => {
            const dot = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color }));
            dot.position.set(x, y, z);
            this.group.add(dot);
        };
        navLight(0xff2222, 12, this.hullTop + 7, -5.8);  // port (left), red
        navLight(0x22ff44, 12, this.hullTop + 7, 5.8);   // starboard (right), green
        navLight(0xffffff, 6, this.hullTop + 15.2, 0);   // masthead, white
    }

    createHelideckTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#2f4a3a';
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 120, 120);

        ctx.strokeStyle = '#f2c230';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(64, 64, 42, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(44, 38, 10, 52);
        ctx.fillRect(74, 38, 10, 52);
        ctx.fillRect(44, 59, 40, 10);

        return new THREE.CanvasTexture(canvas);
    }

    update() {
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
