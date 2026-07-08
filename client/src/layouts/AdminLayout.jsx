import { Outlet } from "react-router-dom";
import AdminSidebar from "../components/admin/AdminSidebar";

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <AdminSidebar />

      <div className="md:ml-60 lg:ml-64 flex flex-col min-h-screen">
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
