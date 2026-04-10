import { Routes, Route, Navigate, useLocation } from 'react-router-dom'; 
import { useAuth } from './contexts/AuthContext';
import { Headset, Loader2 } from 'lucide-react'; 
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';  
import { setupOneSignal } from './lib/onesignal-setup';
import Median from 'median-js-bridge'; 

import { 
    Tooltip as UITooltip, 
    TooltipContent as UITooltipContent, 
    TooltipProvider as UITooltipProvider, 
    TooltipTrigger as UITooltipTrigger 
} from '@/components/ui/tooltip'; 

import Sidebar from './components/Navbar'; 
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import SettingsPage from './pages/SettingsPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailsPage from './pages/OrderDetailsPage';
import StockAndGalonPage from './pages/StockAndGalonPage';
import ReportsPage from './pages/ReportsPage';
import UserManagementPage from './pages/UserManagementPage';
import CentralOrderPage from './pages/CentralOrderPage';
import CentralOrderFormPage from './pages/NewCentralOrderFormPage';
import AddOrderForm from './components/AddOrderForm'; 
import CompleteDeliveryPage from './pages/CompleteDeliveryPage';
import UpdateStockPage from './pages/UpdateStockPage';
import ExpenseReportsPage from './pages/ExpenseReportsPage';
import FinancialReportPage from './pages/FinancialReportPage'; 
import FinancialManagementPage from './pages/FinancialManagementPage';
import DataExportPage from './pages/DataExportPage';
import CalendarPage from './pages/CalendarPage';
import AddProductPage from './pages/AddProductPage';
import EditProductPage from './pages/EditProductPage';
import EditOrderPage from './pages/EditOrderPage';
import QuickCompleteOrderPage from './pages/QuickCompleteOrderPage'; 
import NotificationsPage from './pages/NotificationsPage';
import SalaryAndBonusPage from './pages/SalaryAndBonusPage'; 
import CourierDashboardContainer from './pages/CourierDashboardContainer';
import FinalReportsPage from './pages/FinalReportsPage'; 
import LandingPage from './pages/LandingPage';
import NewCentralOrderFormPage from './pages/NewCentralOrderFormPage';
import EditCentralOrderFormPage from './pages/EditCentralOrderFormPage';
import SubscriptionExpiredPage from './pages/SubscriptionExpiredPage';
import BillingAccountPage from './pages/BillingAccountPage'; 
import ProductDetailPage from './pages/ProductDetailPage';
import MapsPage from './pages/MapsPage';
import DropshipDashboard from './components/dashboards/DropshipDashboard';


const App = () => {
  const { session, loading, userProfile, user, isAccessDenied } = useAuth();
  const location = useLocation(); 
   
  useEffect(() => {
    if (Median.isNativeApp()) {
      Median.onReady(() => {
        Median.ui.setStatusBarColor({ color: '#FFFFFF', style: 'default' });
        Median.navigation.setNeedsLayout();
      });
    }
  }, []);

   useEffect(() => {
    if (user?.id) { 
        setupOneSignal(user.id); 
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  // --- LOGIKA ROLE PERMISSIONS ---
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin';
  const isCourier = userProfile?.role === 'user';
  const isDropship = userProfile?.role === 'dropship';

  const isAdminOrSuperAdmin = isSuperAdmin || isAdmin;
  
  // Role yang diizinkan melihat Customer & Pesanan (Admin, Kurir, dan Dropshipper)
  const canManageOrders = isAdminOrSuperAdmin || isCourier || isDropship;

  if (session && isAccessDenied && !isSuperAdmin) {
      return <SubscriptionExpiredPage />; 
  }


  return (
    <>
      {userProfile && !isAccessDenied && <Sidebar />} 
     <main
        className={`min-h-screen bg-white transition-all duration-300 ${
          location.pathname !== "/login" && location.pathname !== "/" ? "md:ml-16" : ""
        }`}
      >
        <div className={location.pathname !== "/login" && location.pathname !== "/" ? "p-4 md:p-8" : ""}>

          <Routes> 
            <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <LandingPage />} /> 
            
            <Route 
                path="/login" 
                element={!userProfile 
                    ? <AuthPage /> 
                    : <Navigate to={location.pathname === '/login' ? "/dashboard" : location.pathname} replace />
                } 
            />

            <Route
              path="/dashboard"
              element={session ? <DashboardPage /> : <Navigate to="/login" />}
            />
            
            <Route
              path="/courier-dashboard"
              element={session ? <CourierDashboardContainer /> : <Navigate to="/login" />}
            />

            <Route
              path="/final-reports"
              element={session && isAdminOrSuperAdmin ? <FinalReportsPage /> : <Navigate to="/dashboard" />}
            />

            <Route
              path="/settings"
              element={session && isAdminOrSuperAdmin ? <SettingsPage /> : <Navigate to="/dashboard" />}
            />

            {/* CUSTOMERS - Admin, Kurir, dan Dropshipper diizinkan */}
            <Route
              path="/customers"
             element={session && canManageOrders ? <CustomersPage /> : <Navigate to="/dashboard" />}
            />

            {/* ORDERS - Admin, Kurir, dan Dropshipper diizinkan */}
            <Route
              path="/orders"
              element={session && canManageOrders ? <OrdersPage /> : <Navigate to="/dashboard" />}
            />
            
            <Route
              path="/orders/add"
              element={session && canManageOrders ? <AddOrderForm /> : <Navigate to="/dashboard" />}
            />
            
            <Route
              path="/quick-order"
              element={session && canManageOrders ? <QuickCompleteOrderPage /> : <Navigate to="/dashboard" />}
            />
            
            <Route
              path="/orders/:id"
              element={session && canManageOrders ? <OrderDetailsPage /> : <Navigate to="/dashboard" />}
            />
            
            <Route 
              path="/orders/edit/:orderId" 
              element={session && canManageOrders ? <EditOrderPage /> : <Navigate to="/dashboard" />} 
            />

            {/* STOCK & RECONCILIATION */}
            <Route
              path="/stock"
             element={session && canManageOrders ? <StockAndGalonPage /> : <Navigate to="/dashboard" />}
            />
            
            <Route
              path="/stock-reconciliation"
             element={session && canManageOrders ? <UpdateStockPage /> : <Navigate to="/dashboard" />}
            />

            {/* REPORTS */}
            <Route
              path="/reports"
              element={session && canManageOrders ? <ReportsPage /> : <Navigate to="/dashboard" />}
            />

            {/* CENTRAL ORDERS */}
            <Route
              path="/central-orders"
              element={session && (isAdminOrSuperAdmin || isCourier) ? <CentralOrderPage /> : <Navigate to="/dashboard" />}
            />
            
            <Route path="/central-order/new-form" element={session && (isAdminOrSuperAdmin || isCourier) ? <NewCentralOrderFormPage /> : <Navigate to="/dashboard" />} /> 
            <Route path="/central-order/:id" element={session && (isAdminOrSuperAdmin || isCourier) ? <EditCentralOrderFormPage /> : <Navigate to="/dashboard" />} />
            
            <Route
              path="/salaries"
              element={session && isAdminOrSuperAdmin ? <SalaryAndBonusPage /> : <Navigate to="/dashboard" />}
            />

            <Route
              path="/complete-delivery/:orderId"
              element={session && (isAdminOrSuperAdmin || isCourier) ? <CompleteDeliveryPage /> : <Navigate to="/dashboard" />}
            />
            
            <Route
              path="/maps"
              element={session && canManageOrders ? <MapsPage /> : <Navigate to="/dashboard" />}
            />
            
            <Route
              path="/expenses"
              element={session && (isAdminOrSuperAdmin || isCourier) ? <ExpenseReportsPage /> : <Navigate to="/dashboard" />}
            />
            
            {/* Laporan Keuangan Utama */}
            <Route
              path="/financials"
              element={session && (isAdminOrSuperAdmin || userProfile?.role === 'user') ? <FinancialReportPage /> : <Navigate to="/dashboard" />}
            />

            <Route
              path="/dropship-dashboard"
              element={session && (isAdminOrSuperAdmin || isDropship) ? <DropshipDashboard/> : <Navigate to="/dashboard" />}
            />

            {/* Manajemen Keuangan */}
            <Route
              path="/financial-management"
              element={session && (isAdminOrSuperAdmin || userProfile?.role === 'user') ? <FinancialManagementPage /> : <Navigate to="/dashboard" />}
            />

            <Route
              path="/data-export"
              element={session && isAdminOrSuperAdmin ? <DataExportPage /> : <Navigate to="/dashboard" />}
            />

             <Route
              path="/calendar"
              element={session ? <CalendarPage /> : <Navigate to="/login" />}
            />

            <Route
              path="/notifications"
              element={session ? <NotificationsPage /> : <Navigate to="/login" />}
            />

            <Route
                path="/products/add"
                element={session && isAdminOrSuperAdmin ? <AddProductPage /> : <Navigate to="/dashboard" />}
            />
            
            <Route
                path="/products/:id"
                element={session && (isAdminOrSuperAdmin || isDropship) ? <ProductDetailPage /> : <Navigate to="/dashboard" />}
            />
            
            <Route
                path="/products/edit/:id"
                element={session && isAdminOrSuperAdmin ? <EditProductPage /> : <Navigate to="/dashboard" />}
            />

            {/* USER MANAGEMENT - Only Super Admin */}
            {isSuperAdmin && (
              <Route path="/users" element={<UserManagementPage />} />
            )}

            <Route
                path="/billing-account"
                element={session && isSuperAdmin ? <BillingAccountPage /> : <Navigate to="/dashboard" />}
            />

            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </div>
         
        {userProfile && (
            <UITooltipProvider>
                <UITooltip>
                    <UITooltipTrigger asChild>
                        <a
                            href="https://api.whatsapp.com/send?phone=6285111301943" 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="fixed bottom-4 right-4 z-50 p-4 rounded-full bg-[#10182b] text-white shadow-xl hover:bg-[#20283b] transition-colors duration-200"
                            aria-label="Hubungi Admin via WhatsApp"
                        >
                            <Headset className="h-6 w-6" />
                        </a>
                    </UITooltipTrigger>
                    <UITooltipContent side="left">
                        <p>Hubungi Admin (WhatsApp)</p>
                    </UITooltipContent>
                </UITooltip>
            </UITooltipProvider>
        )}

      </main>
      <Toaster />
    </>  
  );
};

export default App;