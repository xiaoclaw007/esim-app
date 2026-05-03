import { Outlet } from 'react-router-dom'
import { AdminGate } from './AdminGate'
import { CrmShell } from './CrmShell'
// Side-effect import — Vite code-splits this CSS into the lazy /admin chunk.
import './styles/crm.css'

export default function AdminLayout() {
  return (
    <AdminGate>
      {(admin) => (
        <CrmShell admin={admin}>
          <Outlet />
        </CrmShell>
      )}
    </AdminGate>
  )
}
