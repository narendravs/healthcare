import { render, screen, fireEvent } from "@testing-library/react";
import AppointmentModal from "@/components/AppointmentModal";
import "@testing-library/jest-dom";

// Mock AppointmentForm to isolate the modal component logic
jest.mock("@/components/forms/AppointmentForm", () => {
  return function MockAppointmentForm() {
    return <div data-testid="appointment-form">Mocked Appointment Form</div>;
  };
});

describe("AppointmentModal Unit Test", () => {
  const defaultProps = {
    patientId: "patient_123",
    userId: "user_123",
    title: "Schedule", // Required by prop types although not used in body
    description: "Please fill in details",
  };

  it("renders the trigger button with 'schedule' styling", () => {
    render(<AppointmentModal {...defaultProps} type="schedule" />);
    const trigger = screen.getByRole("button", { name: /schedule/i });
    
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveClass("text-green-500");
  });

  it("renders the trigger button with 'cancel' styling", () => {
    render(<AppointmentModal {...defaultProps} type="cancel" />);
    const trigger = screen.getByRole("button", { name: /cancel/i });
    
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveClass("text-red-500");
  });

  it("opens the dialog and displays correct headers when the trigger is clicked", () => {
    render(<AppointmentModal {...defaultProps} type="schedule" />);
    
    const trigger = screen.getByRole("button", { name: /schedule/i });
    fireEvent.click(trigger);
    
    // Check Dialog Title (capitalized type)
    expect(screen.getByText("schedule Appointment")).toBeInTheDocument();
    
    // Check Dialog Description
    expect(screen.getByText(/Please fill in the following details to schedule appointment/i)).toBeInTheDocument();
    
    // Check if the form is rendered
    expect(screen.getByTestId("appointment-form")).toBeInTheDocument();
  });
});
