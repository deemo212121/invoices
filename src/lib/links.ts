// Detail pages take the record id as ?id=, because the site is a set of static files
// (no server to answer /products/123 for every possible id).
export const productHref = (id: number) => `/products/item?id=${id}`;
export const customerHref = (id: number) => `/customers/item?id=${id}`;
export const invoiceHref = (id: number) => `/invoices/item?id=${id}`;
