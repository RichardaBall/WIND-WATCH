import * as THREE from 'three';

export class WinchSystem {
    constructor(scene, parentGroup) {
        this.scene = scene;
        this.parentGroup = parentGroup;
        this.isActive = false;

        // Winch deployment state (cable length)
        this.cableLength = 1.0;
        this.minCableLength = 1.0;
        this.maxCableLength = 12.0;

        // Create Winch Cable Line Geometry
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(0, -1, 0)
        ]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x222222, linewidth: 3 });
        this.cableLine = new THREE.Line(lineGeo, lineMat);
        this.cableLine.frustumCulled = false;
        this.parentGroup.add(this.cableLine);

        // Create Winch Hook / Magnet Mesh at the end of the cable
        const hookGeo = new THREE.ConeGeometry(0.4, 1.0, 6);
        const hookMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.3 });
        this.hookMesh = new THREE.Mesh(hookGeo, hookMat);
        this.hookMesh.rotation.x = Math.PI; // Point downwards
        this.hookMesh.position.set(0, -1, 0);
        this.parentGroup.add(this.hookMesh);

        // Initially hidden until toggled on
        this.setVisibility(false);
    }

    setVisibility(visible) {
        this.cableLine.visible = visible;
        this.hookMesh.visible = visible;
    }

    toggle() {
        this.isActive = !this.isActive;
        this.setVisibility(this.isActive);
        console.log(`Winch System: ${this.isActive ? "DEPLOYED 🪝" : "RETRACTED"}`);
    }

    stop() {
        this.isActive = false;
        this.setVisibility(false);
    }

    update(delta) {
        if (!this.isActive) return;

        // Lower or raise cable dynamically when active (or keep it stable at max deployment)
        // For now, let's make it smoothly lower down to max length when deployed
        if (this.cableLength < this.maxCableLength) {
            this.cableLength = Math.min(this.maxCableLength, this.cableLength + delta * 8.0);
        }

        // Update Hook position
        this.hookMesh.position.y = -this.cableLength;

        // Update Cable line points from helicopter bottom (-1) to hook position (-cableLength)
        const positions = this.cableLine.geometry.attributes.position.array;
        positions[1] = -1.0;                  // Start point Y (under heli)
        positions[4] = -this.cableLength;     // End point Y (at hook)
        this.cableLine.geometry.attributes.position.needsUpdate = true;
    }
}