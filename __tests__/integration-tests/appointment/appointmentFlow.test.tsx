import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AppointmentForm from "@/components/forms/AppointmentForm";
import { createAppointment } from "@/lib/actions/appointment.actions";
import { useRouter } from "next/navigation";
import "@testing-library/jest-dom";

// Mock navigation and server actions
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/lib/actions/appointment.actions", () => ({
  createAppointment: jest.fn(),
  updateAppointment: jest.fn(),
  getAppointment: jest.fn(),
  cancelOppoitment: jest.fn(),
}));

// Mocking DateTimePicker as it can be complex to interact with in JSDOM
jest.mock("@/components/CustomFormField", () => {
  const Actual = jest.requireActual("@/components/CustomFormField");
  return {
    ...Actual,
    __esModule: true,
    default: (props: any) => {
      // Render simple inputs for date/select to make testing easier
      if (props.fieldType === "datePicker" || props.fieldType === "select") {
        return (
          <div>
            <label htmlFor={props.name}>{props.label}</label>
            <input 
              id={props.name} 
              onChange={(e) => props.control._fields[props.name]._f.onChange(e.target.value)}
              placeholder={props.placeholder}
            />
          </div>
        );
      }
      return <Actual.default {...props} />;
    }
  };
});

describe("Appointment Flow Integration Test", () => {
  const mockPush = jest.fn();
  const mockSetOpen = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  });

  it("submits the form and redirects to the success page upon valid creation", async () => {
    (createAppointment as jest.Mock).mockResolvedValue({ $id: "new_appt_789" });

    render(
      <AppointmentForm 
        patientId="patient_123" 
        userId="user_123" 
        type="create" 
        setOpen={mockSetOpen} 
      />
    );

    // Fill in required text areas
    fireEvent.change(screen.getByLabelText(/Appointment reason/i), { target: { value: "Annual checkup" } });
    fireEvent.change(screen.getByLabelText(/Comments\/notes/i), { target: { value: "Please call on arrival" } });

    const submitBtn = screen.getByRole("button", { name: /Submit Appointment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createAppointment).toHaveBeenCalledWith(expect.objectContaining({
        reason: "Annual checkup",
        patient: "patient_123"
      }));
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("/success?appointmentId=new_appt_789"));
    });
  });
});
