import { CONFIG } from './config.js';
import { LEVELS } from './levels.js';
import { AUDIO } from './audio.js';
import { getVisionPoly, isPointInPoly, getObstaclesFromMap } from './vision.js';

export class World {
    constructor() {
        this.state = 'TITLE'; // TITLE, INTRO, PLAY, PAUSED, COMPLETE, WIN, GAMEOVER
        this.levelIndex = 0;
        this.score = 0;
        this.lives = 3;
        this.stats = { alarms: 0, ghost: 0, time: 0 };
        this.resetLevel();
        this.highScore = parseInt(localStorage.getItem('bayang_highscore') || '0');
    }

    resetLevel() {
        const level = LEVELS[this.levelIndex];
        this.artifacts = level.artifacts.map(p => ({ x: p[0], y: p[1], collected: false }));
        this.player = { x: level.playerStart[0], y: level.playerStart[1], angle: 0, sneak: false, noiseRadius: 0 };
        this.guards = level.guards.map(g => ({
            path: g.path.map(p => ({ x: p[0], y: p[1] })),
            currentIdx: 0,
            x: g.path[0][0],
            y: g.path[0][1],
            angle: 0,
            state: 'PATROL', // PATROL, SUSPICIOUS, CHASE, RETURN
            wait: 0,
            target: null,
            investigatePos: null,
            lastSeenPos: null
        }));
        this.cameras = (level.cameras || []).map(c => ({
            ...c,
            currentAngle: c.angle - c.arc/2,
            dir: 1
        }));
        this.obstacles = getObstaclesFromMap(level.map, CONFIG.TILE_SIZE);
        this.detection = 0;
        this.timer = level.timeLimit;
        this.pebbles = level.pebbles;
        this.ghostBonus = true;
        this.alarmActive = false;
        this.levelAlarmed = false;
        this.levelTime = 0;
        this.activePebble = null;
        this.noiseRings = [];
        this.toasts = [];
    }

    update(dt) {
        if (this.state !== 'PLAY') return;

        this.updatePlayer(dt);
        this.updateGuards(dt);
        this.updateCameras(dt);
        this.updateDetection(dt);
        this.updatePebble(dt);
        this.updateTimer(dt);
        this.checkCollisions();
        
        if (this.timer <= 0) this.state = 'GAMEOVER';
    }

    updatePlayer(dt) {
        let vx = 0, vy = 0;
        if (this.keys.isDown('KeyW') || this.keys.isDown('ArrowUp')) vy -= 1;
        if (this.keys.isDown('KeyS') || this.keys.isDown('ArrowDown')) vy += 1;
        if (this.keys.isDown('KeyA') || this.keys.isDown('ArrowLeft')) vx -= 1;
        if (this.keys.isDown('KeyD') || this.keys.isDown('ArrowRight')) vx += 1;

        this.player.sneak = this.keys.isDown('ShiftLeft') || this.keys.isDown('ShiftRight');
        const speed = this.player.sneak ? CONFIG.SNEAK_SPEED : CONFIG.PLAYER_SPEED;

        if (vx !== 0 || vy !== 0) {
            const mag = Math.hypot(vx, vy);
            vx = (vx / mag) * speed;
            vy = (vy / mag) * speed;
            
            if (!this.checkWallCollision(this.player.x + vx, this.player.y)) this.player.x += vx;
            if (!this.checkWallCollision(this.player.x, this.player.y + vy)) this.player.y += vy;
            
            this.player.angle = Math.atan2(vy, vx);
            this.player.noiseRadius = this.player.sneak ? CONFIG.SNEAK_NOISE_RADIUS : CONFIG.NOISE_RADIUS;
            
            if (Math.random() < (this.player.sneak ? 0.02 : 0.05)) {
                AUDIO.footstep(0, this.player.sneak ? 0.05 : 0.1);
            }
        } else {
            this.player.noiseRadius = 0;
        }
    }

    checkWallCollision(x, y) {
        const r = 15;
        for (const obs of this.obstacles) {
            // Simple circle-segment distance or just check center
            if (x < 0 || x > CONFIG.WIDTH || y < 0 || y > CONFIG.HEIGHT) return true;
        }
        const tx = Math.floor(x / CONFIG.TILE_SIZE);
        const ty = Math.floor(y / CONFIG.TILE_SIZE);
        const map = LEVELS[this.levelIndex].map;
        if (!map[ty] || !map[ty][tx] || map[ty][tx] === 'W' || map[ty][tx] === 'C') return true;
        return false;
    }

    updateGuards(dt) {
        for (const g of this.guards) {
            let target = null;
            let speed = CONFIG.GUARD_SPEED;

            if (g.state === 'PATROL') {
                target = g.path[g.currentIdx];
                if (Math.hypot(g.x - target.x, g.y - target.y) < 5) {
                    g.currentIdx = (g.currentIdx + 1) % g.path.length;
                }
            } else if (g.state === 'SUSPICIOUS') {
                target = g.investigatePos;
                if (Math.hypot(g.x - target.x, g.y - target.y) < 5) {
                    g.wait += dt;
                    if (g.wait > 2) {
                        g.state = 'RETURN';
                        g.wait = 0;
                    }
                }
            } else if (g.state === 'CHASE') {
                target = this.player;
                speed = CONFIG.GUARD_CHASE_SPEED;
                if (Math.hypot(g.x - this.player.x, g.y - this.player.y) < 20) {
                    this.caught();
                }
            } else if (g.state === 'RETURN') {
                target = g.path[g.currentIdx];
                if (Math.hypot(g.x - target.x, g.y - target.y) < 5) {
                    g.state = 'PATROL';
                }
            }

            if (target && g.wait <= 0) {
                const angle = Math.atan2(target.y - g.y, target.x - g.x);
                g.x += Math.cos(angle) * speed;
                g.y += Math.sin(angle) * speed;
                g.angle = angle;
                
                if (Math.random() < 0.03) {
                    const dist = Math.hypot(g.x - this.player.x, g.y - this.player.y);
                    const vol = Math.max(0, 0.2 * (1 - dist / 800));
                    const pan = Math.max(-1, Math.min(1, (g.x - this.player.x) / 500));
                    AUDIO.footstep(pan, vol);
                }
            }

            // Guard vision
            const cone = getVisionPoly({x: g.x, y: g.y}, g.angle, 300, Math.PI/4, this.obstacles);
            g.cone = cone;
            if (isPointInPoly(this.player, cone)) {
                if (g.state !== 'CHASE') {
                    if (g.state !== 'SUSPICIOUS') AUDIO.suspicious();
                    g.state = 'CHASE';
                    g.alertedAt = this.levelTime;
                }
            } else if (g.state === 'CHASE') {
                g.state = 'SUSPICIOUS';
                g.investigatePos = { x: this.player.x, y: this.player.y };
                this.addToast('Lolos...');
            }

            // Hear player
            if (this.player.noiseRadius > 0) {
                const dist = Math.hypot(g.x - this.player.x, g.y - this.player.y);
                if (dist < this.player.noiseRadius && g.state === 'PATROL') {
                    g.state = 'SUSPICIOUS';
                    g.investigatePos = { x: this.player.x, y: this.player.y };
                    AUDIO.suspicious();
                }
            }
        }
    }

    updateCameras(dt) {
        for (const c of this.cameras) {
            c.currentAngle += c.speed * c.dir * 60 * dt;
            if (c.currentAngle > c.angle + c.arc/2) c.dir = -1;
            if (c.currentAngle < c.angle - c.arc/2) c.dir = 1;

            const cone = getVisionPoly({x: c.pos[0], y: c.pos[1]}, c.currentAngle * Math.PI/180, 400, (30 * Math.PI/180), this.obstacles);
            c.cone = cone;
        }
    }

    updateDetection(dt) {
        let inAnyCone = false;
        for (const g of this.guards) {
            if (isPointInPoly(this.player, g.cone)) inAnyCone = true;
        }
        for (const c of this.cameras) {
            if (isPointInPoly(this.player, c.cone)) inAnyCone = true;
        }

        if (inAnyCone) {
            const distToNearest = Math.min(...this.guards.map(g => Math.hypot(g.x - this.player.x, g.y - this.player.y)));
            const proximity = Math.max(0.5, 2 - distToNearest / 300);
            const stealth = (this.player.sneak ? 0.6 : 1) * this.lightFactor() * this.shadowFactor();
            this.detection += CONFIG.DETECTION_RATE * dt * proximity * stealth;
        } else {
            this.detection -= CONFIG.DETECTION_DECAY * dt;
        }
        this.detection = Math.max(0, Math.min(1, this.detection));

        if (this.detection >= 1) {
            // Alarm sounds, all guards chase last seen
            if (!this.levelAlarmed) {
                AUDIO.alarm();
                this.levelAlarmed = true;
                this.alarmActive = true;
                this.ghostBonus = false;
                this.stats.alarms += 1;
                for (const g of this.guards) {
                    if (g.state !== 'CHASE') {
                        g.state = 'SUSPICIOUS';
                        g.investigatePos = { x: this.player.x, y: this.player.y };
                    }
                }
            }
        }
    }

    updatePebble(dt) {
        if (this.activePebble) {
            const p = this.activePebble;
            const dist = Math.hypot(p.tx - p.x, p.ty - p.y);
            if (dist < 10) {
                AUDIO.pebble();
                this.noiseRings.push({ x: p.x, y: p.y, r: 0, maxR: CONFIG.PEBBLE_NOISE_RADIUS });
                // Attract nearest guard
                let nearest = null, minDist = Infinity;
                for (const g of this.guards) {
                    const d = Math.hypot(g.x - p.x, g.y - p.y);
                    if (d < CONFIG.PEBBLE_NOISE_RADIUS && d < minDist) {
                        minDist = d;
                        nearest = g;
                    }
                }
                if (nearest) {
                    nearest.state = 'SUSPICIOUS';
                    nearest.investigatePos = { x: p.x, y: p.y };
                    nearest.wait = 0;
                }
                this.activePebble = null;
            } else {
                const angle = Math.atan2(p.ty - p.y, p.tx - p.x);
                p.x += Math.cos(angle) * 10;
                p.y += Math.sin(angle) * 10;
            }
        }

        for (let i = this.noiseRings.length - 1; i >= 0; i--) {
            const r = this.noiseRings[i];
            r.r += 200 * dt;
            if (r.r > r.maxR) this.noiseRings.splice(i, 1);
        }
    }

    lightFactor() {
        const map = LEVELS[this.levelIndex].map;
        const cx = this.player.x / CONFIG.TILE_SIZE;
        const cy = this.player.y / CONFIG.TILE_SIZE;
        for (let y = Math.floor(cy) - 2; y <= Math.floor(cy) + 2; y++) {
            for (let x = Math.floor(cx) - 2; x <= Math.floor(cx) + 2; x++) {
                const row = map[y];
                if (!row || row[x] !== 'L') continue;
                if (Math.hypot(cx - (x + 0.5), cy - (y + 0.5)) < 1.6) return 1.35;
            }
        }
        return 1;
    }

    shadowFactor() {
        const tx = Math.floor(this.player.x / CONFIG.TILE_SIZE);
        const ty = Math.floor(this.player.y / CONFIG.TILE_SIZE);
        const row = LEVELS[this.levelIndex].map[ty];
        return row && row[tx] === 'S' ? 0.45 : 1;
    }

    updateTimer(dt) {
        this.timer -= dt;
        this.levelTime += dt;
    }

    checkCollisions() {
        for (const a of this.artifacts) {
            if (!a.collected && Math.hypot(this.player.x - a.x, this.player.y - a.y) < 30) {
                a.collected = true;
                this.score += 200;
                AUDIO.pickup();
            }
        }

        const exit = LEVELS[this.levelIndex].exit;
        if (this.artifacts.every(a => a.collected) && Math.hypot(this.player.x - exit[0], this.player.y - exit[1]) < 40) {
            this.levelComplete();
        }
    }

    caught() {
        this.lives--;
        if (this.lives <= 0) {
            this.state = 'GAMEOVER';
        } else {
            this.resetLevel();
            this.state = 'PLAY';
        }
    }

    levelComplete() {
        AUDIO.win();
        let bonus = Math.floor(this.timer * 10);
        if (this.ghostBonus) {
            bonus += 500;
            this.stats.ghost += 1;
        }
        this.stats.time += this.levelTime;
        this.score += bonus;
        
        if (this.levelIndex === LEVELS.length - 1) {
            this.state = 'WIN';
            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('bayang_highscore', this.score);
            }
        } else {
            this.state = 'COMPLETE';
        }
    }

    addToast(text) {
        this.toasts.push({ text, time: 2 });
    }

    throwPebble(x, y) {
        if (this.pebbles > 0 && !this.activePebble && this.state === 'PLAY') {
            this.activePebble = { x: this.player.x, y: this.player.y, tx: x, ty: y };
            this.pebbles--;
        }
    }
}
