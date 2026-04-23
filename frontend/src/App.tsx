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
    </Routes>
  )
}
