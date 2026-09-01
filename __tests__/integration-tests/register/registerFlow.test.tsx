import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RegisterForm from "@/components/forms/RegisterForm";
import { registerPatient } from "@/lib/actions/patient.actions";
import { useRouter } from "next/navigation";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

// Mock router and registration action
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/lib/actions/patient.actions", () => ({
  registerPatient: jest.fn(),
}));

// Preserve actual constants and ensure fallback options are present
jest.mock("@/constants", () => {
  const actual = jest.requireActual("@/constants");
  return {
    ...actual,
    GenderOptions: actual.GenderOptions || ["Male", "Female", "Other"],
    Doctors: actual.Doctors || [
      { name: "Dr. Lee", image: "/assets/images/dr-lee.png" },
      { name: "Dr. Green", image: "/assets/images/dr-green.png" },
    ],
    IdentificationTypes: actual.IdentificationTypes || [
      "Birth Certificate",
      "Driver's License",
      "State ID Card",
    ],
  };
});

// Radix Select Mock
jest.mock("@/components/ui/select", () => {
  const React = require("react");
  const SelectContext = React.createContext<(val: string) => void>(() => {});

  return {
    Select: ({ children, onValueChange }: any) => (
      <SelectContext.Provider value={onValueChange}>
        <div data-testid="mock-select">{children}</div>
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children }: any) => <button type="button">{children}</button>,
    SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
    SelectContent: ({ children }: any) => <div>{children}</div>,
    SelectItem: ({ value, children }: any) => {
      const onValueChange = React.useContext(SelectContext);
      return (
        <div
          role="option"
          data-testid={`select-item-${value}`}
          data-value={value}
          onClick={() => {
            console.log(`[DEBUG] SelectItem Clicked with Value: "${value}"`);
            if (onValueChange) onValueChange(value);
          }}
        >
          {children || value}
        </div>
      );
    },
  };
});

describe("Register Flow Integration Test with Debug Logs", () => {
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

    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.scrollIntoView = jest.fn();

    if (typeof window.URL.createObjectURL !== "function") {
      Object.defineProperty(window.URL, "createObjectURL", {
        writable: true,
        value: jest.fn(() => "blob:http://localhost/mock-url"),
      });
    }
    if (typeof window.URL.revokeObjectURL !== "function") {
      Object.defineProperty(window.URL, "revokeObjectURL", {
        writable: true,
        value: jest.fn(),
      });
    }
  });

  it("successfully submits registration with detailed attribute logging", async () => {
    console.log("=== STARTING FORM INTEGRATION TEST ===");
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    (registerPatient as jest.Mock).mockImplementation(async (patientPayload) => {
      console.log("\n==============================================");
      console.log("[DEBUG] Server Action `registerPatient` CALLED!");
      console.log("[DEBUG] Full Received Payload Structure:");
      console.dir(patientPayload, { depth: null });
      console.log("==============================================\n");
      return { $id: "patient_123" };
    });

    const { container } = render(<RegisterForm user={mockUser} />);

    // 1. Verify pre-filled defaults
    const nameInput = screen.getByDisplayValue("John Doe") as HTMLInputElement;
    const emailInput = screen.getByDisplayValue("john@example.com") as HTMLInputElement;
    console.log(`[DEBUG 1] Name Input Default: "${nameInput.value}"`);
    console.log(`[DEBUG 1] Email Input Default: "${emailInput.value}"`);

    // 2. Address
    const addressInput = (screen.queryByPlaceholderText(/14 street/i) ||
      container.querySelectorAll('input[type="text"]')[2]) as HTMLInputElement;
    if (addressInput) {
      await user.type(addressInput, "123 Healthcare Ave, NY");
      console.log(`[DEBUG 2] Address Input Value Set To: "${addressInput.value}"`);
    }

    // 3. Occupation
    const occupationInput = (screen.queryByPlaceholderText(/Software Engineer/i) ||
      screen.queryByLabelText(/Occupation/i) ||
      container.querySelectorAll('input[type="text"]')[3]) as HTMLInputElement;
    if (occupationInput) {
      await user.type(occupationInput, "Software Engineer");
      console.log(`[DEBUG 3] Occupation Value Set To: "${occupationInput.value}"`);
    }

    // 4. Emergency Contact Name
    const guardianInput = (screen.queryByPlaceholderText(/Guardian's name/i) ||
      container.querySelectorAll('input[type="text"]')[4]) as HTMLInputElement;
    if (guardianInput) {
      await user.type(guardianInput, "Jane Doe");
      console.log(`[DEBUG 4] Guardian Value Set To: "${guardianInput.value}"`);
    }
    
    // 5. Emergency Contact Number
      const emergencyPhoneInput =
      screen.queryByLabelText(/emergency phone number/i) ||
      container.querySelector('input[name="emergencyContactNumber"]') ||
      container.querySelectorAll('.PhoneInputInput')[1];

    if (emergencyPhoneInput) {
      fireEvent.change(emergencyPhoneInput, { target: { value: "+12025550199" } });
      console.log('[DEBUG 5] Emergency Contact Phone Value Set To: "+12025550199"');
    }

    // 6. Birth Date
    const dobInput = (container.querySelector(".react-datepicker__input-container input") ||
      container.querySelector('input[name="birthDate"]') ||
      screen.getByPlaceholderText(/MM\/DD\/YYYY|yyyy|19|20\d\d/i)) as HTMLInputElement;
    if (dobInput) {
      fireEvent.change(dobInput, { target: { value: "05/15/1995" } });
      console.log(`[DEBUG 6] Birth Date Value Set To: "${dobInput.value}"`);
    }

    // --- FIX FOR VALIDATION ERRORS ---
    // 7. Insurance Information (Required by Zod Schema)
        const insuranceProviderInput = (
      screen.queryByPlaceholderText(/blue cross/i) ||
      screen.queryByLabelText(/insurance provider/i) ||
      container.querySelector('input[name="insuranceProvider"]')
    ) as HTMLInputElement;

    if (insuranceProviderInput) {
      await user.clear(insuranceProviderInput);
      await user.type(insuranceProviderInput, "Blue Cross Blue Shield");
      console.log(`[DEBUG 7.1] Insurance Provider Set To: "${insuranceProviderInput.value}"`);
    }

    const insurancePolicyInput = (
      screen.queryByPlaceholderText(/abc123456789/i) ||
      screen.queryByLabelText(/insurance policy number/i) ||
      container.querySelector('input[name="insurancePolicyNumber"]')
    ) as HTMLInputElement;

    if (insurancePolicyInput) {
      await user.clear(insurancePolicyInput);
      await user.type(insurancePolicyInput, "POL-123456789");
      console.log(`[DEBUG 7.2] Insurance Policy Set To: "${insurancePolicyInput.value}"`);
    }
    // 8. Gender selection
    const maleRadio =
      screen.queryByTestId("radio-Male") ||
      screen.getAllByRole("radio")[0] ||
      screen.getAllByText(/Male/i)[0];
    await user.click(maleRadio);
    console.log(`[DEBUG 7] Gender Option Selected`);

    // 8. Doctor Selection
    const doctorOption =
      screen.queryByTestId("select-item-John Green") ||
      screen.queryByTestId("select-item-dr-green") ||
      container.querySelector('[data-testid^="select-item-"]');
    if (doctorOption) {
      fireEvent.click(doctorOption);
    }

    // 9. Identification Type Selection (Target specifically non-doctor option)
    const idTypeOption =
      screen.queryByTestId("select-item-Birth Certificate") ||
      screen.queryByTestId("select-item-Driver's License") ||
      screen.queryByTestId("select-item-Passport") ||
      Array.from(container.querySelectorAll('[data-testid^="select-item-"]')).find(
        (el) => !el.getAttribute("data-testid")?.includes("Green")
      );
    if (idTypeOption) {
      fireEvent.click(idTypeOption);
    }
    // 10. Identification Number
    const idNumberInput = (
      screen.queryByLabelText(/Identification Number/i) ||
      container.querySelector('input[name="identificationNumber"]') ||
      screen.queryByPlaceholderText(/^123456789$/i)
    ) as HTMLInputElement;

    if (idNumberInput) {
      await user.clear(idNumberInput);
      await user.type(idNumberInput, "987654321");
      console.log(`[DEBUG 9] Identification Number Value Set To: "${idNumberInput.value}"`);
    }

    // 11. File Upload
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      const file = new File(["dummy content"], "id_card.png", { type: "image/png" });
      await user.upload(fileInput, file);
      fireEvent.change(fileInput, { target: { files: [file] } });
    }

    // 12. Consent Checkboxes
    const consentCheckboxes = screen.getAllByRole("checkbox");
    console.log(`[DEBUG 11] Toggling ${consentCheckboxes.length} consent checkboxes...`);
    for (const checkbox of consentCheckboxes) {
      await user.click(checkbox);
    }

    // 13. Submit Form
    const submitBtn = screen.getByRole("button", {
      name: /Submit and Continue|Get Started/i,
    });
    console.log(`[DEBUG 12] Submit Button Found. Triggering Click...`);
    await user.click(submitBtn);

    // Diagnostics check for validation errors
    const invalidElements = container.querySelectorAll('[aria-invalid="true"]');
    if (invalidElements.length > 0) {
      console.error(`[VALIDATION FAILED] ${invalidElements.length} fields are invalid.`);
      invalidElements.forEach((el) => console.error(" - Field:", el.getAttribute("name") || el.id));
    }

    // 13. Verification with Timeout
    console.log(`[DEBUG 13] Waiting for Server Action and Navigation...`);
    await waitFor(
      () => {
        expect(registerPatient).toHaveBeenCalled();
        console.log(`[DEBUG SUCCESS] registerPatient was invoked successfully!`);

        expect(mockPush).toHaveBeenCalledWith("/patients/user_123/new-appointment");
        console.log(`[DEBUG SUCCESS] Router redirected to "/patients/user_123/new-appointment"`);
      },
      { timeout: 10000 }
    );
  }, 50000);
});