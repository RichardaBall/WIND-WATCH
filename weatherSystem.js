// weatherSystem.js
import * as THREE from 'three';

export class WeatherSystem {
    constructor(scene, camera, ocean, audioManager) {
        this.scene = scene;
        this.camera = camera;
        this.ocean = ocean;
        this.audioManager = audioManager;

        this.currentWeather = 'CLEAR';
        this.targetWeather = 'CLEAR';

        // Transition tracking
        this.transitionProgress = 1.0; // 1.0 = fully transitioned
        this.transitionDuration = 3.0; // Duration of weather change in seconds
        
        // Source and Target parameters for blending
        this.fromOpacity = 0.0;
        this.toOpacity = 0.0;
        this.fromFogFar = 700;
        this.toFogFar = 700;
        this.fromWind = new THREE.Vector3(1.0, 0, 0.5);
        this.toWind = new THREE.Vector3(1.0, 0, 0.5);

        this.useWeatherOverride = false;
        this.overrideWeatherType = 'CLEAR';

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

    setWeatherOverride(weatherType) {
        this.overrideWeatherType = weatherType;
        this.useWeatherOverride = true;
        this.setWeather(weatherType);
    }

    clearWeatherOverride() {
        this.useWeatherOverride = false;
    }

    setWeather(weatherType) {
        if (this.targetWeather === weatherType) return;
        
        // Capture current active states as starting points for the smooth blend
        this.currentWeather = this.targetWeather;
        this.targetWeather = weatherType;
        this.transitionProgress = 0.0; // Reset transition timer

        this.fromOpacity = this.material.opacity;
        this.fromFogFar = this.scene.fog ? this.scene.fog.far : 700;
        this.fromWind.copy(this.windForce);

        console.log(`🌧️ Weather transitioning from ${this.currentWeather} to ${this.targetWeather}...`);

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

        // Define target states
        if (this.targetWeather === 'CLEAR') {
            this.toOpacity = 0.0;
            this.toWind.set(1.0, 0, 0.5);
            this.toFogFar = 700;
        } else if (this.targetWeather === 'RAIN') {
            this.toOpacity = 0.85;
            this.material.color.setHex(0xa0c0e0);
            this.material.size = 2.5;
            this.toWind.set(3.0, 0, 2.0);
            this.toFogFar = 400;
        } else if (this.targetWeather === 'FOG') {
            this.toOpacity = 0.0;
            this.toWind.set(0.5, 0, 0.5);
            this.toFogFar = 150;
        } else if (this.targetWeather === 'RAIN_FOG') {
            this.toOpacity = 0.8;
            this.material.color.setHex(0xa0c0e0);
            this.material.size = 2.5;
            this.toWind.set(3.0, 0, 2.0);
            this.toFogFar = 180;
        } else if (this.targetWeather === 'SNOW') {
            this.toOpacity = 0.9;
            this.material.color.setHex(0xffffff);
            this.material.size = 3.5;
            this.toWind.set(0.5, 0, 0.5);
            this.toFogFar = 400;
        } else if (this.targetWeather === 'SNOW_FOG') {
            this.toOpacity = 0.85;
            this.material.color.setHex(0xffffff);
            this.material.size = 3.5;
            this.toWind.set(0.5, 0, 0.5);
            this.toFogFar = 180;
        } else if (this.targetWeather === 'STORM') {
            this.toOpacity = 0.95;
            this.material.color.setHex(0x80a0c0);
            this.material.size = 3.0;
            this.toWind.set(9.0, 0, 7.0);
            this.toFogFar = 250;
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
        if (!this.useWeatherOverride) {
            const weatherTypes = ['CLEAR', 'RAIN', 'FOG', 'STORM', 'SNOW'];
            const weatherIndex = Math.floor(Date.now() / 120000);
            const targetWeather = weatherTypes[weatherIndex % weatherTypes.length];
            if (this.targetWeather !== targetWeather) {
                this.setWeather(targetWeather);
            }
        }

        // --- Smooth Transition Interpolation (Lerp) ---
        if (this.transitionProgress < 1.0) {
            this.transitionProgress = Math.min(1.0, this.transitionProgress + delta / this.transitionDuration);
            
            // Interpolate particle opacity
            this.material.opacity = THREE.MathUtils.lerp(this.fromOpacity, this.toOpacity, this.transitionProgress);

            // Interpolate wind forces smoothly
            this.windForce.lerpVectors(this.fromWind, this.toWind, this.transitionProgress);

            // Interpolate fog distance smoothly
            if (this.scene.fog) {
                this.scene.fog.far = THREE.MathUtils.lerp(this.fromFogFar, this.toFogFar, this.transitionProgress);
            }
        }

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
        const currentTime = performance.now() * 0.001;

        for (let i = 0; i < this.particleCount; i++) {
            let idx = i * 3;

            if (isSnow) {
                positions[idx] += (this.windForce.x + Math.sin(currentTime * 2.0 + i) * 1.5) * delta;
                positions[idx + 1] += (-12.0) * delta;
                positions[idx + 2] += (this.windForce.z + Math.cos(currentTime * 2.0 + i) * 1.5) * delta;
            } else {
                positions[idx] += this.windForce.x * delta;
                positions[idx + 1] += this.targetWeather === 'STORM' ? -110 * delta : -80 * delta;
                positions[idx + 2] += this.windForce.z * delta;
            }

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