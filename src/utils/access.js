export function canAccessEstruturaFisica(user) {
  if (!user?.nivel) return false;

  if (user.nivel === "Administrador" || user.nivel === "Gestor") {
    return true;
  }

  return user.nivel === "RH" && user.estrutura_fisica_liberada === true;
}
