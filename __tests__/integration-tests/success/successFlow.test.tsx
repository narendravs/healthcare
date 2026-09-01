import { render, screen, waitFor } from "@testing-library/react";
import RequestSuccess from "@/app/patients/[userId]/new-appointment/success/page";
import { getAppointment } from "@/lib/actions/appointment.actions";
import { useSearchParams, useParams } from "next/navigation";
import "@testing-library/jest-dom";

// Mocking Next.js navigation hooks
jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
  useParams: jest.fn(),
}));

// Mocking server actions
jest.mock("@/lib/actions/appointment.actions", () => ({
  getAppointment: jest.fn(),
}));

// Mocking utility for consistent date strings
jest.mock("@/lib/utils", () => ({
  ...jest.requireActual("@/lib/utils"),
  formatDateTime: jest.fn(() => ({
    dateTime: "Dec 25, 2024 - 10:00 AM",
  })),
}));

describe("Success Flow Integration Test", () => {
  const userId = "patient_abc";
  const appointmentId = "appt_xyz";

  beforeEach(() => {
    jest.clearAllMocks();
    (useSearchParams as jest.Mock).mockReturnValue({
      get: (key: string) => (key === "appointmentId" ? appointmentId : null),
    });
    (useParams as jest.Mock).mockReturnValue({ userId });
  });

  it("displays the correct doctor and formatted date after successful fetch", async () => {
    (getAppointment as jest.Mock).mockResolvedValue({
      primaryPhysician: "Dr. Adam Smith",
      schedule: new Date(),
    });

    render(<RequestSuccess />);

    await waitFor(() => {
      expect(screen.getByText(/Dr. Adam Smith/i)).toBeInTheDocument();
      expect(screen.getByText("Dec 25, 2024 - 10:00 AM")).toBeInTheDocument();
    });

    // Verify the "New Appointment" button points to the correct patient path
    const newApptBtn = screen.getByRole("link", { name: /New Appointment/i });
    expect(newApptBtn).toHaveAttribute("href", `/patients/${userId}/new-appointment`);
  });

  it("uses the fallback doctor image when physician name does not match constants", async () => {
    (getAppointment as jest.Mock).mockResolvedValue({
      primaryPhysician: "Unknown Physician",
      schedule: new Date(),
    });

    render(<RequestSuccess />);

    await waitFor(() => {
      const doctorImg = screen.getByAltText("doctor");
      // Check if src contains the fallback image path
      expect(doctorImg).toHaveAttribute("src", expect.stringContaining("default-doctor.jpg"));
    });
  });
});
