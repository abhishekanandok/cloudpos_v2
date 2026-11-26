import axios from 'axios';
import toast from 'react-hot-toast';

const BASE = import.meta.env.VITE_API_URL || '/api';

// ── Owner / Staff API (redirects to /login on 401) ────────
const api = axios.create({ baseURL: BASE, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || 'Something went wrong';
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(error);
    }
    if (error.response?.status !== 404) toast.error(message);
    return Promise.reject(error);
  }
);

export default api;

// ── Driver API (uses driver_token — does NOT redirect owner to /login) ────
export const driverApi = axios.create({ baseURL: BASE, timeout: 30000 });

driverApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('driver_token') || localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

driverApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || 'Something went wrong';
    if (error.response?.status === 401) {
      sessionStorage.removeItem('driver_session');
      localStorage.removeItem('driver_token');
      window.location.href = '/login';
      return Promise.reject(error);
    }
    if (error.response?.status !== 404) toast.error(message);
    return Promise.reject(error);
  }
);


export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  staffLogin: (data) => api.post('/auth/staff/login', data),
  salesmanLogin: (data) => api.post('/salesmen/login', data),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
};

export const productsAPI = {
  list: (params) => api.get('/products', { params }),
  get: (id) => api.get(`/products/${id}`),
  getByBarcode: (barcode) => api.get(`/products/barcode/${barcode}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  lowStock: () => api.get('/products/low-stock'),
  deadStock: (params) => api.get('/products/dead-stock', { params }),
  stockReport: () => api.get('/products/stock-report'),
};

export const salesAPI = {
  list: (params) => api.get('/sales', { params }),
  get: (id) => api.get(`/sales/${id}`),
  create: (data) => api.post('/sales', data),
  update: (id, data) => api.put(`/sales/${id}`, data),
  delete: (id) => api.delete(`/sales/${id}`),
  dailySummary: (params) => api.get('/sales/summary/daily', { params }),
};

export const purchasesAPI = {
  list: (params) => api.get('/purchases', { params }),
  get: (id) => api.get(`/purchases/${id}`),
  create: (data) => api.post('/purchases', data),
  recordPayment: (id, data) => api.post(`/purchases/${id}/payment`, data),
  delete: (id) => api.delete(`/purchases/${id}`),
};

export const customersAPI = {
  list: (params) => api.get('/customers', { params }),
  get: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
};

export const suppliersAPI = {
  list: (params) => api.get('/suppliers', { params }),
  get: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
};

export const categoriesAPI = {
  list: () => api.get('/categories'),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
};

export const brandsAPI = {
  list: () => api.get('/brands'),
  create: (data) => api.post('/brands', data),
  update: (id, data) => api.put(`/brands/${id}`, data),
  delete: (id) => api.delete(`/brands/${id}`),
};

export const reportsAPI = {
  dailySales: (params) => api.get('/reports/sales/daily', { params }),
  monthlySales: (params) => api.get('/reports/sales/monthly', { params }),
  history: (params) => api.get('/reports/sales/history', { params }),
  profit: (params) => api.get('/reports/profit', { params }),
  topProducts: (params) => api.get('/reports/top-products', { params }),
  bestSelling: (params) => api.get('/reports/top-products', { params }),
  stock: (params) => api.get('/reports/stock', { params }),
  purchases: (params) => api.get('/reports/purchases', { params }),
};

export const ledgerAPI = {
  customer: (id) => api.get(`/ledger/customer/${id}`),
  supplier: (id) => api.get(`/ledger/supplier/${id}`),
  addCustomerEntry: (data) => api.post('/ledger/customer/entry', data),
  addSupplierEntry: (data) => api.post('/ledger/supplier/entry', data),
  updateCustomerEntry: (id, data) => api.put(`/ledger/customer/entry/${id}`, data),
  deleteCustomerEntry: (id, password) => api.delete(`/ledger/customer/entry/${id}`, { data: { password } }),
  updateSupplierEntry: (id, data) => api.put(`/ledger/supplier/entry/${id}`, data),
  deleteSupplierEntry: (id, password) => api.delete(`/ledger/supplier/entry/${id}`, { data: { password } }),
};

export const stockAPI = {
  history: (params) => api.get('/stock/history', { params }),
  adjust: (data) => api.post('/stock/adjust', data),
  addToStock: (data) => api.post('/stock/add-to-stock', data),
  bulkAdjust: (data) => api.post('/stock/bulk-adjust', data),
  editHistory: (id, data) => api.put(`/stock/history/${id}`, data),
};

export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  updateProfile: (data) => api.put('/settings/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

export const staffAPI = {
  list: () => api.get('/staff'),
  create: (data) => api.post('/staff', data),
  update: (id, data) => api.put(`/staff/${id}`, data),
  delete: (id) => api.delete(`/staff/${id}`),
};

export const branchesAPI = {
  list: () => api.get('/branches'),
  create: (data) => api.post('/branches', data),
  update: (id, data) => api.put(`/branches/${id}`, data),
};

// ── NEW APIs ─────────────────────────────────────────────

export const salesmenAPI = {
  list: () => api.get('/salesmen'),
  create: (data) => api.post('/salesmen', data),
  update: (id, data) => api.put(`/salesmen/${id}`, data),
  delete: (id) => api.delete(`/salesmen/${id}`),
  login: (data) => api.post('/salesmen/login', data),
  report: (params) => api.get('/salesmen/report', { params }),
};

export const expensesAPI = {
  list: (params) => api.get('/expenses', { params }),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
  categories: () => api.get('/expenses/categories'),
  createCategory: (data) => api.post('/expenses/categories', data),
};

export const driversAPI = {
  // Owner-side (require owner token)
  list:           ()           => api.get('/drivers'),
  create:         (data)       => api.post('/drivers', data),
  update:         (id, data)   => api.put(`/drivers/${id}`, data),
  delete:         (id)         => api.delete(`/drivers/${id}`),
  report:         (params)     => api.get('/drivers/report', { params }),
  dashboard:      (params)     => api.get('/drivers/dashboard', { params }),
  settlement:     (id, params) => api.get(`/drivers/${id}/settlement`, { params }),
  loadStock:      (data)       => api.post('/drivers/load', data),
  unloadStock:    (data)       => api.post('/drivers/unload', data),

  // Public (no auth needed)
  login:          (data)       => api.post('/drivers/login', data),

  // Driver-side (use driver_token — won't trigger /login redirect on 401)
  vehicleStock:   (driverId)   => driverApi.get(`/drivers/${driverId}/stock`),
  loadHistory:    (driverId)   => driverApi.get(`/drivers/${driverId}/loads`),
  logs:           (driverId)   => driverApi.get(`/drivers/${driverId}/logs`),
  collectPayment: (data)       => driverApi.post('/drivers/collect-payment', data),
};

export const cashClosingAPI = {
  summary: (params) => api.get('/cash-closing/summary', { params }),
  list: (params) => api.get('/cash-closing', { params }),
  save: (data) => api.post('/cash-closing', data),
};

// ── Driver-specific wrappers (use driverApi token) ────────
// Used in DriverPOS to avoid triggering owner /login redirect
export const driverSalesAPI = {
  list:            (params) => driverApi.get('/sales', { params }),
  get:             (id)     => driverApi.get(`/sales/${id}`),
  create:          (data)   => driverApi.post('/sales', data),
  // Driver-authenticated sale fetch — uses /sales/:id which works with driver_token AND owner token
  getSaleForPrint: (id)     => driverApi.get(`/sales/${id}`),
};


export const driverCustomersAPI = {
  list:   (params) => driverApi.get('/customers', { params }),
  create: (data)   => driverApi.post('/customers', data),
};
