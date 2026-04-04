function getTienda(user) {
  return user?.tienda || 'murcia';
}

function withTienda(where = [], params = [], alias, tienda) {
  const prefix = alias ? `${alias}.` : '';
  return {
    where: [...where, `${prefix}tienda = ?`],
    params: [...params, tienda || 'murcia'],
  };
}

module.exports = { getTienda, withTienda };
