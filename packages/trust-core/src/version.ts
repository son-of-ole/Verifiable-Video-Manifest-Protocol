/** @since 0.1.1 */
export const VVMP_CORE_VERSION = "0.1.3";

/** @since 0.1.3 */
export const VVMP_CORE_VERSION_MAJOR = 0;

/** @since 0.1.3 */
export const VVMP_CORE_VERSION_MINOR = 1;

/** @since 0.1.3 */
export const VVMP_CORE_VERSION_PATCH = 3;

/** @since 0.1.3 */
export function meetsMinimumVersion(major: number, minor: number, patch: number): boolean {
  if (VVMP_CORE_VERSION_MAJOR !== major) {
    return VVMP_CORE_VERSION_MAJOR > major;
  }

  if (VVMP_CORE_VERSION_MINOR !== minor) {
    return VVMP_CORE_VERSION_MINOR > minor;
  }

  return VVMP_CORE_VERSION_PATCH >= patch;
}
