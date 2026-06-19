import { render, screen } from "@testing-library/react";
import AppointmentPage from "@/app/patients/[userId]/new-appointment/page";
import { getPatient } from "@/lib/actions/patient.actions";
import "@testing-library/jest-dom";

// Mock server actions
jest.mock("@/lib/actions/patient.actions", () => ({
  getPatient: jest.fn(),
}));

// Mock the client wrapper to isolate page logic
jest.mock("@/components/appointment/AppointmentClientWrapper", () => {
  return function MockWrapper({ patient, userId }: any) {
    return (
      <div data-testid="appointment-wrapper">
        Wrapper for {userId} - Patient: {patient?.name || "null"}
      </div>
    );
  };
});

describe("New Appointment Page Unit Test", () => {
  const mockParams = { userId: "user_123" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches patient data and renders the Client Wrapper successfully", async () => {
    (getPatient as jest.Mock).mockResolvedValue({ $id: "patient_123", name: "John Doe" });

    const PageJSX = await AppointmentPage({ params: mockParams });
    render(PageJSX);

    expect(getPatient).toHaveBeenCalledWith("user_123");
    expect(screen.getByTestId("appointment-wrapper")).toHaveTextContent("Wrapper for user_123 - Patient: John Doe");
  });
});
