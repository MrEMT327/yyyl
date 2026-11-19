export function warningEndPoint(from, target, width, height, bounds = { left: -width / 2, right: width / 2, bottom: -height / 2, top: height / 2 }) {
    const dx = target.x - from.x, dz = target.z - from.z, length = Math.hypot(dx, dz);
    if (!length)
        return { x: 0, z: 0 };
    const vx = dx / length, vz = dz / length, hits = [];
    if (Math.abs(vx) > 1e-9)
        for (const edge of [bounds.left, bounds.right]) {
            const t = (edge - from.x) / vx, z = from.z + vz * t;
            if (t >= 0 && t <= 10000 && z >= bounds.bottom - 1e-8 && z <= bounds.top + 1e-8)
                hits.push(t);
        }
    if (Math.abs(vz) > 1e-9)
        for (const edge of [bounds.bottom, bounds.top]) {
            const t = (edge - from.z) / vz, x = from.x + vx * t;
            if (t >= 0 && t <= 10000 && x >= bounds.left - 1e-8 && x <= bounds.right + 1e-8)
                hits.push(t);
        }
    const distance = Math.min(...hits);
    return Number.isFinite(distance) ? { x: from.x + vx * distance, z: from.z + vz * distance } : { x: 0, z: 0 };
}
