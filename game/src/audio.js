class AudioManager {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.masterVolume = 0.5;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setMuted(m) {
        this.muted = m;
    }

    playOsc(freq, type, volume, duration, attack = 0.01, decay = 0.1) {
        if (!this.ctx || this.muted) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(volume * this.masterVolume, this.ctx.currentTime + attack);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playNoise(volume, duration, lowPass = 1000, pan = 0) {
        if (!this.ctx || this.muted) return;
        const bufferSize = 2 * this.ctx.sampleRate;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = lowPass;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume * this.masterVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        whiteNoise.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(this.ctx.destination);
        whiteNoise.start();
        whiteNoise.stop(this.ctx.currentTime + duration);
    }

    footstep(pan = 0, vol = 0.1) {
        this.playNoise(vol, 0.1, 400, pan);
    }

    suspicious() {
        this.playOsc(440, 'triangle', 0.2, 0.2);
        setTimeout(() => this.playOsc(660, 'triangle', 0.2, 0.2), 100);
    }

    alarm() {
        this.playOsc(880, 'sawtooth', 0.1, 0.5);
        setTimeout(() => this.playOsc(440, 'sawtooth', 0.1, 0.5), 250);
    }

    pickup() {
        this.playOsc(1000, 'sine', 0.3, 0.3, 0.05, 0.2);
        setTimeout(() => this.playOsc(1500, 'sine', 0.3, 0.3, 0.05, 0.2), 100);
    }

    pebble() {
        this.playOsc(1200, 'sine', 0.1, 0.05);
        setTimeout(() => this.playNoise(0.2, 0.1, 2000), 10);
    }

    win() {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((f, i) => {
            setTimeout(() => this.playOsc(f, 'sine', 0.3, 0.5), i * 150);
        });
    }
}

export const AUDIO = new AudioManager();
