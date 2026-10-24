import * as THREE from 'three';

export class NavRadar {
    constructor(scene, player, camera) {
        this.scene = scene;
        this.player = player;
        this.camera = camera;
        this.markers = new Map();

        this.container = document.createElement('div');
        this.container.id = 'edge-pointers-hud';
        this.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 999;
        `;
        document.body.appendChild(this.container);

        this.domElements = new Map();
    }

    addOrUpdateMarker(id, source, color, label) {
        this.markers.set(id, { source, color, label });
        
        const el = this.domElements.get(id);
        if (el) {
            const arrowEl = el.querySelector('.pointer-arrow');
            if (arrowEl) {
                arrowEl.style.borderBottomColor = color;
                arrowEl.style.filter = `drop-shadow(0 0 6px ${color})`;
            }
        }
    }

    removeMarker(id) {
        this.markers.delete(id);
        const el = this.domElements.get(id);
        if (el) {
            el.remove();
            this.domElements.delete(id);
        }
    }

    clearMarkers() {
        this.markers.clear();
        for (const el of this.domElements.values()) {
            el.remove();
        }
        this.domElements.clear();
    }

    resolvePosition(source) {
        if (!source) return null;
        if (source instanceof THREE.Vector3) return source;
        if (typeof source.getCenter === 'function') return source.getCenter();
        if (typeof source.getPosition === 'function') return source.getPosition();
        if (source.position instanceof THREE.Vector3) return source.position;
        if (source.mesh?.position instanceof THREE.Vector3) return source.mesh.position;
        if (source.group?.position instanceof THREE.Vector3) return source.group.position;
        return null;
    }

    update() {
        if (!this.player || !this.camera) return;

        for (const [id, marker] of this.markers.entries()) {
            const worldPos = this.resolvePosition(marker.source);
            if (!worldPos) continue;

            const p = worldPos.clone();
            p.project(this.camera);

            const screenX = (p.x * 0.5 + 0.5) * window.innerWidth;
            const screenY = (-(p.y * 0.5) + 0.5) * window.innerHeight;

            let el = this.domElements.get(id);
            if (!el) {
                el = document.createElement('div');
                el.style.cssText = `
                    position: absolute;
                    transform: translate(-50%, -50%);
                    pointer-events: none;
                    transition: opacity 0.15s;
                `;
                el.innerHTML = `
                    <div class="pointer-arrow" style="width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-bottom: 16px solid ${marker.color}; filter: drop-shadow(0 0 6px ${marker.color});"></div>
                `;
                this.container.appendChild(el);
                this.domElements.set(id, el);
            }

            const arrowEl = el.querySelector('.pointer-arrow');
            arrowEl.style.borderBottomColor = marker.color;
            arrowEl.style.filter = `drop-shadow(0 0 6px ${marker.color})`;

            // Check if on screen
            const margin = 50;
            const isOnScreen = p.z <= 1 && screenX >= margin && screenX <= window.innerWidth - margin && screenY >= margin && screenY <= window.innerHeight - margin;

            if (isOnScreen) {
                // Hide pointer when destination is visible on screen
                el.style.opacity = '0';
            } else {
                // Clamp to screen edges when off-screen
                const centerX = window.innerWidth / 2;
                const centerY = window.innerHeight / 2;
                let dx = screenX - centerX;
                let dy = screenY - centerY;

                if (p.z > 1) {
                    dx = -dx;
                    dy = -dy;
                }

                const angle = Math.atan2(dy, dx);
                const pad = 60;
                const maxX = centerX - pad;
                const maxY = centerY - pad;

                const slope = Math.tan(angle);
                let clampedX, clampedY;

                if (Math.abs(Math.cos(angle)) * maxY > Math.abs(Math.sin(angle)) * maxX) {
                    clampedX = centerX + (Math.cos(angle) > 0 ? maxX : -maxX);
                    clampedY = centerY + (Math.cos(angle) > 0 ? maxX : -maxX) * slope;
                } else {
                    clampedY = centerY + (Math.sin(angle) > 0 ? maxY : -maxY);
                    clampedX = centerX + (Math.sin(angle) > 0 ? maxY : -maxY) / slope;
                }

                el.style.left = `${clampedX}px`;
                el.style.top = `${clampedY}px`;
                const deg = (angle * 180 / Math.PI) + 90;
                arrowEl.style.transform = `rotate(${deg}deg)`;
                el.style.opacity = '0.9';
            }
        }
    }
}