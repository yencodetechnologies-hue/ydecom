const buildOrderLineItem = (product, qty, unitPrice) => {
  const lineTotal = Math.round(unitPrice * qty * 100) / 100;
  return {
    product: product._id,
    name: product.name,
    qty,
    unitPrice,
    lineTotal,
    itemCode: product.itemCode || '',
    image: product.images?.[0] || '',
    mrp: Number(product.mrp) || 0,
    cost: Number(product.cost) || 0,
    tax: Number(product.tax) || 0,
    netCost: Number(product.netCost) || 0,
    salesTax: Number(product.salesTax) || 0,
  };
};

module.exports = { buildOrderLineItem };
