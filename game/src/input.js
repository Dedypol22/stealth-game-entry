export const INPUT = {
    keys: {},
    mouse: { x: 0, y: 0, clicked: false },
    lastClick: null,
    
    init(canvas) {
        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            if (e.code === 'KeyP' || e.code === 'Escape') this.onPause?.();
            if (e.code === 'KeyR') this.onRestart?.();
            if (e.code === 'KeyM') this.onMute?.();
            if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) this.onLevelSelect?.(parseInt(e.key));
        });
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
        });
        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        canvas.addEventListener('mousedown', e => {
            const rect = canvas.getBoundingClientRect();
            this.lastClick = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            this.mouse.clicked = true;
            this.onClick?.(this.lastClick);
        });
        canvas.addEventListener('mouseup', () => {
            this.mouse.clicked = false;
        });
    },

    isDown(code) {
        return !!this.keys[code];
    }
};
