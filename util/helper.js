const ROLE_ADMIN = "admin";
const ROLE_OWNER = "owner";
const ROLE_USER = "user";

exports.isAdmin = (role) => {
  return role === ROLE_ADMIN;
};

exports.isOwner = (role) => {
  return role === ROLE_OWNER;
};

exports.isUser = (role) => {
  return role === ROLE_USER;
};

exports.isAdminOrOwner = (role) => {
  return role === ROLE_ADMIN || role === ROLE_OWNER;
};

exports.isDataEmpty = (data) => {
  return data.length === 0;
};
