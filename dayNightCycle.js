import * as THREE from 'three';

export class DayNightCycle {
    constructor(scene, sunLight, ambientLight, ocean) {
        this.scene = scene;
        this.sunLight = sunLight;
        this.ambientLight = ambientLight;
        this.ocean = ocean;

        this.timeOfDay = 0.25; 
        this.timeSpeed = 0.02; 
        this.paused = false;

        this.daySky = new THREE.Color(0x020d1a);
        this.nightSky = new THREE.Color(0x010408);
    }

    setTimeOfDay(val) {
        this.timeOfDay = val;
        this.paused = true;
    }

    update(delta) {
        if (!this.paused) {
            this.timeOfDay = (this.timeOfDay + delta * this.timeSpeed * 0.1) % 1.0;
        }

        const angle = this.timeOfDay * Math.PI * 2;
        const radius = 300;
        const sunX = Math.cos(angle) * radius;
        const sunY = Math.sin(angle) * radius;
        const sunZ = Math.sin(angle * 0.5) * 50;

        this.sunLight.position.set(sunX, sunY, sunZ);

        const sunHeightFactor = Math.sin(angle); 
        const nightFactor = THREE.MathUtils.clamp(-sunHeightFactor, 0.0, 1.0);

        this.sunLight.intensity = Math.max(0.0, sunHeightFactor) * 1.5;
        this.ambientLight.intensity = THREE.MathUtils.lerp(0.8, 0.15, nightFactor);

        this.scene.background.lerpColors(this.daySky, this.nightSky, nightFactor);
        if (this.scene.fog) {
            this.scene.fog.color.copy(this.scene.background);
        }

        // Update ocean lighting uniforms
        if (this.ocean) {
            this.ocean.updateLighting(nightFactor);
        }

        return nightFactor;
    }
}