import { Role } from '@prisma/client';

/** Global ops staff — no agency filter. */
export const GLOBAL_STAFF: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];

/** Agency-scoped staff roles (gouvernorat Agency, not livreur Zone). */
export const AGENCY_ROLES: Role[] = [
  Role.CHEF_AGENCE,
  Role.SUPPORT,
  Role.PICKUP,
  Role.MAGASINIER,
];

/** Roles that require agencyId on the user. */
export const AGENCY_REQUIRED_ROLES: Role[] = AGENCY_ROLES;

/** Chef + global staff can assign drivers / broad ops. */
export const OPS_STAFF: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.CHEF_AGENCE,
];

export function isAgencyRole(role: Role): boolean {
  return AGENCY_ROLES.includes(role);
}

export function isGlobalStaff(role: Role): boolean {
  return GLOBAL_STAFF.includes(role);
}
