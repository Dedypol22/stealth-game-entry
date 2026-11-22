import { CONFIG } from './config.js';
import { LEVELS } from './levels.js';

const PALETTES = [
    { floor: '#2a2139', wall: '#3b2f4a', cover: '#4d3f68', edge: '#4a3a5e', glow: '#ffcf86' },
    { floor: '#16202a', wall: '#233442', cover: '#2f4757', edge: '#345061', glow: '#9fd3ff' },
    { floor: '#2b2416', wall: '#3d3320', cover: '#5c4a26', edge: '#6b5830', glow: '#ffd75e' }
];

export class Renderer {
    constructor(canvas, world) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.world = world;
        this.dom = {
            detection: document.getElementById('detection-bar'),
            artifacts: document.getElementById('artifacts-count'),
            lives: document.getElementById('lives'),
            timer: document.getElementById('timer'),
            score: document.getElementById('score'),
            level: document.getElementById('level-name'),
            warning: document.getElementById('warning'),
            toast: document.getElementById('toast')
        };
    }

    render() {
        this.drawWorld();
        this.drawEdgeWarning();
        this.updateHUD();
        this.drawScreens();
    }

    drawWorld() {
        const ctx = this.ctx;
        const world = this.world;
        const level = LEVELS[world.levelIndex];
        const pal = PALETTES[world.levelIndex] || PALETTES[0];

        // Clear
        ctx.fillStyle = pal.floor;
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

        // Draw Map (Floor patterns, shadows, lights)
        for (let y = 0; y < level.map.length; y++) {
            for (let x = 0; x < level.map[y].length; x++) {
                const char = level.map[y][x];
                const px = x * CONFIG.TILE_SIZE;
                const py = y * CONFIG.TILE_SIZE;

                // subtle floor seams
                if (char !== 'W') {
                    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
                    ctx.strokeRect(px + 0.5, py + 0.5, CONFIG.TILE_SIZE - 1, CONFIG.TILE_SIZE - 1);
                }

                if (char === 'W') {
                    ctx.fillStyle = pal.wall;
                    ctx.fillRect(px, py, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                    ctx.fillStyle = 'rgba(255,255,255,0.07)';
                    ctx.fillRect(px, py, CONFIG.TILE_SIZE, 4);
                    ctx.strokeStyle = pal.edge;
                    ctx.strokeRect(px + 0.5, py + 0.5, CONFIG.TILE_SIZE - 1, CONFIG.TILE_SIZE - 1);
                } else if (char === 'C') {
                    ctx.fillStyle = pal.cover;
                    ctx.fillRect(px + 4, py + 4, CONFIG.TILE_SIZE - 8, CONFIG.TILE_SIZE - 8);
                    ctx.strokeStyle = pal.edge;
                    ctx.lineWidth = 3;
                    ctx.strokeRect(px + 4, py + 4, CONFIG.TILE_SIZE - 8, CONFIG.TILE_SIZE - 8);
                    ctx.lineWidth = 1;
                    ctx.fillStyle = 'rgba(255,255,255,0.10)';
                    ctx.fillRect(px + 10, py + 10, CONFIG.TILE_SIZE - 20, 8);
                } else if (char === 'S') {
                    ctx.fillStyle = CONFIG.COLORS.SHADOW;
                    ctx.fillRect(px, py, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                } else if (char === 'L') {
                    const g = ctx.createRadialGradient(
                        px + CONFIG.TILE_SIZE / 2, py + CONFIG.TILE_SIZE / 2, 4,
                        px + CONFIG.TILE_SIZE / 2, py + CONFIG.TILE_SIZE / 2, CONFIG.TILE_SIZE * 2.1
                    );
                    g.addColorStop(0, 'rgba(255, 235, 170, 0.30)');
                    g.addColorStop(1, 'rgba(255, 235, 170, 0)');
                    ctx.fillStyle = g;
                    ctx.fillRect(px - CONFIG.TILE_SIZE * 2, py - CONFIG.TILE_SIZE * 2, CONFIG.TILE_SIZE * 5, CONFIG.TILE_SIZE * 5);
                    ctx.fillStyle = pal.glow;
                    ctx.fillRect(px + 20, py + 20, CONFIG.TILE_SIZE - 40, CONFIG.TILE_SIZE - 40);
                }
            }
        }

        this.drawDecor(pal);

        // Exit
        const exit = level.exit;
        ctx.fillStyle = CONFIG.COLORS.EXIT;
        ctx.beginPath();
        ctx.arc(exit[0], exit[1], 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.lineWidth = 1;

        // Artifacts
        for (const a of world.artifacts) {
            if (!a.collected) {
                ctx.fillStyle = CONFIG.COLORS.ARTIFACT;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y - 15);
                ctx.lineTo(a.x + 12, a.y + 10);
                ctx.lineTo(a.x - 12, a.y + 10);
                ctx.fill();
                // Glow
                ctx.shadowBlur = 15;
                ctx.shadowColor = CONFIG.COLORS.ARTIFACT;
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        }

        // Pebble
        if (world.activePebble) {
            ctx.fillStyle = '#888';
            ctx.beginPath();
            ctx.arc(world.activePebble.x, world.activePebble.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Noise Rings
        for (const r of world.noiseRings) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${1 - r.r / r.maxR})`;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Vision Cones
        for (const g of world.guards) {
            this.drawCone(g.cone, g.state);
        }
        for (const c of world.cameras) {
            this.drawCone(c.cone, 'CALM');
        }

        // Guards
        for (const g of world.guards) {
            ctx.save();
            ctx.translate(g.x, g.y);
            ctx.rotate(g.angle);
            ctx.fillStyle = CONFIG.COLORS.GUARD;
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.fill();
            // Direction indicator
            ctx.fillStyle = '#000';
            ctx.fillRect(5, -2, 12, 4);
            ctx.restore();
        }

        // Cameras
        for (const c of world.cameras) {
            ctx.fillStyle = '#444';
            ctx.beginPath();
            ctx.arc(c.pos[0], c.pos[1], 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#666';
            ctx.stroke();
        }

        // Player
        ctx.save();
        ctx.translate(world.player.x, world.player.y);
        ctx.rotate(world.player.angle);
        ctx.fillStyle = CONFIG.COLORS.PLAYER;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-10, -12);
        ctx.lineTo(-10, 12);
        ctx.fill();
        if (world.player.sneak) {
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(-12, -14, 24, 28);
        }
        ctx.restore();
        
        // Player Noise Radius (Debug/Hint)
        if (world.player.noiseRadius > 0) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(world.player.x, world.player.y, world.player.noiseRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    drawDecor(pal) {
        const ctx = this.ctx;
        const levelIndex = this.world.levelIndex;
        if (levelIndex === 0) {
            // museum: framed paintings on the top wall, statues beside large cases
            const paintings = [150, 430, 700, 980];
            for (const px of paintings) {
                ctx.fillStyle = '#7a5c3a';
                ctx.fillRect(px, 6, 70, 34);
                ctx.fillStyle = '#c9a06a';
                ctx.fillRect(px + 5, 11, 60, 24);
                ctx.fillStyle = '#5f7f8a';
                ctx.fillRect(px + 10, 15, 22, 16);
                ctx.fillStyle = '#8a6f4a';
                ctx.fillRect(px + 36, 15, 24, 16);
            }
            for (const [sx, sy] of [[376, 236], [824, 236], [376, 620]]) {
                ctx.fillStyle = '#cfc7bb';
                ctx.beginPath();
                ctx.arc(sx, sy, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillRect(sx - 12, sy + 6, 24, 22);
            }
        } else if (levelIndex === 1) {
            // warehouse: crates and a flickering lamp glow
            for (const [bx, by] of [[180, 520], [1080, 240], [840, 660]]) {
                ctx.fillStyle = '#6b5230';
                ctx.fillRect(bx, by, 40, 40);
                ctx.strokeStyle = '#8a6c40';
                ctx.strokeRect(bx + 2, by + 2, 36, 36);
                ctx.beginPath();
                ctx.moveTo(bx + 2, by + 2);
                ctx.lineTo(bx + 38, by + 38);
                ctx.stroke();
            }
            ctx.fillStyle = 'rgba(180, 220, 255, 0.10)';
            ctx.beginPath();
            ctx.arc(640, 120, 60, 0, Math.PI * 2);
            ctx.fill();
        } else if (levelIndex === 2) {
            // vault: marble veins and gold trim along the columns
            ctx.strokeStyle = 'rgba(255, 215, 110, 0.30)';
            ctx.lineWidth = 2;
            for (let x = 0; x <= CONFIG.WIDTH; x += 64) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x + 40, CONFIG.HEIGHT);
                ctx.stroke();
            }
            ctx.lineWidth = 1;
            for (let y = 1; y < 12; y++) {
                ctx.fillStyle = 'rgba(255, 215, 110, 0.08)';
                ctx.fillRect(64, y * 64 + 28, CONFIG.WIDTH - 128, 8);
            }
        }
        ctx.fillStyle = pal.glow;
        ctx.globalAlpha = 0.05;
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
        ctx.globalAlpha = 1;
    }

    drawEdgeWarning() {
        const d = this.world.detection;
        if (d <= 0.7 || this.world.state !== 'PLAY') return;
        const ctx = this.ctx;
        const strength = Math.min(0.55, (d - 0.7) * 2.2);
        const grad = ctx.createRadialGradient(
            CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, CONFIG.HEIGHT * 0.38,
            CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, CONFIG.WIDTH * 0.62
        );
        grad.addColorStop(0, 'rgba(200, 30, 30, 0)');
        grad.addColorStop(1, `rgba(200, 30, 30, ${strength})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    }

    drawCone(poly, state) {
        if (!poly) return;
        const ctx = this.ctx;
        let color = CONFIG.COLORS.CONE_CALM;
        if (state === 'SUSPICIOUS') color = CONFIG.COLORS.CONE_SUSPICIOUS;
        if (state === 'CHASE') color = CONFIG.COLORS.CONE_ALERT;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(poly[0].x, poly[0].y);
        for (let i = 1; i < poly.length; i++) {
            ctx.lineTo(poly[i].x, poly[i].y);
        }
        ctx.closePath();
        ctx.fill();
    }

    updateHUD() {
        const world = this.world;
        const level = LEVELS[world.levelIndex];
        
        this.dom.detection.style.width = (world.detection * 100) + '%';
        this.dom.artifacts.textContent = `Artefak ${world.artifacts.filter(a => a.collected).length}/${world.artifacts.length}`;
        this.dom.lives.textContent = '❤️'.repeat(world.lives);
        
        const mins = Math.floor(Math.max(0, world.timer) / 60);
        const secs = Math.floor(Math.max(0, world.timer) % 60);
        this.dom.timer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        this.dom.score.textContent = world.score;
        this.dom.level.textContent = level.name;

        this.dom.warning.style.display = world.detection > 0.7 ? 'block' : 'none';
        
        if (world.toasts.length > 0) {
            this.dom.toast.textContent = world.toasts[0].text;
            this.dom.toast.style.display = 'block';
            world.toasts[0].time -= 0.016; // Approx 60fps
            if (world.toasts[0].time <= 0) world.toasts.shift();
        } else {
            this.dom.toast.style.display = 'none';
        }
    }

    drawScreens() {
        const ctx = this.ctx;
        const world = this.world;

        if (world.state === 'PLAY' || world.state === 'PAUSED') {
            if (world.state === 'PAUSED') {
                this.drawOverlay('TERHENTI', 'Tekan P untuk lanjut');
            }
            return;
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';

        if (world.state === 'TITLE') {
            ctx.font = 'bold 64px Segoe UI';
            ctx.fillText('Bayang Senja', CONFIG.WIDTH / 2, 250);
            ctx.font = 'italic 24px Segoe UI';
            ctx.fillStyle = '#aaa';
            ctx.fillText('Misi Senyap: Masuk tanpa terlihat, keluar tanpa jejak', CONFIG.WIDTH / 2, 300);
            
            ctx.fillStyle = '#fff';
            ctx.font = '24px Segoe UI';
            ctx.fillText('Pilih Level:', CONFIG.WIDTH / 2, 400);
            ctx.fillText('1. Galeri Senja  |  2. Gudang Arsip  |  3. Ruang Harta', CONFIG.WIDTH / 2, 450);
            
            ctx.font = '20px Segoe UI';
            ctx.fillStyle = CONFIG.COLORS.ARTIFACT;
            ctx.fillText(`Skor Tertinggi: ${world.highScore}`, CONFIG.WIDTH / 2, 550);
            
            ctx.fillStyle = '#888';
            ctx.fillText('Gunakan WASD untuk gerak, Shift untuk senyap, Klik untuk lempar kerikil', CONFIG.WIDTH / 2, 700);
        } else if (world.state === 'INTRO') {
            const level = LEVELS[world.levelIndex];
            ctx.font = 'bold 48px Segoe UI';
            ctx.fillText(level.name, CONFIG.WIDTH / 2, 350);
            ctx.font = '24px Segoe UI';
            ctx.fillText(`Objektif: Ambil ${level.artifacts.length} artefak dan capai pintu keluar`, CONFIG.WIDTH / 2, 420);
            ctx.font = '20px Segoe UI';
            ctx.fillStyle = '#aaa';
            ctx.fillText('Tekan SPACE untuk mulai', CONFIG.WIDTH / 2, 550);
        } else if (world.state === 'COMPLETE') {
            ctx.font = 'bold 48px Segoe UI';
            ctx.fillStyle = CONFIG.COLORS.EXIT;
            ctx.fillText('MISI BERHASIL!', CONFIG.WIDTH / 2, 300);
            ctx.font = '24px Segoe UI';
            ctx.fillStyle = '#fff';
            ctx.fillText(`Skor: ${world.score}`, CONFIG.WIDTH / 2, 380);
            ctx.fillText('Tekan SPACE untuk misi berikutnya', CONFIG.WIDTH / 2, 450);
        } else if (world.state === 'WIN') {
            ctx.font = 'bold 64px Segoe UI';
            ctx.fillStyle = CONFIG.COLORS.ARTIFACT;
            ctx.fillText('SEMUA MISI SELESAI!', CONFIG.WIDTH / 2, 230);
            ctx.font = 'italic 24px Segoe UI';
            ctx.fillStyle = '#ddd';
            ctx.fillText('Bayang keluar tanpa jejak. Warisan kembali ke tempatnya.', CONFIG.WIDTH / 2, 280);
            const st = world.stats;
            ctx.font = '26px Segoe UI';
            ctx.fillStyle = '#fff';
            ctx.fillText(`Total Skor: ${world.score}`, CONFIG.WIDTH / 2, 380);
            ctx.fillText(`Total Waktu: ${Math.floor(st.time / 60)}:${String(Math.floor(st.time % 60)).padStart(2, '0')}`, CONFIG.WIDTH / 2, 425);
            ctx.fillText(`Alarm Dibunyikan: ${st.alarms}`, CONFIG.WIDTH / 2, 470);
            ctx.fillStyle = '#ffd75e';
            ctx.fillText(`Bonus Hantu: ${st.ghost}/3 misi tanpa alarm`, CONFIG.WIDTH / 2, 515);
            ctx.fillStyle = '#aaa';
            ctx.font = '20px Segoe UI';
            ctx.fillText('Tekan R untuk main lagi', CONFIG.WIDTH / 2, 590);
        } else if (world.state === 'GAMEOVER') {
            ctx.font = 'bold 64px Segoe UI';
            ctx.fillStyle = '#f00';
            ctx.fillText('TERTANGKAP!', CONFIG.WIDTH / 2, 300);
            ctx.font = '24px Segoe UI';
            ctx.fillStyle = '#fff';
            ctx.fillText('Misi gagal. Penjaga menemukanmu.', CONFIG.WIDTH / 2, 400);
            ctx.fillText('Tekan R untuk mengulang level', CONFIG.WIDTH / 2, 500);
        }
    }

    drawOverlay(title, subtitle) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 48px Segoe UI';
        ctx.fillText(title, CONFIG.WIDTH / 2, 380);
        ctx.font = '24px Segoe UI';
        ctx.fillText(subtitle, CONFIG.WIDTH / 2, 440);
    }
}
