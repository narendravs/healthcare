import { render, screen } from "@testing-library/react";
import DataTable from "@/components/table/DataTable";
import { columns } from "@/components/table/columns";
import { decryptKey } from "@/lib/utils";
import "@testing-library/jest-dom";

// Mock dependencies
jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

jest.mock("@/lib/utils", () => ({
 ...jest.requireActual("@/lib/utils"),
  formatDateTime: jest.fn(() => ({
    dateTime: "Dec 25, 2024 - 10:00 AM",
  })),
  decryptKey: jest.fn(), // <--- Add this so decryptKey becomes a jest.Mock
}));

// Mock Doctors array explicitly to guarantee match
jest.mock("@/constants", () => ({
  ...jest.requireActual("@/constants"),
  Doctors: [
    {
      image: "/assets/images/dr-green.png",
      name: "John Green",
    },
  ],
}));

// Mock StatusBadge to verify props
jest.mock("@/components/StatusBadge", () => ({
  StatusBadge: ({ status }: { status: string }) => <div data-testid="status-badge">{status}</div>,
}));

// Mock AppointmentModal to verify it's receiving the right types
jest.mock("@/components/AppointmentModal", () => ({
  __esModule: true,
  default: ({ type }: { type: string }) => <div data-testid={`modal-${type}`}>{type}</div>,
}));

describe("Table Columns Integration Flow", () => {
  const mockData = [
    {
      $id: "appt_1",
      patient: { $id: "p_1", name: "John Patient" },
      status: "scheduled",
      schedule: new Date(),
      primaryPhysician: "John Green",
      userId: "user_1",
    },
  ];

  beforeEach(() => {
    // Table auth mocks
    localStorage.setItem("accessKey", "valid");
    (decryptKey as jest.Mock).mockReturnValue("123456");
    process.env.NEXT_PUBLIC_ADMIN_PASSKEY = "123456";
  });

  it("renders all custom cells correctly for an appointment row", () => {
    render(<DataTable columns={columns as any} data={mockData as any} />);

    // 1. Patient Name
    expect(screen.getByText("John Patient")).toBeInTheDocument();

    // 2. Status Badge
    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveTextContent("scheduled");

    // 3. Doctor Info
    // 👈 Use a regular expression or match the rendered "Dr. John Green" output
    expect(screen.getByText(/John Green/i)).toBeInTheDocument();
    
    // 👈 Match alt text accurately (columns.tsx uses `doctor.name` as alt text)
    expect(screen.getByAltText("doctor")).toBeInTheDocument();

    // 4. Action Modals (Schedule and Cancel)
    expect(screen.getByTestId("modal-schedule")).toBeInTheDocument();
    expect(screen.getByTestId("modal-cancel")).toBeInTheDocument();
  });

  it("renders the correct row index in the first column", () => {
    const multiData = [
        { ...mockData[0], $id: "1" },
        { ...mockData[0], $id: "2" }
    ];
    render(<DataTable columns={columns as any} data={multiData as any} />);
    
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
