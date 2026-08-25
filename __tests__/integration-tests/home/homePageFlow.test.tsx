import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HomeContent from "@/components/home/HomeContent";
import { useSearchParams } from "next/navigation";
import "@testing-library/jest-dom";

// Mocking Next.js navigation hooks
jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
  usePathname: jest.fn(() => "/"),
}));

// Mocking next-themes
jest.mock("next-themes", () => ({
  useTheme: jest.fn(() => ({ theme: "light", setTheme: jest.fn() })),
}));

// Mocking Child Components to focus on integration logic within HomeContent
jest.mock("@/components/PasskeyModal", () => ({
  __esModule: true,
  default: () => <div data-testid="passkey-modal">Passkey Modal</div>,
}));

jest.mock("@/components/forms/PatientForm", () => ({
  __esModule: true,
  default: () => <div data-testid="patient-form">Patient Form</div>,
}));

jest.mock("@/components/chat/ChatBox", () => ({
  __esModule: true,
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="chat-box">
      Chat Box Content
      <button onClick={onClose} data-testid="close-chat">Close</button>
    </div>
  ),
}));

describe("Home Page Integration Flow", () => {
  const mockSearchParams = new URLSearchParams();

  beforeAll(() => {
    // Polyfill window.crypto.randomUUID for session tracking logic
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
        clear: () => { store = {}; },
        removeItem: (key: string) => { delete store[key]; }
      };
    })();
    Object.defineProperty(window, 'sessionStorage', { value: storageMock });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams(""));
  });

  it("initializes a chat session and renders main UI components", () => {
    render(<HomeContent />);

    // Verify components
    expect(screen.getByTestId("patient-form")).toBeInTheDocument();
    expect(screen.getByAltText("patient")).toBeInTheDocument();
    
    // Verify session storage initialization
    expect(sessionStorage.getItem("active_chat_session")).toBe("session_test-uuid-123");
  });

  it("renders PasskeyModal only when admin query param is true", () => {
    // Case 1: No admin param
    const { rerender } = render(<HomeContent />);
    expect(screen.queryByTestId("passkey-modal")).not.toBeInTheDocument();

    // Case 2: Admin param is true
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams("admin=true"));
    rerender(<HomeContent />);
    expect(screen.getByTestId("passkey-modal")).toBeInTheDocument();
  });

  it("handles the ChatBox opening and closing flow", async () => {
    render(<HomeContent />);
    
    // Initially closed
    expect(screen.queryByTestId("chat-box")).not.toBeInTheDocument();

    // Open chat
    const chatBtn = screen.getByText(/Hey! chat with me/i);
    fireEvent.click(chatBtn);
    expect(screen.getByTestId("chat-box")).toBeInTheDocument();

    // Close chat
    const closeBtn = screen.getByTestId("close-chat");
    fireEvent.click(closeBtn);
    
    await waitFor(() => {
      expect(screen.queryByTestId("chat-box")).not.toBeInTheDocument();
    });
  });
});
