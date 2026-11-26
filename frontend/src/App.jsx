import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';

import DashboardLayout from './components/layout/DashboardLayout';
import LoginPage from './pages/auth/LoginPage';
import LandingPage from './pages/LandingPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import SalePage from './pages/sale/SalePage';
import BillHistoryPage from './pages/sale/BillHistoryPage';
import PurchasePage from './pages/purchase/PurchasePage';
import ProductsPage from './pages/products/ProductsPage';
import AddProductPage from './pages/products/AddProductPage';
import CategoriesPage from './pages/products/CategoriesPage';
import BarcodePage from './pages/products/BarcodePage';
import StockPage from './pages/stock/StockPage';
import ReportsPage from './pages/reports/ReportsPage';
import DeadStockPage from './pages/reports/DeadStockPage';
import BestSellingPage from './pages/reports/BestSellingPage';
import CustomersPage from './pages/customers/CustomersPage';
import SuppliersPage from './pages/suppliers/SuppliersPage';
import LedgerPage from './pages/ledger/LedgerPage';
import SettingsPage from './pages/settings/SettingsPage';
import FranchisePage from './pages/franchise/FranchisePage';
import SalesmenPage from './pages/salesmen/SalesmenPage';
import ExpensesPage from './pages/expenses/ExpensesPage';
import CashClosingPage from './pages/cashclosing/CashClosingPage';
import DriversPage from './pages/drivers/DriversPage';
import DriverSettlementPage from './pages/drivers/DriverSettlementPage';
import VehicleDashboardPage from './pages/drivers/VehicleDashboardPage';
import DriverPOS from './pages/drivers/DriverPOS';

const ProtectedRoute = () => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};
const PublicRoute = () => {
  const { isAuthenticated } = useAuthStore();
  return !isAuthenticated ? <Outlet /> : <Navigate to="/dashboard" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: '13px', borderRadius: '8px' } }} />
      <Routes>
        {/* Landing page - always public */}
        <Route path="/" element={<LandingPage />} />

        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/driver-login" element={<DriverPOS mode="login" />} />
        </Route>

        {/* Driver POS - separate mobile interface, no sidebar */}
        <Route path="/driver-pos/*" element={<DriverPOS />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/sale" element={<SalePage />} />
            <Route path="/bill-history" element={<BillHistoryPage />} />
            <Route path="/purchase" element={<PurchasePage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/add" element={<AddProductPage />} />
            <Route path="/products/edit/:id" element={<AddProductPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/barcodes" element={<BarcodePage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/dead-stock" element={<DeadStockPage />} />
            <Route path="/reports/best-selling" element={<BestSellingPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/ledger" element={<LedgerPage />} />
            <Route path="/salesmen" element={<SalesmenPage />} />
            <Route path="/drivers" element={<DriversPage />} />
            <Route path="/drivers/dashboard" element={<VehicleDashboardPage />} />
            <Route path="/drivers/:driverId/settlement" element={<DriverSettlementPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/cash-closing" element={<CashClosingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/franchise" element={<FranchisePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
