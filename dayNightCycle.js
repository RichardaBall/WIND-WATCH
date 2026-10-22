import * as THREE from 'three';

export class DayNightCycle {
    constructor(scene, sunLight, ambientLight, ocean) {
        this.scene = scene;
        this.sunLight = sunLight;
        this.ambientLight = ambientLight;
        this.ocean = ocean;

        this.timeOfDay = 0.25; // 0.25 = Noon, 0.75 = Midnight
        this.timeScale = 1.0; 
        this.paused = false;

        // Full cycle = 10 minutes (600 seconds) -> 5 mins day, 5 mins night
        this.baseSpeed = 1.0 / 600.0;

        this.daySky = new THREE.Color(0x020d1a);
        this.nightSky = new THREE.Color(0x010408);

        // Create visual Sun mesh
        const sunGeo = new THREE.SphereGeometry(12, 16, 16);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffee });
        this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
        this.scene.add(this.sunMesh);

        // Create visual Moon mesh
        const moonGeo = new THREE.SphereGeometry(10, 16, 16);
        const moonMat = new THREE.MeshBasicMaterial({ color: 0x99ccff });
        this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
        this.scene.add(this.moonMesh);
    }

    setTimeOfDay(val) {
        this.timeOfDay = val;
        this.paused = true;
    }

    toggleTimelapse() {
        this.timeScale = this.timeScale === 1.0 ? 100.0 : 1.0;
        this.paused = false; // Resume if it was paused by manual setting overrides
        return this.timeScale === 100.0;
    }

    update(delta) {
        if (!this.paused) {
            this.timeOfDay = (this.timeOfDay + delta * this.baseSpeed * this.timeScale) % 1.0;
        }

        const angle = this.timeOfDay * Math.PI * 2;
        const radius = 400;
        
        // Sun orbital position
        const sunX = Math.cos(angle) * radius;
        const sunY = Math.sin(angle) * radius;
        const sunZ = 50;
        this.sunLight.position.set(sunX, sunY, sunZ);
        this.sunMesh.position.set(sunX, sunY, sunZ);

        // Moon orbital position (opposite to sun)
        const moonX = Math.cos(angle + Math.PI) * radius;
        const moonY = Math.sin(angle + Math.PI) * radius;
        const moonZ = 50;
        this.moonMesh.position.set(moonX, moonY, moonZ);

        const sunHeightFactor = Math.sin(angle); 
        const nightFactor = THREE.MathUtils.clamp(-sunHeightFactor, 0.0, 1.0);

        this.sunLight.intensity = Math.max(0.0, sunHeightFactor) * 1.5;
        this.ambientLight.intensity = THREE.MathUtils.lerp(0.8, 0.15, nightFactor);

        this.scene.background.lerpColors(this.daySky, this.nightSky, nightFactor);
        if (this.scene.fog) {
            this.scene.fog.color.copy(this.scene.background);
        }

        // Update ocean night overlay
        if (this.ocean) {
            this.ocean.updateLighting(nightFactor);
        }

        // Hide celestial bodies when below horizon
        this.sunMesh.visible = sunY > -30;
        this.moonMesh.visible = moonY > -30;

        return nightFactor;
    }
}