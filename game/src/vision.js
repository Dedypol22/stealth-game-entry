export function getVisionPoly(origin, angle, range, halfAngle, obstacles) {
    const points = [origin];
    const segments = 20;
    const startAngle = angle - halfAngle;
    const endAngle = angle + halfAngle;
    
    for (let i = 0; i <= segments; i++) {
        const rayAngle = startAngle + (endAngle - startAngle) * (i / segments);
        const rayEnd = {
            x: origin.x + Math.cos(rayAngle) * range,
            y: origin.y + Math.sin(rayAngle) * range
        };
        
        let closestDist = range;
        let intersectPoint = rayEnd;
        
        for (const obs of obstacles) {
            const hit = getIntersection(origin, rayEnd, obs.p1, obs.p2);
            if (hit) {
                const dist = Math.hypot(hit.x - origin.x, hit.y - origin.y);
                if (dist < closestDist) {
                    closestDist = dist;
                    intersectPoint = hit;
                }
            }
        }
        points.push(intersectPoint);
    }
    return points;
}

function getIntersection(p1, p2, p3, p4) {
    const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (denom === 0) return null;
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
        return { x: x1 + ua * (x2 - x1), y: y1 + ua * (y2 - y1) };
    }
    return null;
}

export function isPointInPoly(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        const intersect = ((yi > p.y) !== (yj > p.y)) &&
            (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

export function getObstaclesFromMap(map, tileSize) {
    const obstacles = [];
    for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
            const char = map[y][x];
            if (char === 'W' || char === 'C' || char === 'L') {
                const x1 = x * tileSize, y1 = y * tileSize;
                const x2 = x1 + tileSize, y2 = y1 + tileSize;
                // Add 4 segments for the square
                obstacles.push({ p1: { x: x1, y: y1 }, p2: { x: x2, y: y1 } });
                obstacles.push({ p1: { x: x2, y: y1 }, p2: { x: x2, y: y2 } });
                obstacles.push({ p1: { x: x2, y: y2 }, p2: { x: x1, y: y2 } });
                obstacles.push({ p1: { x: x1, y: y2 }, p2: { x: x1, y: y1 } });
            }
        }
    }
    return obstacles;
}
