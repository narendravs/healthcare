import { render, screen, waitFor } from "@testing-library/react";
import RequestSuccess from "@/app/patients/[userId]/new-appointment/success/page";
import { getAppointment } from "@/lib/actions/appointment.actions";
import { useSearchParams, useParams } from "next/navigation";
import "@testing-library/jest-dom";

// Mock Next.js navigation
jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
  useParams: jest.fn(),
}));

// Mock server actions
jest.mock("@/lib/actions/appointment.actions", () => ({
  getAppointment: jest.fn(),
}));

// Mock constants to ensure predictable test results
jest.mock("../../../../../constants", () => ({
  Doctors: [
    { name: "John Doe", image: "/assets/images/dr-john.png" },
  ],
}));

describe("Success Page Unit Test", () => {
  const mockAppointment = {
    $id: "appt_123",
    primaryPhysician: "John Doe",
    schedule: new Date("2024-12-25T10:00:00Z"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useSearchParams as jest.Mock).mockReturnValue({
      get: (key: string) => (key === "appointmentId" ? "appt_123" : null),
    });
    (useParams as jest.Mock).mockReturnValue({ userId: "user_456" });
    (getAppointment as jest.Mock).mockResolvedValue(mockAppointment);
  });

  it("renders the static success UI elements immediately", () => {
    render(<RequestSuccess />);
    
    expect(screen.getByAltText("logo")).toBeInTheDocument();
    expect(screen.getByAltText("success")).toBeInTheDocument();
    // Matching the typo 'sumbitted' found in the component
    expect(screen.getByText(/successfully sumbitted/i)).toBeInTheDocument();
  });

  it("triggers data fetching using the appointmentId from URL", async () => {
    render(<RequestSuccess />);

    await waitFor(() => {
      expect(getAppointment).toHaveBeenCalledWith("appt_123");
    });
    
    // Check if the doctor's name from the mock data appears
    expect(await screen.findByText(/Dr. John Doe/i)).toBeInTheDocument();
  });
});
