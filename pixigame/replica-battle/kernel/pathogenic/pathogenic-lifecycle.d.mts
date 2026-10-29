/** Exact loop/random-call ordering from lightning_beam.gd:update_raycast.
 * randomValues must be a stable recorded or caller-generated stream of [0,1).
 * Branches are visual spawn descriptions; no host combat entity is created.
 */
export function buildLightningPath({ endpoint, randomValues, playerBulletCount, splitOffChance, maxDistance, rootTransform, globalRotation }: {
    endpoint: any;
    randomValues: any;
    playerBulletCount: any;
    splitOffChance?: number;
    maxDistance?: number;
    rootTransform?: readonly number[];
    globalRotation?: number;
}): {
    points: any[][];
    branches: any[];
    randomUsed: number;
    nextSplitOffChance: number;
};
/** Build source visual ctx plus explicit requests the host still owns.
 * `duration` means a host-supplied active-life limit; `exitAt` is an actual exit
 * event time. Neither changes source fade/linger duration.
 */
export function createLifecycleContext(graph: any, scenePath: any, input?: {}): {
    context: {
        time: any;
        rootTransform: any;
        overrides: {};
        linePoints: {};
        animationNames: {};
        animationTimes: {};
        captureProperties: any;
        damageRatio: any;
        widthGrow: any;
    };
    phase: string;
    completed: boolean;
    childScenes: any[];
    hostEvents: any[];
    unsupported: any[];
    provenance: any[];
    sourceState: {};
};
export const LIFECYCLE_SOURCES: Readonly<{
    laser: "scn/player/projectiles/laser_beam.gd";
    lightning: "scn/player/projectiles/lightning_beam.gd";
    shield: "scn/player/projectiles/operculum_shield.gd";
    magnetic: "scn/player/projectiles/magnetic_pull_area.gd";
}>;
