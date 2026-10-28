import * as THREE from 'three';

export class WeatherSystem {
    constructor(scene, camera, ocean, audioManager) {
        this.scene = scene;
        this.camera = camera;
        this.ocean = ocean;
        this.audioManager = audioManager;

        this.currentWeather = 'CLEAR';
        this.targetWeather = 'CLEAR';

        this.windForce = new THREE.Vector3(1.0, 0, 0.5);

        // --- Particle Systems for Rain / Snow ---
        this.particleCount = 3000;
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.particleCount * 3);
        this.velocities = new Float32Array(this.particleCount * 3);

        for (let i = 0; i < this.particleCount; i++) {
            this.positions[i * 3] = (Math.random() - 0.5) * 250;
            this.positions[i * 3 + 1] = Math.random() * 150;
            this.positions[i * 3 + 2] = (Math.random() - 0.5) * 250;

            this.velocities[i * 3] = 0;
            this.velocities[i * 3 + 1] = -70;
            this.velocities[i * 3 + 2] = 0;
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(16, 16, 12, 0, Math.PI * 2);
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);

        this.material = new THREE.PointsMaterial({
            color: 0xa0c0e0,
            size: 2.8,
            map: texture,
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.particleSystem = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.particleSystem);

        this.lightningTimer = 0;
        this.nextLightningTime = 5.0;
    }

    setWeather(weatherType) {
        if (this.targetWeather === weatherType) return;
        this.targetWeather = weatherType;
        this.currentWeather = weatherType;

        console.log(`🌧️ Weather applied locally: ${this.targetWeather}`);

        const fog = this.scene.fog;

        // Manage audio state based on weather
        if (this.audioManager) {
            if (weatherType === 'RAIN' || weatherType === 'RAIN_FOG' || weatherType === 'STORM') {
                this.audioManager.startRain();
            } else {
                this.audioManager.stopRain();
            }

            if (weatherType === 'STORM') {
                this.audioManager.startWind(0.3);
            } else if (weatherType === 'FOG' || weatherType === 'RAIN_FOG' || weatherType === 'SNOW' || weatherType === 'SNOW_FOG') {
                this.audioManager.startWind(0.18);
            } else {
                this.audioManager.startWind(0.08);
            }
        }

        if (this.targetWeather === 'CLEAR') {
            this.material.opacity = 0.0;
            this.windForce.set(1.0, 0, 0.5);
            if (fog) fog.density = 0.001;
        } else if (this.targetWeather === 'RAIN') {
            this.material.opacity = 0.85;
            this.material.color.setHex(0xa0c0e0);
            this.material.size = 2.5;
            this.windForce.set(3.0, 0, 2.0);
            if (fog) fog.density = 0.004;
        } else if (this.targetWeather === 'FOG') {
            this.material.opacity = 0.0;
            this.windForce.set(0.5, 0, 0.5);
            if (fog) fog.density = 0.022;
        } else if (this.targetWeather === 'RAIN_FOG') {
            this.material.opacity = 0.8;
            this.material.color.setHex(0xa0c0e0);
            this.material.size = 2.5;
            this.windForce.set(3.0, 0, 2.0);
            if (fog) fog.density = 0.016;
        } else if (this.targetWeather === 'SNOW') {
            this.material.opacity = 0.9;
            this.material.color.setHex(0xffffff);
            this.material.size = 3.5;
            this.windForce.set(0.5, 0, 0.5);
            if (fog) fog.density = 0.004;
        } else if (this.targetWeather === 'SNOW_FOG') {
            this.material.opacity = 0.85;
            this.material.color.setHex(0xffffff);
            this.material.size = 3.5;
            this.windForce.set(0.5, 0, 0.5);
            if (fog) fog.density = 0.016;
        } else if (this.targetWeather === 'STORM') {
            this.material.opacity = 0.95;
            this.material.color.setHex(0x80a0c0);
            this.material.size = 3.0;
            this.windForce.set(9.0, 0, 7.0);
            if (fog) fog.density = 0.010;
            this.lightningTimer = 0;
            this.nextLightningTime = 3.0 + Math.random() * 4.0;
        }
    }

    triggerLightningFlash() {
        if (this.audioManager && typeof this.audioManager.playThunder === 'function') {
            setTimeout(() => {
                this.audioManager.playThunder();
            }, 800 + Math.random() * 600);
        }

        const originalBg = this.scene.background.clone();
        this.scene.background.setHex(0xaaccff);
        if (this.scene.fog) {
            this.scene.fog.color.setHex(0xaaccff);
        }

        setTimeout(() => {
            this.scene.background.copy(originalBg);
            if (this.scene.fog) {
                this.scene.fog.color.copy(originalBg);
            }
        }, 120);

        if (Math.random() < 0.4) {
            setTimeout(() => {
                this.scene.background.setHex(0xffffff);
                if (this.scene.fog) this.scene.fog.color.setHex(0xffffff);
                setTimeout(() => {
                    this.scene.background.copy(originalBg);
                    if (this.scene.fog) this.scene.fog.color.copy(originalBg);
                }, 80);
            }, 200);
        }
    }

    getWindForce() {
        return this.windForce;
    }

    update(delta) {
        if (this.targetWeather === 'STORM') {
            this.lightningTimer += delta;
            if (this.lightningTimer >= this.nextLightningTime) {
                this.lightningTimer = 0;
                this.nextLightningTime = 4.0 + Math.random() * 6.0;
                this.triggerLightningFlash();
            }
        }

        const positions = this.geometry.attributes.position.array;
        const camPos = this.camera.position;
        const isSnow = this.targetWeather === 'SNOW' || this.targetWeather === 'SNOW_FOG';

        for (let i = 0; i < this.particleCount; i++) {
            let idx = i * 3;

            if (isSnow) {
                positions[idx] += (this.windForce.x + Math.sin(Date.now() * 0.002 + i) * 1.5) * delta;
                positions[idx + 1] += (-12.0) * delta;
                positions[idx + 2] += (this.windForce.z + Math.cos(Date.now() * 0.002 + i) * 1.5) * delta;
            } else {
                positions[idx] += this.windForce.x * delta;
                positions[idx + 1] += this.targetWeather === 'STORM' ? -110 * delta : -80 * delta;
                positions[idx + 2] += this.windForce.z * delta;
            }

            // Loop particles around camera position
            if (positions[idx + 1] < 0) {
                positions[idx + 1] = 140;
                positions[idx] = camPos.x + (Math.random() - 0.5) * 250;
                positions[idx + 2] = camPos.z + (Math.random() - 0.5) * 250;
            }

            if (positions[idx] > camPos.x + 125) positions[idx] = camPos.x - 125;
            if (positions[idx] < camPos.x - 125) positions[idx] = camPos.x + 125;
            if (positions[idx + 2] > camPos.z + 125) positions[idx + 2] = camPos.z - 125;
            if (positions[idx + 2] < camPos.z - 125) positions[idx + 2] = camPos.z + 125;
        }

        this.geometry.attributes.position.needsUpdate = true;
    }
}