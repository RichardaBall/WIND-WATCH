export class AudioManager {
    constructor() {
        this.startupAudio = new Audio('enginestartup.mp3');
        this.shutdownAudio = new Audio('engineshutdown.mp3');
        this.gearAudio = new Audio('gear.mp3');

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
        this.rotorBuffer = null;
        this.rotorSource = null;

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

    playStartup(onEnded) {
        if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
        this.startupAudio.onended = onEnded;
        this.startupAudio.currentTime = 0;
        this.startupAudio.play().catch(e => console.log("Startup audio play prevented:", e));
    }

    playShutdown(onEnded) {
        if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
        this.shutdownAudio.onended = onEnded;
        this.shutdownAudio.currentTime = 0;
        this.shutdownAudio.play().catch(e => console.log("Shutdown audio play prevented:", e));
    }

    playGear() {
        if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
        this.gearAudio.currentTime = 0;
        this.gearAudio.play().catch(e => console.log("Gear audio play prevented:", e));
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

    stopAllAudio() {
        this.stopRotor();
        this.startupAudio.pause();
        this.startupAudio.currentTime = 0;
        this.shutdownAudio.pause();
        this.shutdownAudio.currentTime = 0;
        this.gearAudio.pause();
        this.gearAudio.currentTime = 0;
    }

    startRotor() {
        if (this.audioCtx && this.rotorBuffer && !this.rotorSource) {
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            this.rotorSource = this.audioCtx.createBufferSource();
            this.rotorSource.buffer = this.rotorBuffer;
            this.rotorSource.loop = true;
            this.rotorSource.connect(this.audioCtx.destination);
            this.rotorSource.start(0);
        }
    }

    stopRotor() {
        if (this.rotorSource) {
            try {
                this.rotorSource.stop();
            } catch (e) {}
            this.rotorSource.disconnect();
            this.rotorSource = null;
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