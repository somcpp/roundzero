let counter = 0;

/** Client-side id for items created in editors (mock data has no backend ids). */
export function newId(prefix: string) {
  counter += 1;
  return `${prefix}-new-${counter}`;
}
