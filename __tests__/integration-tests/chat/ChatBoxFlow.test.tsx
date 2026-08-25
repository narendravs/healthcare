import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ChatBox from "@/components/chat/ChatBox";
import "@testing-library/jest-dom";

// Mock global fetch
global.fetch = jest.fn();

// Mock child components to isolate the integration of ChatBox state and API logic
jest.mock("@/components/chat/ChatMessage", () => ({
  __esModule: true,
  default: ({ message }: { message: { content: string } }) => (
    <div data-testid="chat-message">{message.content}</div>
  ),
}));

jest.mock("@/components/PasskeyModal", () => ({
  __esModule: true,
  default: () => <div data-testid="passkey-modal">Passkey Modal</div>,
}));

describe("ChatBox Integration Flow", () => {
  const mockOnClose = jest.fn();
  const defaultProps = {
    onClose: mockOnClose,
    type: "database" as const,
    sessionId: "test-session-123",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it("successfully performs a database search", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: "There are 42 active appointments." }),
    });

    render(<ChatBox {...defaultProps} />);

    const input = screen.getByPlaceholderText(/Type your query/i);
    fireEvent.change(input, { target: { value: "Appointment count?" } });
    // Submit via the form since the button has no text label (SVG)
    fireEvent.submit(screen.getByPlaceholderText(/Type your query/i).closest('form')!);

    expect(screen.getByText("Thinking...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("There are 42 active appointments.")).toBeInTheDocument();
    });
    
    expect(global.fetch).toHaveBeenCalledWith("/api/embeddings/search/mcp-db-server", expect.anything());
  });

  it("formats document search results with verification badges", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: "Patient has no allergies.",
        meta: { isValidated: true, documentChecked: "medical_history.pdf" }
      }),
    });

    render(<ChatBox {...defaultProps} type="documents" />);

    fireEvent.change(screen.getByPlaceholderText(/Type your query/i), { target: { value: "Any allergies?" } });
    fireEvent.submit(screen.getByPlaceholderText(/Type your query/i).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/🟢 \[Verified Ground-Truth Source: medical_history.pdf\]/i)).toBeInTheDocument();
      expect(screen.getByText(/Patient has no allergies/i)).toBeInTheDocument();
    });
  });

  it("opens PasskeyModal on successful appointment creation via API Agent", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ output: "The appointment was created successfully." }),
    });

    render(<ChatBox {...defaultProps} type="apicall" />);

    fireEvent.change(screen.getByPlaceholderText(/Type your query/i), { target: { value: "Book me for tomorrow" } });
    fireEvent.submit(screen.getByPlaceholderText(/Type your query/i).closest('form')!);

    await waitFor(() => {
      expect(screen.getByTestId("passkey-modal")).toBeInTheDocument();
      expect(screen.getByText(/Please enter the passcode to access the admin page/i)).toBeInTheDocument();
    });
  });

  it("handles API errors gracefully by showing a fallback message", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network fail"));

    render(<ChatBox {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText(/Type your query/i), { target: { value: "Fail me" } });
    fireEvent.submit(screen.getByPlaceholderText(/Type your query/i).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/An error occurred. Please try again./i)).toBeInTheDocument();
    });
  });
});
