import StatCard from "@/components/StatCard";
import { columns } from "@/components/table/columns";
import DataTable from "@/components/table/DataTable";
import { getRecentAppointmentList } from "@/lib/actions/appointment.actions";

import Header from "@/components/Header";

export const dynamic = "force-dynamic";
const AdminPage = async () => {
  const appointments = await getRecentAppointmentList();

  return (
    <div className="container mx-auto flex min-w-full flex-col space-y-14">
      <Header />

      <main className="admin-main container">
        <section className="w-full space-y-4">
          <h1 className="header">Welcome To Admin Dashboard</h1>
        </section>

        <section className="admin-stat">
          <StatCard
            type="appointments"
            count={appointments?.scheduledCount as number}
            label="Scheduled appointments"
            icon={"/assets/icons/appointments.svg"}
          />
          <StatCard
            type="pending"
            count={appointments?.pendingCount as number}
            label="Pending appointments"
            icon={"/assets/icons/pending.svg"}
          />
          <StatCard
            type="cancelled"
            count={appointments?.cancelledCount as number}
            label="Cancelled appointments"
            icon={"/assets/icons/cancelled.svg"}
          />
        </section>

        <DataTable columns={columns} data={appointments?.documents ?? []} />
      </main>
    </div>
  );
};

export default AdminPage;
