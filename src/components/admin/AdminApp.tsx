import React from 'react';
import { AdminLayout } from './AdminLayout';
import { AuthSessionGate } from '../auth/AuthSessionGate';

export const AdminApp: React.FC = () => {
  return (
    <AuthSessionGate expectedAudience="platform">{(session) => (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans antialiased">
        <AdminLayout selectedTenantId={session.tenantIds[0] ?? null} />
      </div>
    )}</AuthSessionGate>
  );
};

export default AdminApp;
