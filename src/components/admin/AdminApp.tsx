import React from 'react';
import { AdminLayout } from './AdminLayout';

export const AdminApp: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans antialiased">
      <AdminLayout />
    </div>
  );
};

export default AdminApp;
