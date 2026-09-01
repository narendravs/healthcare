import { render, screen } from "@testing-library/react";
import AdminPage from "@/app/admin/page";
import { getRecentAppointmentList } from "@/lib/actions/appointment.actions";
import "@testing-library/jest-dom";

// Mock the server action
jest.mock("@/lib/actions/appointment.actions", () => ({
  getRecentAppointmentList: jest.fn(),
}));

// Mock sub-components to isolate the page logic
jest.mock("@/components/Header", () => () => <div data-testid="mock-header" />);
jest.mock("@/components/StatCard", () => () => <div data-testid="mock-stat-card" />);
jest.mock("@/components/table/DataTable", () => () => <div data-testid="mock-data-table" />);

describe("Admin Dashboard Unit Test", () => {
  it("fetches appointments and renders dashboard components successfully", async () => {
    const mockAppointments = {
      scheduledCount: 10,
      pendingCount: 5,
      cancelledCount: 2,
      documents: [],
    };

    (getRecentAppointmentList as jest.Mock).mockResolvedValue(mockAppointments);

    // Since AdminPage is an async Server Component, we invoke it and render the result
    const PageJSX = await AdminPage();
    render(PageJSX);

    // Verify the main heading
    expect(screen.getByText(/Welcome To Admin Dashboard/i)).toBeInTheDocument();

    // Verify that the header and data table are present
    expect(screen.getByTestId("mock-header")).toBeInTheDocument();
    expect(screen.getByTestId("mock-data-table")).toBeInTheDocument();

    // Verify that 3 StatCards are rendered (scheduled, pending, cancelled)
    expect(screen.getAllByTestId("mock-stat-card")).toHaveLength(3);
  });
});
