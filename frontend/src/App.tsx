import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Nav } from './components/Nav'
import { Footer } from './components/Footer'
import Landing from './routes/Landing'
import Destinations from './routes/Destinations'
import DestinationDetail from './routes/DestinationDetail'
import Checkout from './routes/Checkout'
import OrderConfirmation from './routes/OrderConfirmation'
import Account from './routes/Account'
import Login from './routes/Login'
import Signup from './routes/Signup'
import AuthCallback from './routes/AuthCallback'

// CRM is admin-only and big — code-split into its own chunk so the customer
// bundle doesn't pay for it.
const AdminLayout = lazy(() => import('./admin/AdminLayout'))
const CrmDashboard = lazy(() => import('./admin/pages/Dashboard'))
const CrmOrders = lazy(() => import('./admin/pages/Orders'))
const CrmCustomers = lazy(() => import('./admin/pages/Customers'))
const CrmCatalog = lazy(() => import('./admin/pages/Catalog'))
const CrmAnalytics = lazy(() => import('./admin/pages/Analytics'))

function Shell() {
  return (
    <>
      <Nav />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Landing />} />
        <Route path="/destinations" element={<Destinations />} />
        <Route path="/destinations/:country" element={<DestinationDetail />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order/:id" element={<OrderConfirmation />} />
        <Route path="/account" element={<Account />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>

      {/* Admin/CRM lives outside the Shell wrapper — its own full-bleed layout. */}
      <Route
        path="/admin"
        element={
          <Suspense fallback={<div style={{ padding: 64, fontFamily: 'system-ui' }}>Loading admin…</div>}>
            <AdminLayout />
          </Suspense>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<CrmDashboard />} />
        <Route path="orders" element={<CrmOrders />} />
        <Route path="orders/:reference" element={<CrmOrders />} />
        <Route path="customers" element={<CrmCustomers />} />
        <Route path="catalog" element={<CrmCatalog />} />
        <Route path="analytics" element={<CrmAnalytics />} />
      </Route>
    </Routes>
  )
}
