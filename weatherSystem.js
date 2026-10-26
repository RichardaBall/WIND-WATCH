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
        this.particleCount = 2000;
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.particleCount * 3);
        this.velocities = new Float32Array(this.particleCount * 3);

        for (let i = 0; i < this.particleCount; i++) {
            this.positions[i * 3] = (Math.random() - 0.5) * 200;
            this.positions[i * 3 + 1] = Math.random() * 150;
            this.positions[i * 3 + 2] = (Math.random() - 0.5) * 200;

            this.velocities[i * 3] = 0;
            this.velocities[i * 3 + 1] = -40;
            this.velocities[i * 3 + 2] = 0;
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(16, 16, 8, 0, Math.PI * 2);
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);

        this.material = new THREE.PointsMaterial({
            color: 0xaaaaaa,
            size: 1.5,
            map: texture,
            transparent: true,
            opacity: 0.0,
            depthWrite: false
        });

        this.particleSystem = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.particleSystem);
    }

    setWeather(weatherType) {
        if (this.targetWeather === weatherType) return;
        this.targetWeather = weatherType;
        this.currentWeather = weatherType;

        console.log(`🌧️ Weather applied locally: ${this.targetWeather}`);

        if (this.targetWeather === 'CLEAR') {
            this.material.opacity = 0.0;
            this.windForce.set(1.0, 0, 0.5);
            if (this.ocean) this.ocean.setChoppiness(1.0);
        } else if (this.targetWeather === 'RAIN') {
            this.material.opacity = 0.6;
            this.material.color.setHex(0xaaaaaa);
            this.material.size = 1.2;
            this.windForce.set(3.0, 0, 2.0);
            if (this.ocean) this.ocean.setChoppiness(2.5);
        } else if (this.targetWeather === 'STORM') {
            this.material.opacity = 0.8;
            this.material.color.setHex(0x777777);
            this.material.size = 2.0;
            this.windForce.set(7.0, 0, 5.0);
            if (this.ocean) this.ocean.setChoppiness(5.0);
        } else if (this.targetWeather === 'SNOW') {
            this.material.opacity = 0.7;
            this.material.color.setHex(0xffffff);
            this.material.size = 2.5;
            this.windForce.set(0.5, 0, 0.5);
            if (this.ocean) this.ocean.setChoppiness(1.5);
        }
    }

    getWindForce() {
        return this.windForce;
    }

    update(delta) {
        const positions = this.geometry.attributes.position.array;
        const camPos = this.camera.position;

        for (let i = 0; i < this.particleCount; i++) {
            let idx = i * 3;

            positions[idx] += this.velocities[idx] * delta + this.windForce.x * delta;
            positions[idx + 1] += this.velocities[idx + 1] * delta;
            positions[idx + 2] += this.velocities[idx + 2] * delta + this.windForce.z * delta;

            // Loop particles around camera position
            if (positions[idx + 1] < 0) {
                positions[idx + 1] = 120;
                positions[idx] = camPos.x + (Math.random() - 0.5) * 200;
                positions[idx + 2] = camPos.z + (Math.random() - 0.5) * 200;
            }

            if (positions[idx] > camPos.x + 100) positions[idx] = camPos.x - 100;
            if (positions[idx] < camPos.x - 100) positions[idx] = camPos.x + 100;
            if (positions[idx + 2] > camPos.z + 100) positions[idx + 2] = camPos.z - 100;
            if (positions[idx + 2] < camPos.z - 100) positions[idx + 2] = camPos.z + 100;
        }

        this.geometry.attributes.position.needsUpdate = true;
    }
}