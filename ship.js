// ship.js
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Research ship sailing a circle around the island, between the inner (150) and outer (300) turbine rings.
// Its place comes from the clock, like the weather, so every player sees it in the same spot with no network traffic.
// Stand-in model: bow points along local +X, the helideck sits at the stern.
export class SupportShip {
    constructor(scene) {
        this.scene = scene;

        this.routeRadius = 225.0;
        this.speed = 3.0;          // units per second: one lap of the island takes about 8 minutes
        this.length = 44.0;
        this.beam = 11.0;
        this.hullTop = 5.0;        // main deck amidships; sea surface is at -2 (ocean.js)
        this.keel = -3.5;
        this.deckHeight = 7.0;     // helideck surface, where a landed helicopter sits
        this.deckOffset = -16.0;   // helideck centre, from the middle of the ship towards the stern

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

    // Hull shape at a point along the ship: half-width at deck level, deck height and keel height.
    // The bow narrows in a curve, rises (sheer) and its keel sweeps up into a raked stem
    hullSection(x) {
        const t = (x + this.length / 2) / this.length;  // 0 at the stern, 1 at the bow
        const bow = THREE.MathUtils.clamp((t - 0.5) / 0.5, 0, 1);
        const stern = THREE.MathUtils.smoothstep(t, 0, 0.2);

        const halfBeam = this.beam / 2 * (0.85 + 0.15 * stern) * Math.sqrt(Math.max(0, 1 - Math.pow(bow, 2.2)));
        return {
            halfBeam: Math.max(0.15, halfBeam),
            top: this.hullTop + 1.6 * bow * bow,
            keel: this.keel + 6.0 * Math.pow(bow, 3)
        };
    }

    // One cross-section, port deck edge round the bottom to the starboard deck edge: flared sides that tuck in
    // towards the bottom, a rounded bilge and a flat bottom
    sectionPoints(x) {
        const { halfBeam, top, keel } = this.hullSection(x);
        const bottomHalf = halfBeam * 0.72;
        const radius = Math.min(1.6, bottomHalf * 0.8, (top - keel) * 0.4);
        const half = [];
        for (let k = 0; k < 5; k++) {
            const f = k / 5;
            half.push([THREE.MathUtils.lerp(halfBeam, bottomHalf, Math.pow(f, 1.5)), THREE.MathUtils.lerp(top, keel + radius, f)]);
        }
        for (let m = 0; m <= 5; m++) {
            const a = (m / 5) * Math.PI / 2;
            half.push([bottomHalf - radius + radius * Math.cos(a), keel + radius - radius * Math.sin(a)]);
        }
        half.push([0, keel]);

        const points = half.map(([w, y]) => new THREE.Vector3(x, y, -w));
        for (let i = half.length - 2; i >= 0; i--) {
            points.push(new THREE.Vector3(x, half[i][1], half[i][0]));
        }
        return points;
    }

    buildHull(hullMat, deckMat, whiteMat) {
        const sectionCount = 36;
        const sections = [];
        for (let i = 0; i <= sectionCount; i++) {
            sections.push(this.sectionPoints(-this.length / 2 + this.length * i / sectionCount));
        }
        const ring = sections[0].length;
        const last = sections.length - 1;

        const hullPositions = [];
        const hullIndex = [];
        for (const points of sections) {
            for (const p of points) hullPositions.push(p.x, p.y, p.z);
        }
        for (let i = 0; i < last; i++) {
            for (let j = 0; j < ring - 1; j++) {
                const a = i * ring + j, b = a + 1, c = a + ring, d = c + 1;
                hullIndex.push(a, c, b, b, c, d);
            }
        }
        // Close the flat transom (stern) and the tip of the bow
        for (const [s, flip] of [[0, false], [last, true]]) {
            const centre = hullPositions.length / 3;
            const pts = sections[s];
            const mid = pts.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(ring);
            hullPositions.push(mid.x, mid.y, mid.z);
            for (let j = 0; j < ring; j++) {
                const a = s * ring + j, b = s * ring + (j + 1) % ring;
                if (flip) hullIndex.push(centre, b, a); else hullIndex.push(centre, a, b);
            }
        }
        const hullGeo = new THREE.BufferGeometry();
        hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(hullPositions, 3));
        hullGeo.setIndex(hullIndex);
        hullGeo.computeVertexNormals();
        this.group.add(new THREE.Mesh(hullGeo, hullMat));

        // Main deck between the two deck edges, and a low white bulwark (side wall) along them
        const deckPositions = [];
        const deckIndex = [];
        const wallPositions = [];
        const wallIndex = [];
        const wallHeight = 0.8;
        for (let i = 0; i <= last; i++) {
            const port = sections[i][0];
            const starboard = sections[i][ring - 1];
            deckPositions.push(port.x, port.y, port.z, starboard.x, starboard.y, starboard.z);
            wallPositions.push(
                port.x, port.y, port.z, port.x, port.y + wallHeight, port.z,
                starboard.x, starboard.y, starboard.z, starboard.x, starboard.y + wallHeight, starboard.z
            );
            if (i < last) {
                const a = i * 2;
                deckIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
                const w = i * 4;
                wallIndex.push(w, w + 4, w + 1, w + 1, w + 4, w + 5, w + 2, w + 3, w + 6, w + 3, w + 7, w + 6);
            }
        }
        const deckGeo = new THREE.BufferGeometry();
        deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(deckPositions, 3));
        deckGeo.setIndex(deckIndex);
        deckGeo.computeVertexNormals();
        this.group.add(new THREE.Mesh(deckGeo, deckMat));

        const wallGeo = new THREE.BufferGeometry();
        wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPositions, 3));
        wallGeo.setIndex(wallIndex);
        wallGeo.computeVertexNormals();
        this.group.add(new THREE.Mesh(wallGeo, whiteMat));
    }

    buildModel() {
        // DoubleSide: the hand-built hull, deck and walls are seen from both sides at the bow and stern
        const hullMat = new THREE.MeshStandardMaterial({ color: 0x2b5c8f, roughness: 0.6, side: THREE.DoubleSide });
        const deckMat = new THREE.MeshStandardMaterial({ color: 0x5a636b, roughness: 0.9, side: THREE.DoubleSide });
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.6, side: THREE.DoubleSide });
        const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf07c1e, roughness: 0.6 });
        // Self-lit so the ship can be found at night
        const windowMat = new THREE.MeshStandardMaterial({ color: 0x1b2633, roughness: 0.2, emissive: 0xffc870, emissiveIntensity: 0.5 });

        this.buildHull(hullMat, deckMat, whiteMat);

        const deck = this.hullTop;

        // Deckhouse, and the bridge on top of it with a window band all round
        const house = new THREE.Mesh(new RoundedBoxGeometry(15, 3.2, 8.4, 2, 0.5), whiteMat);
        house.position.set(-1, deck + 1.6, 0);
        this.group.add(house);

        const bridge = new THREE.Mesh(new RoundedBoxGeometry(7.5, 2.8, 9.4, 2, 0.45), whiteMat);
        bridge.position.set(3, deck + 4.6, 0);
        this.group.add(bridge);

        const windows = new THREE.Mesh(new RoundedBoxGeometry(7.6, 0.9, 9.5, 2, 0.44), windowMat);
        windows.position.set(3, deck + 5.1, 0);
        this.group.add(windows);

        // Mast with a radar bar and a white dome
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 5, 8), whiteMat);
        mast.position.set(3.5, deck + 8.5, 0);
        this.group.add(mast);

        const radar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 3.2), deckMat);
        radar.position.set(3.5, deck + 9.6, 0);
        this.group.add(radar);

        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), whiteMat);
        dome.position.set(2.6, deck + 7.0, -2.8);
        this.group.add(dome);

        // Funnel behind the bridge, blue top band
        const funnel = new THREE.Mesh(new RoundedBoxGeometry(2.4, 2.6, 3.0, 2, 0.6), whiteMat);
        funnel.position.set(-5.5, deck + 4.5, 0);
        this.group.add(funnel);

        const funnelTop = new THREE.Mesh(new RoundedBoxGeometry(2.45, 0.7, 3.05, 2, 0.3), hullMat);
        funnelTop.position.set(-5.5, deck + 5.5, 0);
        this.group.add(funnelTop);

        // Orange lifeboats on both sides of the deckhouse
        for (const side of [-1, 1]) {
            const boat = new THREE.Mesh(new THREE.CapsuleGeometry(0.65, 2.6, 4, 10), orangeMat);
            boat.rotation.z = Math.PI / 2;
            boat.position.set(-3, deck + 3.6, side * 4.6);
            this.group.add(boat);
        }

        // Crane on the foredeck
        const craneBase = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 2.2, 12), orangeMat);
        craneBase.position.set(12, deck + 1.1, 0);
        this.group.add(craneBase);

        const boom = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 0.5), orangeMat);
        boom.geometry.translate(3.5, 0, 0);
        boom.position.set(12, deck + 2.2, 0);
        boom.rotation.set(0, -0.6, 0.45);
        this.group.add(boom);

        // Helideck at the stern: same 13 x 13 pad as before, raised on posts and overhanging the narrower hull
        const padSize = 13.0;
        const platform = new THREE.Mesh(new THREE.BoxGeometry(padSize, 0.5, padSize), deckMat);
        platform.position.set(this.deckOffset, this.deckHeight - 0.25, 0);
        this.group.add(platform);

        for (const px of [-20, -12]) {
            for (const pz of [-3.5, 3.5]) {
                const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, this.deckHeight - deck, 6), whiteMat);
                post.position.set(px, (this.deckHeight + deck) / 2, pz);
                this.group.add(post);
            }
        }

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
            const dot = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color }));
            dot.position.set(x, y, z);
            this.group.add(dot);
        };
        navLight(0xff2222, 3, deck + 5.8, -4.9);  // port (left), red
        navLight(0x22ff44, 3, deck + 5.8, 4.9);   // starboard (right), green
        navLight(0xffffff, 3.5, deck + 11.1, 0);  // masthead, white
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
