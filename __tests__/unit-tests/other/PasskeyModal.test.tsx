import { render, screen, fireEvent } from "@testing-library/react";
import PasskeyModal from "@/components/PasskeyModal";
import { useRouter, usePathname } from "next/navigation";
import "@testing-library/jest-dom";

// Mock Next.js navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

// Mock utils
jest.mock("@/lib/utils", () => ({
  decryptKey: jest.fn(),
  encryptKey: jest.fn(),
}));

describe("PasskeyModal Unit Test", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (usePathname as jest.Mock).mockReturnValue("/admin");
  });

  it("renders the modal with correct title and description", () => {
    render(<PasskeyModal />);
    expect(screen.getByText(/Admin Access Verifiction/i)).toBeInTheDocument();
    expect(screen.getByText(/To access the admin page, please enter the passkey/i)).toBeInTheDocument();
  });

  it("shows an error message when validation fails", () => {
    process.env.NEXT_PUBLIC_ADMIN_PASSKEY = "123456";
    render(<PasskeyModal />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "000000" } });

    const validateBtn = screen.getByRole("button", { name: /Enter Admin Passkey/i });
    fireEvent.click(validateBtn);

    expect(screen.getByText(/Invalid passkey. Please try again./i)).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalledWith("/admin");
  });

  it("closes the modal and redirects to home when close icon is clicked", () => {
    render(<PasskeyModal />);
    const closeIcon = screen.getByAltText("close");
    fireEvent.click(closeIcon);

    expect(mockPush).toHaveBeenCalledWith("/");
  });
});
