import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PasskeyModal from "@/components/PasskeyModal";
import { useRouter, usePathname } from "next/navigation";
import "@testing-library/jest-dom";

// Mock Next.js navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

// Mock encryption utils
jest.mock("@/lib/utils", () => ({
  encryptKey: (val: string) => `encrypted_${val}`,
  decryptKey: (val: string) => val.replace("encrypted_", ""),
}));

describe("Admin Access Integration Flow", () => {
  const mockPush = jest.fn();
  const ADMIN_PASSKEY = "123456";

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (usePathname as jest.Mock).mockReturnValue("/");
    
    // Mock Environment Variables
    process.env.NEXT_PUBLIC_ADMIN_PASSKEY = ADMIN_PASSKEY;
    
    // Clear localStorage
    localStorage.clear();
  });

  it("blocks access and shows error for incorrect passkey", async () => {
    render(<PasskeyModal />);

    // OTP inputs usually render an underlying input or role textbox
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "000000" } });

    const enterButton = screen.getByRole("button", { name: /Enter Admin Passkey/i });
    fireEvent.click(enterButton);

    // Check for error message
    const errorMessage = await screen.findByText(/Invalid passkey/i);
    expect(errorMessage).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalledWith("/admin");
  });

  it("grants access, saves to localStorage, and redirects on correct passkey", async () => {
    render(<PasskeyModal />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: ADMIN_PASSKEY } });

    const enterButton = screen.getByRole("button", { name: /Enter Admin Passkey/i });
    fireEvent.click(enterButton);

    await waitFor(() => {
      // Check if key is encrypted and stored
      expect(localStorage.getItem("accessKey")).toBe(`encrypted_${ADMIN_PASSKEY}`);
      // Check if redirected to admin
      expect(mockPush).toHaveBeenCalledWith("/admin");
    });
  });

  it("automatically redirects to /admin if a valid key already exists in localStorage", async () => {
    // Pre-populate localStorage with valid encrypted key
    localStorage.setItem("accessKey", `encrypted_${ADMIN_PASSKEY}`);

    render(<PasskeyModal />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin");
    });
  });
});
