import { getVisionPoly } from './vision.js';

function cones(world) {
    for (const g of world.guards) {
        g.cone = getVisionPoly({ x: g.x, y: g.y }, g.angle, 300, Math.PI / 4, world.obstacles);
    }
    for (const c of world.cameras) {
        c.cone = getVisionPoly(
            { x: c.pos[0], y: c.pos[1] },
            (c.currentAngle * Math.PI) / 180,
            400,
            (30 * Math.PI) / 180,
            world.obstacles
        );
    }
}

export function setupShots(world) {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (!shot) return false;

    if (shot === 'title') {
        world.state = 'TITLE';
        world.score = 0;
        world.highScore = 12500;
        world.levelIndex = 0;
        world.resetLevel();
    } else if (shot === 'play') {
        world.levelIndex = 0;
        world.resetLevel();
        world.state = 'PLAY';

        world.player.x = 236;
        world.player.y = 300;
        world.player.angle = -Math.PI / 4;
        world.player.sneak = true;

        const g = world.guards;
        g[0].x = 720; g[0].y = 216; g[0].angle = Math.PI; g[0].state = 'PATROL';
        g[1].x = 1000; g[1].y = 480; g[1].angle = Math.PI; g[1].state = 'SUSPICIOUS';
        g[1].investigatePos = { x: 520, y: 480 };
        g[2].x = 600; g[2].y = 664; g[2].angle = -Math.PI / 2; g[2].state = 'PATROL';

        world.artifacts[0].collected = true;
        world.artifacts[1].collected = true;
        world.detection = 0.4;
        world.timer = 192;
        world.score = 450;
        world.toasts = [];
    } else if (shot === 'alarm') {
        world.levelIndex = 1;
        world.resetLevel();
        world.state = 'PLAY';

        world.player.x = 300;
        world.player.y = 560;
        world.player.angle = Math.PI;

        const g = world.guards;
        g[0].x = 452; g[0].y = 560; g[0].angle = Math.PI; g[0].state = 'CHASE';
        g[1].x = 760; g[1].y = 300; g[1].angle = Math.PI * 0.9; g[1].state = 'SUSPICIOUS';
        g[1].investigatePos = { x: 320, y: 540 };
        g[2].x = 900; g[2].y = 560; g[2].angle = -Math.PI / 2; g[2].state = 'PATROL';
        g[3].x = 1120; g[3].y = 690; g[3].angle = Math.PI * 0.75; g[3].state = 'PATROL';

        world.cameras[0].currentAngle = 90;
        world.cameras[1].currentAngle = -30;

        world.artifacts[0].collected = true;
        world.artifacts[1].collected = true;
        world.artifacts[3].collected = true;
        world.detection = 0.85;
        world.score = 1150;
        world.alarmActive = true;
        world.ghostBonus = false;
        world.toasts = [{ text: 'Hampir ketahuan!', time: 2 }];
    } else if (shot === 'win') {
        world.levelIndex = 2;
        world.resetLevel();
        world.state = 'WIN';
        world.score = 15800;
        world.stats = { alarms: 0, ghost: 3, time: 512 };
        world.highScore = 15800;
    } else {
        return false;
    }

    cones(world);
    return true;
}
