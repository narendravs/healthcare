import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AppointmentModal from "@/components/AppointmentModal";
import "@testing-library/jest-dom";

// Mock AppointmentForm to verify integration with state (closing the modal)
jest.mock("@/components/forms/AppointmentForm", () => {
  return function MockAppointmentForm({ setOpen }: { setOpen: (val: boolean) => void }) {
    return (
      <div>
        <p>Appointment Form Content</p>
        <button onClick={() => setOpen(false)} data-testid="form-submit-trigger">
          Submit and Close Modal
        </button>
      </div>
    );
  };
});

describe("AppointmentModal Integration Flow", () => {
  const defaultProps = {
    patientId: "patient_123",
    userId: "user_123",
    title: "Action",
    description: "Action Description",
  };

  it("synchronizes the open state and closes when the internal form triggers setOpen(false)", async () => {
    render(<AppointmentModal {...defaultProps} type="schedule" />);

    const trigger = screen.getByRole("button", { name: /schedule/i });
    
    // Verify Modal is initially closed
    expect(screen.queryByText("Appointment Form Content")).not.toBeInTheDocument();

    // Open Modal
    fireEvent.click(trigger);
    expect(screen.getByText("Appointment Form Content")).toBeInTheDocument();

    // Simulate a successful form submission which calls setOpen(false)
    const submitBtn = screen.getByTestId("form-submit-trigger");
    fireEvent.click(submitBtn);

    // Verify the modal closes
    await waitFor(() => {
      expect(screen.queryByText("Appointment Form Content")).not.toBeInTheDocument();
    });
  });
});
