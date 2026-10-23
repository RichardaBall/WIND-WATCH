import * as THREE from 'three';

export class NavRadar {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.markers = new Map();
        
        // Track the last sweep intersection angle for each marker to handle fading
        this.blipIntensities = new Map();

        // Create UI container for the nose radar at bottom-center screen with CRT styling
        this.container = document.createElement('div');
        this.container.id = 'nav-radar-hud';
        this.container.style.position = 'absolute';
        this.container.style.bottom = '25px';
        this.container.style.left = '50%';
        this.container.style.transform = 'translateX(-50%)';
        this.container.style.width = '280px';
        this.container.style.height = '150px';
        this.container.style.background = 'radial-gradient(circle at center, rgba(5, 30, 15, 0.95) 0%, rgba(2, 10, 5, 0.98) 100%)';
        this.container.style.border = '2px solid rgba(46, 204, 113, 0.6)';
        this.container.style.borderTopLeftRadius = '140px';
        this.container.style.borderTopRightRadius = '140px';
        this.container.style.borderBottom = 'none';
        this.container.style.overflow = 'hidden';
        this.container.style.pointerEvents = 'none';
        this.container.style.boxShadow = '0 0 20px rgba(46, 204, 113, 0.25), inset 0 0 25px rgba(46, 204, 113, 0.4)';

        // Canvas for drawing radar sweep, range rings, and target blips
        this.canvas = document.createElement('canvas');
        this.canvas.width = 280;
        this.canvas.height = 150;
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        document.body.appendChild(this.container);

        this.maxRange = 1500; // Max radar detection distance in world units
        this.sweepAngle = 0;
        
        this.lastPlayerPos = null;
        this.currentHeading = 0;
    }

    addOrUpdateMarker(id, source, color, label) {
        this.markers.set(id, { source, color, label });
    }

    removeMarker(id) {
        this.markers.delete(id);
        this.blipIntensities.delete(id);
    }

    clearMarkers() {
        this.markers.clear();
        this.blipIntensities.clear();
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
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width / 2;
        const centerY = height; // Bottom center origin
        const radius = 130;

        // Clear canvas with subtle trailing effect
        ctx.fillStyle = 'rgba(2, 12, 6, 0.35)';
        ctx.fillRect(0, 0, width, height);

        // Draw scanlines for retro CRT aesthetic
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        for (let y = 0; y < height; y += 3) {
            ctx.fillRect(0, y, width, 1);
        }

        // Draw radar grid rings
        ctx.strokeStyle = 'rgba(46, 204, 113, 0.25)';
        ctx.lineWidth = 1;
        
        [0.33, 0.66, 1.0].forEach(ratio => {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * ratio, Math.PI, 0, false);
            ctx.stroke();
        });

        // Draw crosshair lines
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX, centerY - radius);
        ctx.moveTo(centerX - radius, centerY);
        ctx.lineTo(centerX + radius, centerY);
        ctx.stroke();

        // Draw heading ticks and labels
        ctx.fillStyle = '#2ecc71';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('0° (NOSE)', centerX, 18);
        ctx.fillText('-90°', 30, height - 8);
        ctx.fillText('+90°', width - 30, height - 8);

        if (!this.player) return;

        const heliPos = this.player.getPosition();

        if (this.lastPlayerPos) {
            const moveX = heliPos.x - this.lastPlayerPos.x;
            const moveZ = heliPos.z - this.lastPlayerPos.z;
            const speedSq = moveX * moveX + moveZ * moveZ;
            if (speedSq > 0.001) {
                this.currentHeading = Math.atan2(moveX, moveZ);
            }
        }
        this.lastPlayerPos = heliPos.clone();

        const heading = this.currentHeading;

        // Advance sweep angle
        this.sweepAngle += 0.01;
        const sweepRad = (Math.sin(this.sweepAngle) * 0.48) * Math.PI;

        for (const [id, marker] of this.markers.entries()) {
            const worldPos = this.resolvePosition(marker.source);
            if (!worldPos) continue;

            const dx = worldPos.x - heliPos.x;
            const dz = worldPos.z - heliPos.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance > this.maxRange) continue;

            const worldAngle = Math.atan2(dx, dz);
            let relativeAngle = worldAngle - heading;

            while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
            while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;

            // Forward 180-degree check (-90° to +90° relative to nose)
            if (relativeAngle >= -Math.PI / 2 && relativeAngle <= Math.PI / 2) {
                const radarDist = (distance / this.maxRange) * radius;
                const blipX = centerX - radarDist * Math.sin(relativeAngle);
                const blipY = centerY - radarDist * Math.cos(relativeAngle);

                // Calculate angle of this blip relative to bottom center origin (-PI/2 to PI/2 range on canvas)
                const blipAngle = Math.atan2(blipX - centerX, centerY - blipY) - Math.PI / 2;

                // Check if the sweeping beam is currently passing over this blip
                let intensity = this.blipIntensities.get(id) || 0;
                const angleDiff = Math.abs(sweepRad - relativeAngle);
                
                if (angleDiff < 0.12) {
                    intensity = 1.0; // Fully lit when sweep passes over
                } else {
                    intensity = Math.max(0, intensity - 0.015); // Fade out gradually
                }
                this.blipIntensities.set(id, intensity);

                // Only render if visible (intensity > 0)
                if (intensity > 0.05) {
                    ctx.save();
                    ctx.globalAlpha = intensity;
                    ctx.shadowColor = marker.color;
                    ctx.shadowBlur = 12 * intensity;

                    ctx.fillStyle = marker.color;
                    ctx.beginPath();
                    ctx.arc(blipX, blipY, 4.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }
        }

        // Draw sweeping radar beam with gradient trail
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, -Math.PI / 2 + sweepRad - 0.15, -Math.PI / 2 + sweepRad, false);
        ctx.closePath();
        ctx.fillStyle = 'rgba(46, 204, 113, 0.15)';
        ctx.fill();
        ctx.restore();

        // Draw sweep line
        ctx.strokeStyle = 'rgba(46, 204, 113, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + radius * Math.sin(sweepRad), centerY - radius * Math.cos(sweepRad));
        ctx.stroke();
    }
}