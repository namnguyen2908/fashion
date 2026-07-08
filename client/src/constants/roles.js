export const ROLES = {
  ADMIN: "admin",
  STAFF: "staff",
  CUSTOMER: "customer",
};

export const ADMIN_ROLES = [ROLES.ADMIN, ROLES.STAFF];

export const isAdminRole = (role) => ADMIN_ROLES.includes(role);
