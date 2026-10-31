// ship.js
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

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
        this.lowDeckTop = 1.5;     // low working deck aft, close to the water
        this.stepX = -4.5;         // where the main deck steps down to the low deck
        this.keel = -3.5;
        this.deckHeight = 7.0;     // helideck surface, where a landed helicopter sits
        this.deckOffset = -19.0;   // helideck centre, from the middle of the ship; the pad overhangs the stern

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
            top: x < this.stepX ? this.lowDeckTop : this.hullTop + 1.6 * bow * bow,
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
        const xs = [this.stepX - 0.02, this.stepX + 0.02];  // two close sections make the deck step a sharp edge
        for (let i = 0; i <= sectionCount; i++) {
            xs.push(-this.length / 2 + this.length * i / sectionCount);
        }
        xs.sort((a, b) => a - b);
        for (const x of xs) {
            sections.push(this.sectionPoints(x));
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
        const house = new THREE.Mesh(new RoundedBoxGeometry(15, 3.2, 8.4, 2, 0.1), whiteMat);
        house.position.set(4, deck + 1.6, 0);
        this.group.add(house);

        const bridge = new THREE.Mesh(new RoundedBoxGeometry(7.5, 2.8, 9.4, 2, 0.1), whiteMat);
        // Front flush with the deckhouse front (deckhouse ends at 11.5, bridge is 7.5 long)
        bridge.position.set(7.75, deck + 4.6, 0);
        this.group.add(bridge);

        const windows = new THREE.Mesh(new RoundedBoxGeometry(7.6, 0.9, 9.5, 2, 0.1), windowMat);
        windows.position.set(7.75, deck + 5.1, 0);
        this.group.add(windows);

        // Big radar dome on the bridge roof
        const radome = this.createRadome(5.2);
        radome.position.set(8.25, deck + 6.0, 0);
        this.group.add(radome);

        // Funnel behind the bridge, blue top band
        const funnel = new THREE.Mesh(new RoundedBoxGeometry(2.4, 2.6, 3.0, 2, 0.1), whiteMat);
        funnel.position.set(-0.5, deck + 4.5, 0);
        this.group.add(funnel);

        const funnelTop = new THREE.Mesh(new RoundedBoxGeometry(2.45, 0.7, 3.05, 2, 0.1), hullMat);
        funnelTop.position.set(-0.5, deck + 5.5, 0);
        this.group.add(funnelTop);

        // Orange lifeboats on both sides of the deckhouse
        for (const side of [-1, 1]) {
            const boat = new THREE.Mesh(new THREE.CapsuleGeometry(0.65, 2.6, 4, 10), orangeMat);
            boat.rotation.z = Math.PI / 2;
            boat.position.set(2, deck + 3.6, side * 4.6);
            this.group.add(boat);
        }

        // Crane on the foredeck
        const craneBase = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 2.2, 12), orangeMat);
        // Foredeck rises towards the bow, so the crane stands on the deck height there
        const foredeck = this.hullSection(16).top;
        craneBase.position.set(16, foredeck + 1.1, 0);
        this.group.add(craneBase);

        const boom = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 0.5), orangeMat);
        boom.geometry.translate(3.5, 0, 0);
        boom.position.set(16, foredeck + 2.2, 0);
        boom.rotation.set(0, -0.6, 0.45);
        this.group.add(boom);

        // Helideck at the stern, on posts above the low deck, overhanging the narrower hull
        // Hexagonal pad, flat sides towards bow and stern, about the same landing area as the old 13 x 13 square
        const padRadius = 7.2;
        const platform = new THREE.Mesh(new THREE.CylinderGeometry(padRadius, padRadius, 0.5, 6), deckMat);
        platform.position.set(this.deckOffset, this.deckHeight - 0.25, 0);
        this.group.add(platform);
        this.buildHelideckNet(padRadius, whiteMat);

        // Posts stand on the low deck (the stern is at -22); diagonal braces from the transom carry the overhang
        const stern = -this.length / 2;
        for (const pz of [-3.5, 3.5]) {
            for (const px of [stern + 1, this.deckOffset + 4]) {
                const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, this.deckHeight - this.lowDeckTop, 6), whiteMat);
                post.position.set(px, (this.deckHeight + this.lowDeckTop) / 2, pz);
                this.group.add(post);
            }
            this.group.add(this.createRod(
                new THREE.Vector3(stern - 0.1, this.lowDeckTop - 2.0, pz),
                new THREE.Vector3(this.deckOffset - 5, this.deckHeight - 0.5, pz),
                0.25, whiteMat));
        }

        const markGeo = new THREE.CircleGeometry(padRadius, 6, Math.PI / 2);
        markGeo.rotateX(-Math.PI / 2);
        // At night the deck is lit like the island's helipads: green lamps round the edge, their light pools
        // baked into a light map (see mainbase.js buildNightLightMap) that update() fades in with nightfall
        const lampRadius = padRadius - 0.5;
        this.deckMaterial = new THREE.MeshStandardMaterial({
            map: this.createHelideckTexture(),
            lightMap: this.buildDeckLightMap(lampRadius / padRadius),
            lightMapIntensity: 0.0,
            roughness: 0.8
        });
        const marking = new THREE.Mesh(markGeo, this.deckMaterial);
        marking.position.set(this.deckOffset, this.deckHeight + 0.02, 0);
        this.group.add(marking);

        // The six lamps themselves, one in each corner, as small unlit dots like the island's
        const lampMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
        const lampGeo = new THREE.SphereGeometry(0.2, 8, 6);
        for (let k = 0; k < 6; k++) {
            const a = Math.PI / 2 + k * Math.PI / 3;
            const lamp = new THREE.Mesh(lampGeo, lampMat);
            // Same corner as the light map's lamp k (circle x -> ship x, circle y -> ship -z after rotateX)
            lamp.position.set(this.deckOffset + lampRadius * Math.cos(a), this.deckHeight + 0.15, -lampRadius * Math.sin(a));
            this.group.add(lamp);
        }

        // Navigation lights as small unlit dots (no real lights: they cost every lit material per pixel)
        const navLight = (color, x, y, z) => {
            const dot = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color }));
            dot.position.set(x, y, z);
            this.group.add(dot);
        };
        navLight(0xff2222, 7.75, deck + 5.8, -4.9);  // port (left), red
        navLight(0x22ff44, 7.75, deck + 5.8, 4.9);   // starboard (right), green
        navLight(0xffffff, 8.25, deck + 6.0 + radome.userData.topHeight + 0.2, 0);  // masthead, white, on top of the dome
    }

    // Radar dome built from panels like a real one: hexagons with a few pentagons (the panel layout is the dual of a
    // subdivided icosahedron). Each panel is lit as one flat piece and slightly shrunk, so a grey under-layer shows as
    // seams between them (lit, so the seams darken at night like the rest of the ship). Origin at the base
    createRadome(radius) {
        const group = new THREE.Group();
        const panelMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.55 });
        const greyMat = new THREE.MeshStandardMaterial({ color: 0xcfd4d8, roughness: 0.7 });

        const baseHeight = 1.2;
        const centreY = baseHeight + radius * 0.36;
        const cutoff = -0.42; // panels below this (as a share of the radius) are hidden inside the collar

        const base = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.45, radius * 0.6, baseHeight, 16), greyMat);
        base.position.y = baseHeight / 2;
        group.add(base);
        // Collar round the bottom edge of the dome, hiding the panels' ragged lower rim
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.96, radius * 0.9, radius * 0.22, 32), greyMat);
        collar.position.y = centreY - radius * 0.36;
        group.add(collar);

        const ico = mergeVertices(new THREE.IcosahedronGeometry(1, 4).deleteAttribute('normal').deleteAttribute('uv'));
        const pos = ico.attributes.position;
        const index = ico.index.array;
        const vertex = (i) => new THREE.Vector3().fromBufferAttribute(pos, i);

        // Panel corners are the triangle centres around each icosahedron vertex
        const faceCentres = [];
        const facesAround = Array.from({ length: pos.count }, () => []);
        for (let f = 0; f < index.length / 3; f++) {
            const a = index[f * 3], b = index[f * 3 + 1], c = index[f * 3 + 2];
            faceCentres.push(vertex(a).add(vertex(b)).add(vertex(c)).normalize());
            facesAround[a].push(f);
            facesAround[b].push(f);
            facesAround[c].push(f);
        }

        const seamMat = new THREE.MeshStandardMaterial({ color: 0x6f7a84, roughness: 0.8 });
        const underLayer = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.985, 48, 24, 0, Math.PI * 2, 0, Math.acos(cutoff)), seamMat);
        underLayer.position.y = centreY;
        group.add(underLayer);

        const panelPositions = [];
        const panelNormals = [];
        const panelShrink = 0.9;
        const e1 = new THREE.Vector3();
        const e2 = new THREE.Vector3();
        for (let v = 0; v < pos.count; v++) {
            const n = vertex(v);
            if (n.y < cutoff) continue;

            // Corners in order round the panel centre, so the fan faces outward
            e1.set(0, 1, 0).cross(n);
            if (e1.lengthSq() < 1e-6) e1.set(1, 0, 0);
            e1.normalize();
            e2.crossVectors(n, e1);
            const corners = facesAround[v]
                .map(f => faceCentres[f].clone().lerp(n, 1 - panelShrink).normalize())
                .sort((p, q) => Math.atan2(p.dot(e2), p.dot(e1)) - Math.atan2(q.dot(e2), q.dot(e1)));

            for (let k = 0; k < corners.length; k++) {
                const p = corners[k];
                const q = corners[(k + 1) % corners.length];
                for (const point of [n, p, q]) {
                    panelPositions.push(point.x * radius, point.y * radius + centreY, point.z * radius);
                    panelNormals.push(n.x, n.y, n.z);
                }
            }
        }

        const panelGeo = new THREE.BufferGeometry();
        panelGeo.setAttribute('position', new THREE.Float32BufferAttribute(panelPositions, 3));
        panelGeo.setAttribute('normal', new THREE.Float32BufferAttribute(panelNormals, 3));
        group.add(new THREE.Mesh(panelGeo, panelMat));

        group.userData.topHeight = centreY + radius;
        return group;
    }

    // Safety net round the helideck edge: a strip of rope mesh sloping slightly up and out from the pad,
    // with a thin outer rail and a bracket under each corner
    buildHelideckNet(padRadius, railMat) {
        const width = 1.5;
        const outerRadius = padRadius + width / Math.cos(Math.PI / 6);
        const innerY = this.deckHeight - 0.15;
        const outerY = this.deckHeight + 0.1;
        const cell = 0.5; // size of one mesh opening
        // Same corner angles as the hexagonal pad (CylinderGeometry puts its first corner on +Z)
        const corner = (radius, k, y) => new THREE.Vector3(
            this.deckOffset + radius * Math.sin(k * Math.PI / 3), y, radius * Math.cos(k * Math.PI / 3));

        const positions = [];
        const uvs = [];
        const index = [];
        const overhang = (outerRadius - padRadius) / 2; // the outer edge is longer by this much at each end
        for (let k = 0; k < 6; k++) {
            const a = corner(padRadius, k, innerY);
            const b = corner(padRadius, k + 1, innerY);
            const c = corner(outerRadius, k + 1, outerY);
            const d = corner(outerRadius, k, outerY);
            const base = positions.length / 3;
            positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
            uvs.push(0, 0, padRadius / cell, 0, (padRadius + overhang) / cell, width / cell, -overhang / cell, width / cell);
            index.push(base, base + 1, base + 2, base, base + 2, base + 3);

            this.group.add(this.createRod(d, c, 0.07, railMat));
            this.group.add(this.createRod(corner(padRadius - 0.3, k, this.deckHeight - 0.5), d, 0.07, railMat));
        }

        const netGeo = new THREE.BufferGeometry();
        netGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        netGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        netGeo.setIndex(index);
        netGeo.computeVertexNormals();

        // One diagonal cross per tile; tiled, the crosses join into a diamond rope mesh
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(32, 32);
        ctx.moveTo(32, 0);
        ctx.lineTo(0, 32);
        ctx.stroke();
        const netTexture = new THREE.CanvasTexture(canvas);
        netTexture.wrapS = THREE.RepeatWrapping;
        netTexture.wrapT = THREE.RepeatWrapping;

        // Transparent (not alphaTest): the rope lines are thinner than a pixel at this zoom and would vanish
        const net = new THREE.Mesh(netGeo, new THREE.MeshStandardMaterial({
            color: 0xd9d2b8,
            map: netTexture,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            // Transparent + DoubleSide is otherwise drawn in two passes, flagging needsUpdate twice per frame
            forceSinglePass: true,
            roughness: 0.9
        }));
        this.group.add(net);
    }

    // Thin round bar from one point to another
    createRod(from, to, radius, material) {
        const length = from.distanceTo(to);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 6), material);
        rod.position.copy(from).add(to).multiplyScalar(0.5);
        rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
        return rod;
    }

    // Light pools of the six green deck lamps, in the deck's texture space. Same falloff as the island's bake
    // (three.js PointLight, range 15, decay 2), stored pre-multiplied by lightMapScale.
    // lampShare: lamp distance from the pad centre as a share of the pad radius
    buildDeckLightMap(lampShare) {
        const size = 128;
        const padRadius = 7.2;
        const range = 15.0;
        // Lower than the island's 2: six lamps on a small pad would otherwise add up to an evenly green deck
        const height = 1.0;
        this.lightMapScale = 3.0;
        const green = new THREE.Color(0x00ff66);
        const accum = new Float32Array(size * size);

        for (let k = 0; k < 6; k++) {
            const a = Math.PI / 2 + k * Math.PI / 3;
            // Texture u/v run 0..1 across the pad's circle (CircleGeometry uv), canvas y runs top-down
            const lx = lampShare * Math.cos(a) * padRadius;
            const ly = lampShare * Math.sin(a) * padRadius;
            for (let py = 0; py < size; py++) {
                for (let px = 0; px < size; px++) {
                    const x = ((px + 0.5) / size * 2 - 1) * padRadius;
                    const y = (1 - (py + 0.5) / size * 2) * padRadius;
                    const distSq = (x - lx) ** 2 + (y - ly) ** 2 + height * height;
                    const dist = Math.sqrt(distSq);
                    if (dist >= range) continue;
                    const cutoff = Math.pow(Math.max(0, 1 - Math.pow(dist / range, 4)), 2);
                    accum[py * size + px] += (height / dist) / distSq * cutoff;
                }
            }
        }

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(size, size);
        for (let p = 0; p < size * size; p++) {
            const v = accum[p] * this.lightMapScale * 255;
            imgData.data[p * 4] = green.r * v;
            imgData.data[p * 4 + 1] = green.g * v;
            imgData.data[p * 4 + 2] = green.b * v;
            imgData.data[p * 4 + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
        return new THREE.CanvasTexture(canvas);
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
        // Edge line along the hexagon (corners at the same angles as the pad's)
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
            const a = Math.PI / 2 + k * Math.PI / 3;
            ctx.lineTo(64 + 60 * Math.cos(a), 64 - 60 * Math.sin(a));
        }
        ctx.closePath();
        ctx.stroke();

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

    update(nightFactor = 0) {
        // Island light map strength (mainbase.js update) times 0.45: six lamps on a small pad, matched by eye at night
        this.deckMaterial.lightMapIntensity = nightFactor * 3.5 / this.lightMapScale * 0.45;

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
