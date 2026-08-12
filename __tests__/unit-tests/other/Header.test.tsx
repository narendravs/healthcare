import { render, screen, fireEvent } from "@testing-library/react";
import Header from "@/components/Header";
import "@testing-library/jest-dom";

// Mock sub-components
jest.mock("@/components/chat/ChatBox", () => ({
  __esModule: true,
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="chat-box">
      <button onClick={onClose} data-testid="close-chat-btn">Close</button>
    </div>
  ),
}));

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

describe("Header Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window.alert to prevent actual dialogs during tests
    window.alert = jest.fn();
  });

  it("renders basic elements correctly", () => {
    render(<Header />);
    expect(screen.getByAltText("logo")).toBeInTheDocument();
    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Hey! Chat about uploaded documents?")).toBeInTheDocument();
  });

  it("updates the filename when a file is selected", () => {
    render(<Header />);
    const input = document.getElementById("file-input") as HTMLInputElement;
    const file = new File(["test content"], "document.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("document.pdf")).toBeInTheDocument();
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("File selected: document.pdf"));
  });

  it("disables upload button when no file is selected", () => {
    render(<Header />);
    const uploadBtn = screen.getByRole("button", { name: /Upload File/i });
    expect(uploadBtn).toBeDisabled();
  });

  it("opens and closes the chat box via the chat button", () => {
    render(<Header />);
    
    const chatBtn = screen.getByText(/Hey! Chat about uploaded documents?/i);
    fireEvent.click(chatBtn);
    expect(screen.getByTestId("chat-box")).toBeInTheDocument();

    const closeBtn = screen.getByTestId("close-chat-btn");
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId("chat-box")).not.toBeInTheDocument();
  });
});