import { render, screen } from "@testing-library/react";
import HomeContent from "@/components/home/HomeContent";
import { useSearchParams } from "next/navigation";
import "@testing-library/jest-dom";

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  usePathname: jest.fn(() => "/"),
}));

jest.mock("next-themes", () => ({
  useTheme: jest.fn(() => ({ theme: "light", setTheme: jest.fn() })),
}));

// Mock nested components to focus on integration logic of HomeContent
jest.mock("@/components/PasskeyModal", () => ({
  __esModule: true,
  default: () => <div data-testid="passkey-modal">Passkey Modal</div>,
}));

jest.mock("@/components/forms/PatientForm", () => ({
  __esModule: true,
  default: () => <div data-testid="patient-form">Patient Form</div>,
}));

describe("Home Page Integration Flow", () => {
  beforeAll(() => {
    // Polyfill window.crypto for randomUUID used in session tracking
    Object.defineProperty(window, 'crypto', {
      value: { randomUUID: () => 'test-uuid-123' },
      writable: true
    });
    
    // Mock sessionStorage
    const storageMock = (() => {
      let store: Record<string, string> = {};
      return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value.toString(); },
        clear: () => { store = {}; }
      };
    })();
    Object.defineProperty(window, 'sessionStorage', { value: storageMock });
  });

  it("triggers admin access modal when ?admin=true is present in URL", async () => {
    (useSearchParams as jest.Mock).mockReturnValue({
      get: (param: string) => (param === "admin" ? "true" : null),
    });

    render(<HomeContent />);
    expect(screen.getByTestId("passkey-modal")).toBeInTheDocument();
    expect(screen.getByTestId("patient-form")).toBeInTheDocument();
  });

  it("hides admin modal by default when no query params are provided", () => {
    (useSearchParams as jest.Mock).mockReturnValue({
      get: () => null,
    });

    render(<HomeContent />);
    expect(screen.queryByTestId("passkey-modal")).not.toBeInTheDocument();
  });
});
