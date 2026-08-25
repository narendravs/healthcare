import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RegisterForm from "@/components/forms/RegisterForm";
import { registerPatient } from "@/lib/actions/patient.actions";
import { useRouter } from "next/navigation";
import "@testing-library/jest-dom";

// Mock the router and the registration action
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/lib/actions/patient.actions", () => ({
  registerPatient: jest.fn(),
}));

// Mock FileUploader to avoid complex dropzone logic in integration test
jest.mock("@/components/FileUploader", () => {
  return function MockFileUploader({ onChange }: any) {
    return (
      <button onClick={() => onChange([new File([], "id_card.png")])}>
        Upload Mock File
      </button>
    );
  };
});

describe("Register Flow Integration Test", () => {
  const mockPush = jest.fn();
  const mockUser = {
    $id: "user_123",
    name: "John Doe",
    email: "john@example.com",
    phone: "+1234567890",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  });

  it("successfully submits registration and redirects to appointment creation", async () => {
    (registerPatient as jest.Mock).mockResolvedValue({ $id: "patient_123" });

    render(<RegisterForm user={mockUser} />);

    // 1. Verify initial data from user object is populated
    expect(screen.getByDisplayValue("John Doe")).toBeInTheDocument();
    expect(screen.getByDisplayValue("john@example.com")).toBeInTheDocument();

    // 2. Fill in required fields
    // We use getByLabelText as CustomFormField renders labels
    fireEvent.change(screen.getByLabelText(/Address/i), {
      target: { value: "123 Healthcare Ave, NY" },
    });
    fireEvent.change(screen.getByLabelText(/Occupation/i), {
      target: { value: "Software Engineer" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Guardian's name/i), {
      target: { value: "Jane Doe" },
    });

    // 3. Handle Select inputs (Physician)
    // Note: In shadcn/Radix select, we might need to simulate clicks on triggers
    // For simplicity in this integration example, we assume basic interaction or mock fields

    // 4. Agree to consents (CHECKBOX_GROUP)
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]); // Check first consent

    // 5. Submit the form
    const submitBtn = screen.getByRole("button", { name: /Submit and Continue/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // Check if the action was called with the user ID and address
      expect(registerPatient).toHaveBeenCalledWith(
        expect(expect.objectContaining({
          userId: "user_123",
          address: "123 Healthcare Ave, NY",
        }))
      );
      expect(mockPush).toHaveBeenCalledWith("/patients/user_123/new-appointment");
    });
  });
});
