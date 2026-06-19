import { render, screen, fireEvent } from "@testing-library/react";
import ChatBox from "@/components/chat/ChatBox";
import "@testing-library/jest-dom";

// Mock child components to isolate ChatBox logic
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

describe("ChatBox Unit Test", () => {
  const mockOnClose = jest.fn();
  const defaultProps = {
    onClose: mockOnClose,
    type: "database" as const,
    sessionId: "test-session-123",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly with initial greeting", () => {
    render(<ChatBox {...defaultProps} />);
    expect(screen.getByText(/Chat/i)).toBeInTheDocument();
    expect(screen.getByText(/Hello! How can I help you today?/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type your query/i)).toBeInTheDocument();
  });

  it("updates input field correctly", () => {
    render(<ChatBox {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Type your query/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "How many patients?" } });
    expect(input.value).toBe("How many patients?");
  });

  it("triggers onClose with the current data type when close button is clicked", () => {
    render(<ChatBox {...defaultProps} />);
    // Finding the close button (icon button in header)
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    
    expect(mockOnClose).toHaveBeenCalledWith("database");
  });
});
