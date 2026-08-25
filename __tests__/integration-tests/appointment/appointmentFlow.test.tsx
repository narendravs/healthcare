import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AppointmentForm from "@/components/forms/AppointmentForm";
import { createAppointment } from "@/lib/actions/appointment.actions";
import { useRouter } from "next/navigation";
import { Controller } from "react-hook-form";
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

// Mock CustomFormField using RHF Controller for proper state binding
jest.mock("@/components/CustomFormField", () => {
  const Actual = jest.requireActual("@/components/CustomFormField");
  return {
    ...Actual,
    __esModule: true,
    default: (props: any) => {
      // Render simple inputs for date/select to make testing easier
      if (props.fieldType === "datePicker" || props.fieldType === "select") {
        return (
          <Controller
            control={props.control}
            name={props.name}
            render={({ field }) => (
          <div>
            <label htmlFor={props.name}>{props.label}</label>
            <input 
              id={props.name}
              value={field.value ? (field.value instanceof Date ? field.value.toISOString() : field.value) : ""} 
              onChange={(e) => {
                    const val = props.fieldType === "datePicker" ? new Date(e.target.value) : e.target.value;
                    field.onChange(val);
                  }}
              placeholder={props.placeholder}
            />
          </div>
        )}
     />
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

    // 1. Fill Doctor (Select)
    fireEvent.change(screen.getByLabelText(/Doctor/i), {
      target: { value: "dr_green" },
    });

    // 2. Fill Date/Time (DatePicker)
    const testDate = "2026-08-25T10:00:00.000Z";
    fireEvent.change(screen.getByLabelText(/Expected appointment date/i), {
      target: { value: testDate },
    });

    // 3. Fill Reason & Note (Textareas)
    fireEvent.change(screen.getByLabelText(/Appointment reason/i), {
      target: { value: "Annual checkup" },
    });
    fireEvent.change(screen.getByLabelText(/Comments\/notes/i), {
      target: { value: "Please call on arrival" },
    });

    // 4. Submit Form
    const submitBtn = screen.getByRole("button", { name: /Submit Appointment/i });
    fireEvent.click(submitBtn);

    // 5. Assertions
    await waitFor(() => {
      expect(createAppointment).toHaveBeenCalledTimes(1);
      expect(createAppointment).toHaveBeenCalledWith({
        userId: "user_123",
        patient: "patient_123",
        primaryPhysician: "dr_green",
        reason: "Annual checkup",
        schedule: expect.any(Date),
        status: "pending",
        note: "Please call on arrival",
      });
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining("/success?appointmentId=new_appt_789")
      );
    });
  });
});