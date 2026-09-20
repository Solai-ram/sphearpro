/** Haversine distance in meters between two WGS84 points. */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isInsideGeofence(opts: {
  userLat: number;
  userLon: number;
  clinicLat: number;
  clinicLon: number;
  radiusMeters: number;
}): { inside: boolean; distanceMeters: number } {
  const d = distanceMeters(opts.userLat, opts.userLon, opts.clinicLat, opts.clinicLon);
  return { inside: d <= opts.radiusMeters, distanceMeters: Math.round(d * 10) / 10 };
}
