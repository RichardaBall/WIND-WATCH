// weatherSystem.js
import * as THREE from 'three';

export class WeatherSystem {
    constructor(scene, camera, ocean, soundContextMgr) {
        this.scene = scene;
        this.camera = camera;
        this.ocean = ocean;
        this.ctxMgr = soundContextMgr;

        this.currentWeather = 'CLEAR'; 
        this.targetWeather = 'CLEAR';
        this.transitionProgress = 1.0;

        this.windVector = new THREE.Vector3(0, 0, 0);
        this.targetWindVector = new THREE.Vector3(0, 0, 0);

        // Weather configurations including SNOW_FOG
        this.configs = {
            CLEAR:     { fogDensity: 0.001, rainOpacity: 0.0, snowOpacity: 0.0, wind: new THREE.Vector3(0, 0, 0), chop: 3.7 },
            RAIN:      { fogDensity: 0.002, rainOpacity: 0.6, snowOpacity: 0.0, wind: new THREE.Vector3(1.0, 0, 0.5), chop: 4.0 },
            FOG:       { fogDensity: 0.010, rainOpacity: 0.0, snowOpacity: 0.0, wind: new THREE.Vector3(0.2, 0, 0.2), chop: 3.0 },
            RAIN_FOG:  { fogDensity: 0.008, rainOpacity: 0.6, snowOpacity: 0.0, wind: new THREE.Vector3(2.0, 0, 1.0), chop: 4.5 },
            STORM:     { fogDensity: 0.007, rainOpacity: 0.8, snowOpacity: 0.0, wind: new THREE.Vector3(8.0, 0, -6.0), chop: 6.5 },
            SNOW:      { fogDensity: 0.004, rainOpacity: 0.0, snowOpacity: 0.7, wind: new THREE.Vector3(1.5, 0, 1.0), chop: 3.0 },
            SNOW_FOG:  { fogDensity: 0.009, rainOpacity: 0.0, snowOpacity: 0.75, wind: new THREE.Vector3(2.5, 0, 1.2), chop: 3.2 }
        };

        // --- Rain Particle System Setup ---
        this.rainCount = 4000;
        this.rainGeo = new THREE.BufferGeometry();
        this.rainPositions = new Float32Array(this.rainCount * 3);
        this.rainVelocities = new Float32Array(this.rainCount * 3);

        for (let i = 0; i < this.rainCount; i++) {
            this.rainPositions[i * 3] = (Math.random() - 0.5) * 200;
            this.rainPositions[i * 3 + 1] = Math.random() * 100;
            this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 200;

            this.rainVelocities[i * 3] = 0;
            this.rainVelocities[i * 3 + 1] = -45.0 - Math.random() * 20.0;
            this.rainVelocities[i * 3 + 2] = 0;
        }

        this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

        const rainCanvas = document.createElement('canvas');
        rainCanvas.width = 16;
        rainCanvas.height = 64;
        const rainCtx = rainCanvas.getContext('2d');
        const rainGrad = rainCtx.createLinearGradient(0, 0, 0, 64);
        rainGrad.addColorStop(0, 'rgba(200, 220, 255, 0)');
        rainGrad.addColorStop(0.5, 'rgba(200, 220, 255, 0.8)');
        rainGrad.addColorStop(1, 'rgba(200, 220, 255, 0)');
        rainCtx.fillStyle = rainGrad;
        rainCtx.fillRect(0, 0, 16, 64);

        const rainTexture = new THREE.CanvasTexture(rainCanvas);

        this.rainMat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1.5,
            map: rainTexture,
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false,
            opacity: 0.0
        });

        this.rainSystem = new THREE.Points(this.rainGeo, this.rainMat);
        this.rainSystem.frustumCulled = false;
        this.scene.add(this.rainSystem);

        // --- Snow Particle System Setup ---
        this.snowCount = 3000;
        this.snowGeo = new THREE.BufferGeometry();
        this.snowPositions = new Float32Array(this.snowCount * 3);
        this.snowVelocities = new Float32Array(this.snowCount * 3);

        for (let i = 0; i < this.snowCount; i++) {
            this.snowPositions[i * 3] = (Math.random() - 0.5) * 200;
            this.snowPositions[i * 3 + 1] = Math.random() * 100;
            this.snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 200;

            this.snowVelocities[i * 3] = (Math.random() - 0.5) * 1.5;
            this.snowVelocities[i * 3 + 1] = -4.0 - Math.random() * 3.0;
            this.snowVelocities[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
        }

        this.snowGeo.setAttribute('position', new THREE.BufferAttribute(this.snowPositions, 3));

        const snowCanvas = document.createElement('canvas');
        snowCanvas.width = 32;
        snowCanvas.height = 32;
        const snowCtx = snowCanvas.getContext('2d');
        const snowGrad = snowCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
        snowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        snowGrad.addColorStop(0.5, 'rgba(240, 245, 255, 0.4)');
        snowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        snowCtx.fillStyle = snowGrad;
        snowCtx.fillRect(0, 0, 32, 32);

        const snowTexture = new THREE.CanvasTexture(snowCanvas);

        this.snowMat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 2.2,
            map: snowTexture,
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false,
            opacity: 0.0
        });

        this.snowSystem = new THREE.Points(this.snowGeo, this.snowMat);
        this.snowSystem.frustumCulled = false;
        this.scene.add(this.snowSystem);

        // --- Weather Audio & Lightning State ---
        this.rainNoiseNode = null;
        this.rainFilterNode = null;
        this.rainGainNode = null;
        this.isRainSoundPlaying = false;

        this.windNoiseNode = null;
        this.windFilterNode = null;
        this.windGainNode = null;
        this.windLfo = null;
        this.windLfoGain = null;
        this.isWindSoundPlaying = false;

        this.lastThunderTime = 0;
        this.nextThunderInterval = 10000;

        this.weatherTimer = 0;
        this.nextChangeInterval = this.getRandomInterval();
    }

    getRandomInterval() {
        return 60.0 + Math.random() * 90.0;
    }

    setWeather(weatherType) {
        if (this.configs[weatherType]) {
            this.targetWeather = weatherType;
            this.transitionProgress = 0.0;
            this.targetWindVector.copy(this.configs[weatherType].wind);
            console.log(`Weather transitioning to: ${weatherType}`);
        }
    }

    getWindForce() {
        return this.windVector;
    }

    getAudioContext() {
        const mgr = this.ctxMgr;
        let ctx = null;
        if (mgr) {
            if (mgr.audioCtx) ctx = mgr.audioCtx;
            else if (typeof mgr.getContext === 'function') ctx = mgr.getContext();
        }
        if (!ctx && typeof window !== 'undefined') {
            if (!this._fallbackAudioCtx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (AC) this._fallbackAudioCtx = new AC();
            }
            ctx = this._fallbackAudioCtx;
        }
        if (ctx && ctx.state === 'suspended') {
            ctx.resume();
        }
        return ctx;
    }

    getMasterGain(audioCtx) {
        if (this.ctxMgr && this.ctxMgr.masterGain) {
            return this.ctxMgr.masterGain;
        }
        if (!this._fallbackMasterGain && audioCtx) {
            this._fallbackMasterGain = audioCtx.createGain();
            this._fallbackMasterGain.gain.value = 1.0;
            this._fallbackMasterGain.connect(audioCtx.destination);
        }
        return this._fallbackMasterGain || (audioCtx ? audioCtx.destination : null);
    }

    startRainSound() {
        if (this.isRainSoundPlaying) return;
        const audioCtx = this.getAudioContext();
        const masterGain = this.getMasterGain(audioCtx);
        if (!audioCtx || (this.ctxMgr && this.ctxMgr.isMuted)) return;

        try {
            const now = audioCtx.currentTime;
            const bufferSize = audioCtx.sampleRate * 2;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            this.rainNoiseNode = audioCtx.createBufferSource();
            this.rainNoiseNode.buffer = buffer;
            this.rainNoiseNode.loop = true;

            this.rainFilterNode = audioCtx.createBiquadFilter();
            this.rainFilterNode.type = 'bandpass';
            this.rainFilterNode.frequency.setValueAtTime(1400, now);

            this.rainGainNode = audioCtx.createGain();
            this.rainGainNode.gain.setValueAtTime(0.0001, now);
            this.rainGainNode.gain.linearRampToValueAtTime(0.08, now + 1.0);

            this.rainNoiseNode.connect(this.rainFilterNode);
            this.rainFilterNode.connect(this.rainGainNode);
            if (masterGain) {
                this.rainGainNode.connect(masterGain);
            }

            this.rainNoiseNode.start(now);
            this.isRainSoundPlaying = true;
        } catch (e) {
            console.warn("Rain sound start error:", e);
        }
    }

    stopRainSound() {
        if (!this.isRainSoundPlaying) return;
        const audioCtx = this.getAudioContext();
        if (!audioCtx) {
            this.isRainSoundPlaying = false;
            return;
        }
        try {
            const now = audioCtx.currentTime;
            if (this.rainGainNode) {
                this.rainGainNode.gain.linearRampToValueAtTime(0.0001, now + 1.0);
            }
            setTimeout(() => {
                if (this.rainNoiseNode) {
                    this.rainNoiseNode.stop();
                    this.rainNoiseNode.disconnect();
                    this.rainNoiseNode = null;
                }
                this.isRainSoundPlaying = false;
            }, 1000);
        } catch (e) {
            this.isRainSoundPlaying = false;
        }
    }

    startWindSound(isStorm = false) {
        if (this.isWindSoundPlaying) return;
        const audioCtx = this.getAudioContext();
        const masterGain = this.getMasterGain(audioCtx);
        if (!audioCtx || (this.ctxMgr && this.ctxMgr.isMuted)) return;

        try {
            const now = audioCtx.currentTime;
            const bufferSize = audioCtx.sampleRate * 3;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            this.windNoiseNode = audioCtx.createBufferSource();
            this.windNoiseNode.buffer = buffer;
            this.windNoiseNode.loop = true;

            this.windFilterNode = audioCtx.createBiquadFilter();
            this.windFilterNode.type = 'bandpass';
            this.windFilterNode.frequency.setValueAtTime(320, now);
            this.windFilterNode.Q.setValueAtTime(3.5, now);

            this.windLfo = audioCtx.createOscillator();
            this.windLfo.type = 'sine';
            this.windLfo.frequency.setValueAtTime(0.25, now);

            this.windLfoGain = audioCtx.createGain();
            this.windLfoGain.gain.setValueAtTime(isStorm ? 180.0 : 90.0, now);

            this.windLfo.connect(this.windLfoGain);
            this.windLfoGain.connect(this.windFilterNode.frequency);

            this.windGainNode = audioCtx.createGain();
            const targetVolume = isStorm ? 0.25 : 0.08;
            this.windGainNode.gain.setValueAtTime(0.0001, now);
            this.windGainNode.gain.linearRampToValueAtTime(targetVolume, now + 1.5);

            this.windNoiseNode.connect(this.windFilterNode);
            this.windFilterNode.connect(this.windGainNode);
            if (masterGain) {
                this.windGainNode.connect(masterGain);
            }

            this.windLfo.start(now);
            this.windNoiseNode.start(now);
            this.isWindSoundPlaying = true;
        } catch (e) {
            console.warn("Wind sound start error:", e);
        }
    }

    stopWindSound() {
        if (!this.isWindSoundPlaying) return;
        const audioCtx = this.getAudioContext();
        if (!audioCtx) {
            this.isWindSoundPlaying = false;
            return;
        }
        try {
            const now = audioCtx.currentTime;
            if (this.windGainNode) {
                this.windGainNode.gain.linearRampToValueAtTime(0.0001, now + 1.0);
            }
            setTimeout(() => {
                if (this.windNoiseNode) {
                    this.windNoiseNode.stop();
                    this.windNoiseNode.disconnect();
                    this.windNoiseNode = null;
                }
                if (this.windLfo) {
                    this.windLfo.stop();
                    this.windLfo.disconnect();
                    this.windLfo = null;
                }
                this.isWindSoundPlaying = false;
            }, 1000);
        } catch (e) {
            this.isWindSoundPlaying = false;
        }
    }

    triggerLightningFlash() {
        if (this.scene) {
            const originalBg = this.scene.background ? (typeof this.scene.background.getHex === 'function' ? this.scene.background.getHex() : 0x050c19) : 0x050c19;
            if (this.scene.background && typeof this.scene.background.setHex === 'function') {
                this.scene.background.setHex(0xffffff);
            }

            const originalFogColor = this.scene.fog ? this.scene.fog.color.getHex() : null;
            if (this.scene.fog) {
                this.scene.fog.color.setHex(0xffffff);
            }

            const flashLight = new THREE.DirectionalLight(0xffffff, 5.0);
            flashLight.position.set(
                this.camera.position.x + (Math.random() - 0.5) * 100,
                this.camera.position.y + 150,
                this.camera.position.z + (Math.random() - 0.5) * 100
            );
            this.scene.add(flashLight);

            const resetLightning = () => {
                if (this.scene.background && typeof this.scene.background.setHex === 'function') {
                    this.scene.background.setHex(originalBg);
                }
                if (this.scene.fog && originalFogColor !== null) {
                    this.scene.fog.color.setHex(originalFogColor);
                }
                this.scene.remove(flashLight);
            };

            setTimeout(resetLightning, 90);

            setTimeout(() => {
                if (this.scene.background && typeof this.scene.background.setHex === 'function') {
                    this.scene.background.setHex(0xffffff);
                }
                if (this.scene.fog) {
                    this.scene.fog.color.setHex(0xffffff);
                }
            }, 150);

            setTimeout(() => {
                resetLightning();
            }, 240);
        }
    }

    playThunderSound() {
        try {
            const audioCtx = this.getAudioContext();
            const masterGain = this.getMasterGain(audioCtx);
            if (!audioCtx || (this.ctxMgr && this.ctxMgr.isMuted)) return;

            this.triggerLightningFlash();

            const now = audioCtx.currentTime;
            const duration = 5.5;

            const bufferSize = audioCtx.sampleRate * duration;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;

            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(350, now);
            filter.frequency.exponentialRampToValueAtTime(35, now + duration);

            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.8, now);
            gain.gain.setValueAtTime(0.95, now + 0.25);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            noise.connect(filter);
            filter.connect(gain);
            if (masterGain) {
                gain.connect(masterGain);
            }

            const subOsc = audioCtx.createOscillator();
            const subGain = audioCtx.createGain();

            subOsc.type = 'triangle';
            subOsc.frequency.setValueAtTime(60, now);
            subOsc.frequency.exponentialRampToValueAtTime(22, now + duration);

            subGain.gain.setValueAtTime(0.6, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            subOsc.connect(subGain);
            if (masterGain) {
                subGain.connect(masterGain);
            }

            noise.start(now);
            noise.stop(now + duration);
            subOsc.start(now);
            subOsc.stop(now + duration);
        } catch (e) {
            console.warn("Thunder sound error:", e);
        }
    }

    updateWeatherAudio(delta) {
        const audioCtx = this.getAudioContext();
        if (!audioCtx || (this.ctxMgr && this.ctxMgr.isMuted)) return;
        
        const now = audioCtx.currentTime;
        const rainOpacity = this.rainMat.opacity;
        const isStorm = (this.currentWeather === 'STORM' || this.targetWeather === 'STORM');

        const targetRainGain = (rainOpacity / 0.8) * 0.06;
        if (targetRainGain > 0.0005) {
            if (!this.isRainSoundPlaying) {
                this.startRainSound();
            }
            if (this.rainGainNode) {
                this.rainGainNode.gain.setTargetAtTime(targetRainGain, now, 0.3);
            }
        } else {
            if (this.isRainSoundPlaying) {
                if (this.rainGainNode) {
                    this.rainGainNode.gain.setTargetAtTime(0.0001, now, 0.5);
                }
                setTimeout(() => {
                    if (this.rainGainNode && this.rainGainNode.gain.value < 0.001 && this.isRainSoundPlaying) {
                        this.stopRainSound();
                    }
                }, 1000);
            }
        }

        const windSpeed = this.windVector.length();
        const targetWindGain = Math.min(0.24, Math.max(0.006, windSpeed * 0.038));
        const targetWindFreq = Math.min(480, Math.max(180, 180 + windSpeed * 35));

        if (windSpeed > 0.4 || rainOpacity > 0.05 || this.snowMat.opacity > 0.05) {
            if (!this.isWindSoundPlaying) {
                this.startWindSound(isStorm);
            }
            if (this.windGainNode) {
                this.windGainNode.gain.setTargetAtTime(targetWindGain, now, 0.4);
            }
            if (this.windFilterNode) {
                this.windFilterNode.frequency.setTargetAtTime(targetWindFreq, now, 0.4);
            }
        } else {
            if (this.isWindSoundPlaying) {
                if (this.windGainNode) {
                    this.windGainNode.gain.setTargetAtTime(0.0001, now, 0.5);
                }
            }
        }

        if (isStorm) {
            const nowMs = Date.now();
            if (this.lastThunderTime === 0) {
                this.lastThunderTime = nowMs;
                this.nextThunderInterval = 5000 + Math.random() * 7000;
            } else if (nowMs - this.lastThunderTime >= this.nextThunderInterval) {
                this.playThunderSound();
                this.lastThunderTime = nowMs;
                this.nextThunderInterval = 7000 + Math.random() * 10000;
            }
        } else {
            this.lastThunderTime = 0;
        }
    }

    update(delta) {
        this.weatherTimer += delta;
        if (this.weatherTimer >= this.nextChangeInterval) {
            this.weatherTimer = 0;
            this.nextChangeInterval = this.getRandomInterval();

            const types = ['CLEAR', 'RAIN', 'FOG', 'RAIN_FOG', 'STORM', 'SNOW', 'SNOW_FOG'];
            let nextType = types[Math.floor(Math.random() * types.length)];
            if (nextType === this.currentWeather) {
                const filteredTypes = types.filter(t => t !== this.currentWeather);
                nextType = filteredTypes[Math.floor(Math.random() * filteredTypes.length)];
            }
            this.setWeather(nextType);
        }

        if (this.transitionProgress < 1.0) {
            this.transitionProgress += delta * 0.2;
            if (this.transitionProgress > 1.0) this.transitionProgress = 1.0;

            const currentCfg = this.configs[this.currentWeather];
            const targetCfg = this.configs[this.targetWeather];

            if (this.scene.fog) {
                this.scene.fog.density = THREE.MathUtils.lerp(currentCfg.fogDensity, targetCfg.fogDensity, this.transitionProgress);
            }

            this.rainMat.opacity = THREE.MathUtils.lerp(currentCfg.rainOpacity, targetCfg.rainOpacity, this.transitionProgress);
            this.snowMat.opacity = THREE.MathUtils.lerp(currentCfg.snowOpacity, targetCfg.snowOpacity, this.transitionProgress);

            this.windVector.lerpVectors(currentCfg.wind, targetCfg.wind, this.transitionProgress);

            if (this.ocean && this.ocean.water && this.ocean.water.material.uniforms['distortionScale']) {
                const targetChop = THREE.MathUtils.lerp(currentCfg.chop, targetCfg.chop, this.transitionProgress);
                this.ocean.water.material.uniforms['distortionScale'].value = targetChop;
            }

            if (this.transitionProgress >= 1.0) {
                this.currentWeather = this.targetWeather;
            }
        }

        this.updateWeatherAudio(delta);

        if (this.rainMat.opacity > 0.0 && this.camera) {
            const positions = this.rainGeo.attributes.position.array;
            const camPos = this.camera.position;

            for (let i = 0; i < this.rainCount; i++) {
                const idx = i * 3;

                positions[idx] += (this.windVector.x + this.rainVelocities[idx]) * delta;
                positions[idx + 1] += this.rainVelocities[idx + 1] * delta;
                positions[idx + 2] += (this.windVector.z + this.rainVelocities[idx + 2]) * delta;

                if (positions[idx + 1] < 0) {
                    positions[idx + 1] = 100;
                    positions[idx] = camPos.x + (Math.random() - 0.5) * 200;
                    positions[idx + 2] = camPos.z + (Math.random() - 0.5) * 200;
                }

                if (Math.abs(positions[idx] - camPos.x) > 120) {
                    positions[idx] = camPos.x + (Math.random() - 0.5) * 200;
                }
                if (Math.abs(positions[idx + 2] - camPos.z) > 120) {
                    positions[idx + 2] = camPos.z + (Math.random() - 0.5) * 200;
                }
            }
            this.rainGeo.attributes.position.needsUpdate = true;
        }

        if (this.snowMat.opacity > 0.0 && this.camera) {
            const positions = this.snowGeo.attributes.position.array;
            const camPos = this.camera.position;

            for (let i = 0; i < this.snowCount; i++) {
                const idx = i * 3;
                const flutter = Math.sin(Date.now() * 0.002 + i) * 0.5;

                positions[idx] += (this.windVector.x + this.snowVelocities[idx] + flutter) * delta;
                positions[idx + 1] += this.snowVelocities[idx + 1] * delta;
                positions[idx + 2] += (this.windVector.z + this.snowVelocities[idx + 2]) * flutter * delta;

                if (positions[idx + 1] < 0) {
                    positions[idx + 1] = 100;
                    positions[idx] = camPos.x + (Math.random() - 0.5) * 200;
                    positions[idx + 2] = camPos.z + (Math.random() - 0.5) * 200;
                }

                if (Math.abs(positions[idx] - camPos.x) > 120) {
                    positions[idx] = camPos.x + (Math.random() - 0.5) * 200;
                }
                if (Math.abs(positions[idx + 2] - camPos.z) > 120) {
                    positions[idx + 2] = camPos.z + (Math.random() - 0.5) * 200;
                }
            }
            this.snowGeo.attributes.position.needsUpdate = true;
        }
    }
}