export class AudioManager {
    constructor() {
        this.startupAudio = new Audio('enginestartup.mp3');
        this.shutdownAudio = new Audio('engineshutdown.mp3');
        this.gearAudio = new Audio('gear.mp3');
        this.lowFuelAudio = new Audio('lowfuel.mp3');

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
        this.rotorBuffer = null;
        this.rotorSource = null;
        this.rotorGainNode = null;
        this.sprayNoiseSource = null;
        this.sprayGainNode = null;
        this.winchNoiseSource = null;
        this.winchGainNode = null;

        // Auto-unlock audio context on user interaction
        const unlockAudio = () => {
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            if (this.audioCtx && this.audioCtx.state === 'running') {
                window.removeEventListener('pointerdown', unlockAudio);
                window.removeEventListener('keydown', unlockAudio);
            }
        };
        window.addEventListener('pointerdown', unlockAudio);
        window.addEventListener('keydown', unlockAudio);

        // Load continuous rotor sound buffer
        fetch('rotorsound.mp3')
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => this.audioCtx.decodeAudioData(arrayBuffer))
            .then(buffer => {
                this.rotorBuffer = buffer;
            })
            .catch(e => console.warn("Error loading rotor sound buffer:", e));
    }

    playStartup(onBlendingPoint, onEnded) {
        if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
        this.startupAudio.onended = onEnded;
        this.startupAudio.currentTime = 0;

        let blendedTriggered = false;
        const checkOverlap = () => {
            if (!blendedTriggered && this.startupAudio.duration) {
                // Trigger rotor blending 0.8 seconds before startup finishes
                if (this.startupAudio.currentTime >= this.startupAudio.duration - 0.8) {
                    blendedTriggered = true;
                    if (typeof onBlendingPoint === 'function') onBlendingPoint();
                }
            }
            if (!this.startupAudio.paused && !this.startupAudio.ended) {
                requestAnimationFrame(checkOverlap);
            }
        };

        this.startupAudio.play().then(() => {
            checkOverlap();
        }).catch(e => console.log("Startup audio play prevented:", e));
    }

    playShutdown(onBlendingPoint, onEnded) {
        if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
        this.shutdownAudio.onended = onEnded;
        this.shutdownAudio.currentTime = 0;
        this.shutdownAudio.play().catch(e => console.log("Shutdown audio play prevented:", e));

        if (typeof onBlendingPoint === 'function') {
            onBlendingPoint(); // Trigger shutdown audio overlapping with running rotor
        }
    }

    playGear() {
        if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
        this.gearAudio.currentTime = 0;
        this.gearAudio.play().catch(e => console.log("Gear audio play prevented:", e));
    }

    playLowFuel() {
        if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
        this.lowFuelAudio.currentTime = 0;
        this.lowFuelAudio.play().catch(e => console.log("Low fuel audio play prevented:", e));
    }

    playExplosion() {
        this.stopAllAudio();

        try {
            if (this.audioCtx) {
                if (this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }

                const now = this.audioCtx.currentTime;
                const duration = 2.0;

                const bufferSize = this.audioCtx.sampleRate * duration;
                const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }

                const noise = this.audioCtx.createBufferSource();
                noise.buffer = buffer;

                const filter = this.audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(800, now);
                filter.frequency.exponentialRampToValueAtTime(40, now + duration);

                const gain = this.audioCtx.createGain();
                gain.gain.setValueAtTime(1.0, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.audioCtx.destination);

                noise.start(now);
                noise.stop(now + duration);
            }
        } catch (e) {
            console.warn("Procedural explosion audio playback error:", e);
        }
    }

    playSplash() {
        this.stopAllAudio();

        try {
            if (this.audioCtx) {
                if (this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }

                const now = this.audioCtx.currentTime;
                const duration = 1.8;

                const bufferSize = this.audioCtx.sampleRate * duration;
                const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }

                const noise = this.audioCtx.createBufferSource();
                noise.buffer = buffer;

                const filter = this.audioCtx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(500, now);
                filter.frequency.exponentialRampToValueAtTime(120, now + duration);

                const gain = this.audioCtx.createGain();
                gain.gain.setValueAtTime(0.8, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.audioCtx.destination);

                noise.start(now);
                noise.stop(now + duration);
            }
        } catch (e) {
            console.warn("Procedural splash audio playback error:", e);
        }
    }

    startWaterSpray() {
        if (this.audioCtx && !this.sprayNoiseSource) {
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            try {
                const bufferSize = this.audioCtx.sampleRate * 2;
                const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }

                this.sprayNoiseSource = this.audioCtx.createBufferSource();
                this.sprayNoiseSource.buffer = buffer;
                this.sprayNoiseSource.loop = true;

                const filter = this.audioCtx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(1000, this.audioCtx.currentTime);
                filter.Q.setValueAtTime(0.8, this.audioCtx.currentTime);

                this.sprayGainNode = this.audioCtx.createGain();
                this.sprayGainNode.gain.setValueAtTime(0.0, this.audioCtx.currentTime);
                this.sprayGainNode.gain.linearRampToValueAtTime(0.4, this.audioCtx.currentTime + 0.1);

                this.sprayNoiseSource.connect(filter);
                filter.connect(this.sprayGainNode);
                this.sprayGainNode.connect(this.audioCtx.destination);

                this.sprayNoiseSource.start(0);
            } catch (e) {
                console.warn("Error starting water spray audio:", e);
            }
        }
    }

    stopWaterSpray() {
        if (this.sprayNoiseSource && this.sprayGainNode) {
            try {
                const now = this.audioCtx.currentTime;
                this.sprayGainNode.gain.setValueAtTime(this.sprayGainNode.gain.value, now);
                this.sprayGainNode.gain.linearRampToValueAtTime(0.001, now + 0.1);

                setTimeout(() => {
                    if (this.sprayNoiseSource) {
                        try { this.sprayNoiseSource.stop(); } catch(e) {}
                        this.sprayNoiseSource.disconnect();
                        this.sprayNoiseSource = null;
                        this.sprayGainNode = null;
                    }
                }, 100);
            } catch (e) {
                this.sprayNoiseSource = null;
                this.sprayGainNode = null;
            }
        }
    }

    startWinch() {
        if (this.audioCtx && !this.winchNoiseSource) {
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            try {
                const bufferSize = this.audioCtx.sampleRate * 2;
                const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }

                this.winchNoiseSource = this.audioCtx.createBufferSource();
                this.winchNoiseSource.buffer = buffer;
                this.winchNoiseSource.loop = true;

                const filter = this.audioCtx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(350, this.audioCtx.currentTime);
                filter.Q.setValueAtTime(2.0, this.audioCtx.currentTime);

                this.winchGainNode = this.audioCtx.createGain();
                this.winchGainNode.gain.setValueAtTime(0.0, this.audioCtx.currentTime);
                this.winchGainNode.gain.linearRampToValueAtTime(0.3, this.audioCtx.currentTime + 0.1);

                this.winchNoiseSource.connect(filter);
                filter.connect(this.winchGainNode);
                this.winchGainNode.connect(this.audioCtx.destination);

                this.winchNoiseSource.start(0);
            } catch (e) {
                console.warn("Error starting winch audio:", e);
            }
        }
    }

    stopWinch() {
        if (this.winchNoiseSource && this.winchGainNode) {
            try {
                const now = this.audioCtx.currentTime;
                this.winchGainNode.gain.setValueAtTime(this.winchGainNode.gain.value, now);
                this.winchGainNode.gain.linearRampToValueAtTime(0.001, now + 0.1);

                setTimeout(() => {
                    if (this.winchNoiseSource) {
                        try { this.winchNoiseSource.stop(); } catch(e) {}
                        this.winchNoiseSource.disconnect();
                        this.winchNoiseSource = null;
                        this.winchGainNode = null;
                    }
                }, 100);
            } catch (e) {
                this.winchNoiseSource = null;
                this.winchGainNode = null;
            }
        }
    }

    stopAllAudio() {
        this.stopRotor();
        this.stopWaterSpray();
        this.stopWinch();
        this.startupAudio.pause();
        this.startupAudio.currentTime = 0;
        this.shutdownAudio.pause();
        this.shutdownAudio.currentTime = 0;
        this.gearAudio.pause();
        this.gearAudio.currentTime = 0;
        this.lowFuelAudio.pause();
        this.lowFuelAudio.currentTime = 0;
    }

    startRotor() {
        if (this.audioCtx && this.rotorBuffer && !this.rotorSource) {
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            this.rotorSource = this.audioCtx.createBufferSource();
            this.rotorSource.buffer = this.rotorBuffer;
            this.rotorSource.loop = true;

            this.rotorGainNode = this.audioCtx.createGain();
            this.rotorGainNode.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

            this.rotorSource.connect(this.rotorGainNode);
            this.rotorGainNode.connect(this.audioCtx.destination);
            this.rotorSource.start(0);
        }
    }

    stopRotor() {
        if (this.rotorSource && this.audioCtx) {
            try {
                const now = this.audioCtx.currentTime;
                if (this.rotorGainNode) {
                    // Fade out rotor sound slightly over 1 second during shutdown overlap
                    this.rotorGainNode.gain.setValueAtTime(this.rotorGainNode.gain.value, now);
                    this.rotorGainNode.gain.linearRampToValueAtTime(0.001, now + 1.2);
                }
                setTimeout(() => {
                    if (this.rotorSource) {
                        try { this.rotorSource.stop(); } catch(e) {}
                        this.rotorSource.disconnect();
                        this.rotorSource = null;
                        this.rotorGainNode = null;
                    }
                }, 1200);
            } catch (e) {
                this.rotorSource = null;
                this.rotorGainNode = null;
            }
        }
    }

    getStartupDuration() {
        return this.startupAudio.duration;
    }

    getStartupCurrentTime() {
        return this.startupAudio.currentTime;
    }

    getShutdownDuration() {
        return this.shutdownAudio.duration;
    }

    getShutdownCurrentTime() {
        return this.shutdownAudio.currentTime;
    }
}