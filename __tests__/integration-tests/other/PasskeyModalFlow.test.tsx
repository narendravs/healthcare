import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PasskeyModal from "@/components/PasskeyModal";
import { useRouter, usePathname } from "next/navigation";
import { decryptKey, encryptKey } from "@/lib/utils";
import "@testing-library/jest-dom";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock("@/lib/utils", () => ({
  decryptKey: jest.fn(),
  encryptKey: jest.fn(),
}));

describe("PasskeyModal Integration Flow", () => {
  const mockPush = jest.fn();
  const ADMIN_PASSKEY = "123456";

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (usePathname as jest.Mock).mockReturnValue("/");
    process.env.NEXT_PUBLIC_ADMIN_PASSKEY = ADMIN_PASSKEY;
    
    // Mock localStorage
    const storage: Record<string, string> = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn((key) => storage[key] || null),
        setItem: jest.fn((key, value) => { storage[key] = value; }),
        removeItem: jest.fn((key) => { delete storage[key]; }),
        clear: jest.fn(() => { for (const key in storage) delete storage[key]; }),
      },
      writable: true
    });
  });

  it("successfully validates passkey, stores it, and redirects to admin", async () => {
    (encryptKey as jest.Mock).mockReturnValue("encrypted_123456");

    render(<PasskeyModal />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: ADMIN_PASSKEY } });

    const validateBtn = screen.getByRole("button", { name: /Enter Admin Passkey/i });
    fireEvent.click(validateBtn);

    expect(encryptKey).toHaveBeenCalledWith(ADMIN_PASSKEY);
    expect(localStorage.setItem).toHaveBeenCalledWith("accessKey", "encrypted_123456");
    expect(mockPush).toHaveBeenCalledWith("/admin");
  });

  it("automatically redirects if a valid key is already present in localStorage", async () => {
    localStorage.setItem("accessKey", "encrypted_stored_key");
    (decryptKey as jest.Mock).mockReturnValue(ADMIN_PASSKEY);

    render(<PasskeyModal />);

    await waitFor(() => {
      expect(decryptKey).toHaveBeenCalledWith("encrypted_stored_key");
      expect(mockPush).toHaveBeenCalledWith("/admin");
    });
  });
});
