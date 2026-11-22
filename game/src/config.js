export const CONFIG = {
    WIDTH: 1280,
    HEIGHT: 800,
    TILE_SIZE: 64,
    PLAYER_SPEED: 3.5,
    SNEAK_SPEED: 1.8,
    GUARD_SPEED: 2.2,
    GUARD_CHASE_SPEED: 4.0,
    DETECTION_RATE: 0.8, // Per second inside cone
    DETECTION_DECAY: 0.3, // Per second outside cone
    NOISE_RADIUS: 150,
    SNEAK_NOISE_RADIUS: 40,
    PEBBLE_NOISE_RADIUS: 250,
    PEBBLE_MAX: 3,
    COLORS: {
        FLOOR: '#1a1a2e',
        WALL: '#16213e',
        COVER: '#0f3460',
        PLAYER: '#e94560',
        GUARD: '#f1c40f',
        ARTIFACT: '#00fff5',
        EXIT: '#2ecc71',
        SHADOW: 'rgba(0, 0, 0, 0.4)',
        LIGHT: 'rgba(255, 255, 150, 0.1)',
        CONE_CALM: 'rgba(241, 196, 15, 0.3)',
        CONE_SUSPICIOUS: 'rgba(230, 126, 34, 0.4)',
        CONE_ALERT: 'rgba(231, 76, 60, 0.5)',
    }
};
