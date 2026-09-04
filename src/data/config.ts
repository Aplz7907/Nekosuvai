export const CONFIG = {
  runSeconds: 20 * 60,
  camera: {
    /** Elevation above the horizon. Billboards are tilted by this to face the camera. */
    elevation: (52 * Math.PI) / 180,
    distance: 30,
    viewHeight: 17,
  },
  player: {
    maxHp: 120,
    speed: 4.0,
    radius: 0.42,
    pickupRadius: 3.2,
    iframes: 0.6,
    regen: 0,
  },
  capacity: {
    enemies: 900,
    projectiles: 600,
    gems: 1200,
  },
  spawn: {
    /** Enemies appear on a ring just outside the visible area. */
    ringRadius: 15,
    /** Wander further than this from the player and they are recycled to the far side. */
    despawnRadius: 42,
  },
} as const;
