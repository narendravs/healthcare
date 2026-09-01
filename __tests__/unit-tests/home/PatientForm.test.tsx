import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PatientForm from "@/components/forms/PatientForm";
import { useRouter } from "next/navigation";
import { createUser, getUserByExactName } from "@/lib/actions/patient.actions";
import "@testing-library/jest-dom";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/lib/actions/patient.actions", () => ({
  createUser: jest.fn(),
  getUserByExactName: jest.fn(),
}));

describe("PatientForm Unit Test", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  });

  it("renders all required form fields", () => {
    render(<PatientForm />);
    expect(screen.getByPlaceholderText("John Doe")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("johndoe@gmail.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("(555) 123-4567")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Get Started/i })).toBeInTheDocument();
  });

  it("calls createUser and redirects to registration when submitting a new patient", async () => {
    // Mocking user not found in DB
    (getUserByExactName as jest.Mock).mockResolvedValue(null);
    (createUser as jest.Mock).mockResolvedValue({ $id: "new_id_123" });

    render(<PatientForm />);

    fireEvent.change(screen.getByPlaceholderText("John Doe"), { target: { value: "John Doe" } });
    fireEvent.change(screen.getByPlaceholderText("johndoe@gmail.com"), { target: { value: "john@test.com" } });
    fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), { target: { value: "+11234567890" } });

    const submitBtn = screen.getByRole("button", { name: /Get Started/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(getUserByExactName).toHaveBeenCalledWith("John Doe");
      expect(createUser).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/patients/new_id_123/register");
    });
  });
});
