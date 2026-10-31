// fpsCounter.js
// Performance overlay, toggled with the F key: frame rate, frame time, draw calls and GPU memory counts.

export class FpsCounter {
    constructor(renderer) {
        this.renderer = renderer;
        this.visible = false;

        this.frames = 0;
        this.windowStart = performance.now();
        this.lastFrameTime = this.windowStart;
        this.worstFrameMs = 0;
        this.refreshInterval = 500;

        this.createOverlay();

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyF' && !e.repeat) {
                this.setVisible(!this.visible);
            }
        });
    }

    createOverlay() {
        this.element = document.createElement('div');
        this.element.id = 'fps-counter';
        this.element.style.cssText = `
            position: fixed;
            top: 64px;
            left: 20px;
            padding: 6px 10px;
            background: rgba(0, 0, 0, 0.55);
            border-radius: 4px;
            color: #ffffff;
            font-family: monospace;
            font-size: 12px;
            line-height: 1.5;
            white-space: pre;
            pointer-events: none;
            z-index: 999;
            display: none;
        `;
        document.body.appendChild(this.element);
    }

    setVisible(visible) {
        this.visible = visible;
        this.element.style.display = visible ? 'block' : 'none';
    }

    // Call once per frame, after renderer.render(), so renderer.info holds this frame's numbers
    update() {
        const now = performance.now();
        const frameMs = now - this.lastFrameTime;
        this.lastFrameTime = now;
        this.frames++;
        if (frameMs > this.worstFrameMs) this.worstFrameMs = frameMs;

        const elapsed = now - this.windowStart;
        if (elapsed < this.refreshInterval) return;

        if (this.visible) {
            const fps = (this.frames * 1000) / elapsed;
            const avgMs = elapsed / this.frames;
            const info = this.renderer.info;
            const fpsColor = fps >= 50 ? '#4ade80' : (fps >= 30 ? '#facc15' : '#f87171');

            const lines = [
                `<span style="color: ${fpsColor}; font-weight: bold;">FPS ${fps.toFixed(0)}</span>`,
                `frame ${avgMs.toFixed(1)} ms  worst ${this.worstFrameMs.toFixed(1)} ms`,
                `draw calls ${info.render.calls}  tris ${(info.render.triangles / 1000).toFixed(1)}k`,
                `geometries ${info.memory.geometries}  textures ${info.memory.textures}`
            ];
            // performance.memory only exists in Chromium browsers
            if (performance.memory) {
                lines.push(`JS heap ${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)} MB`);
            }
            this.element.innerHTML = lines.join('\n');
        }

        this.frames = 0;
        this.worstFrameMs = 0;
        this.windowStart = now;
    }
}
