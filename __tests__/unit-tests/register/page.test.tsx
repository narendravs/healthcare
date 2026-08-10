import { render, screen } from "@testing-library/react";
import Register from "@/app/patients/[userId]/register/page";
import { getUser, getPatient } from "@/lib/actions/patient.actions";
import { redirect } from "next/navigation";
import "@testing-library/jest-dom";

// Mock server actions and navigation
jest.mock("@/lib/actions/patient.actions", () => ({
  getUser: jest.fn(),
  getPatient: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

// Mock the RegisterForm to isolate page logic
jest.mock("@/components/forms/RegisterForm", () => {
  return function MockRegisterForm() {
    return <div data-testid="register-form">Register Form Component</div>;
  };
});

describe("Register Page Unit Test", () => {
  const mockParams = Promise.resolve({ userId: "user_123" });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects to appointment page if patient already has documents", async () => {
    (getUser as jest.Mock).mockResolvedValue({ $id: "user_123", name: "John Doe" });
    (getPatient as jest.Mock).mockResolvedValue({ 
      $id: "patient_123", 
      documents: ["doc_url_1"] 
    });

    await Register({ params: mockParams });

    expect(redirect).toHaveBeenCalledWith("/patients/user_123/new-appointment");
  });

  it("renders the registration layout and form if patient is not yet registered", async () => {
    (getUser as jest.Mock).mockResolvedValue({ $id: "user_123", name: "John Doe" });
    (getPatient as jest.Mock).mockResolvedValue(null);

    const pageElement = await Register({ params: mockParams });
    render(pageElement);

    expect(screen.getByText(/Welcome To Patient Registration/i)).toBeInTheDocument();
    expect(screen.getByTestId("register-form")).toBeInTheDocument();
  });
});
