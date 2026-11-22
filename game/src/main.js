import { World } from './world.js';
import { Renderer } from './render.js';
import { INPUT } from './input.js';
import { AUDIO } from './audio.js';
import { setupShots } from './shots.js';

const canvas = document.getElementById('gameCanvas');
const world = new World();
const renderer = new Renderer(canvas, world);

INPUT.init(canvas);
world.keys = INPUT;

// Attach input handlers
INPUT.onPause = () => {
    if (world.state === 'PLAY') world.state = 'PAUSED';
    else if (world.state === 'PAUSED') world.state = 'PLAY';
};

INPUT.onRestart = () => {
    if (world.state === 'WIN' || world.state === 'GAMEOVER') {
        world.levelIndex = 0;
        world.score = 0;
        world.lives = 3;
    }
    world.resetLevel();
    world.state = 'PLAY';
};

INPUT.onMute = () => {
    AUDIO.setMuted(!AUDIO.muted);
};

INPUT.onLevelSelect = (num) => {
    if (world.state === 'TITLE' && num >= 1 && num <= 3) {
        world.levelIndex = num - 1;
        world.resetLevel();
        world.state = 'INTRO';
        AUDIO.init();
    }
};

INPUT.onClick = (pos) => {
    AUDIO.init();
    if (world.state === 'TITLE') {
        // Just start level 1 on click anywhere for title
        world.levelIndex = 0;
        world.resetLevel();
        world.state = 'INTRO';
        AUDIO.init();
    } else if (world.state === 'PLAY') {
        world.throwPebble(pos.x, pos.y);
    } else if (world.state === 'INTRO' || world.state === 'COMPLETE') {
        world.state = 'PLAY';
    } else if (world.state === 'GAMEOVER') {
        world.resetLevel();
        world.state = 'PLAY';
    } else if (world.state === 'WIN') {
        world.levelIndex = 0;
        world.score = 0;
        world.lives = 3;
        world.resetLevel();
        world.state = 'TITLE';
    }
};

// Global key for space/enter
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
        if (world.state === 'TITLE') {
            AUDIO.init();
            world.levelIndex = 0;
            world.resetLevel();
            world.state = 'INTRO';
        } else if (world.state === 'INTRO') {
            world.state = 'PLAY';
        } else if (world.state === 'COMPLETE') {
            world.levelIndex++;
            world.resetLevel();
            world.state = 'INTRO';
        } else if (world.state === 'GAMEOVER') {
            world.resetLevel();
            world.state = 'PLAY';
        }
    }
});

// Shots support: a ?shot= scene is frozen so the same URL always renders the same frame
const shotMode = setupShots(world);

let lastTime = 0;
function loop(timestamp) {
    const dt = Math.min(0.1, (timestamp - lastTime) / 1000);
    lastTime = timestamp;

    if (!shotMode) world.update(dt);
    renderer.render();

    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
