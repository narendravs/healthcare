import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Header from "@/components/Header";
import "@testing-library/jest-dom";

// Mock global fetch
global.fetch = jest.fn();

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

describe("Header Integration Flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.alert = jest.fn();
  });

  it("successfully uploads a file and resets the input UI", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "File processed successfully" }),
    });

    render(<Header />);
    
    // 1. Select a file
    const input = document.getElementById("file-input") as HTMLInputElement;
    const file = new File(["dummy data"], "test.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });

    // 2. Click the upload button
    const uploadBtn = screen.getByRole("button", { name: /Upload File/i });
    fireEvent.click(uploadBtn);

    // 3. Verify the API request
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/embeddings/services", expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      }));
    });

    // 4. Verify post-upload cleanup
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("File processed successfully");
      expect(screen.getByText("No file chosen")).toBeInTheDocument();
      expect(input.value).toBe("");
    });
  });

  it("handles upload failure and alerts the user", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
    });

    render(<Header />);
    
    const input = document.getElementById("file-input") as HTMLInputElement;
    const file = new File(["dummy data"], "test.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });

    const uploadBtn = screen.getByRole("button", { name: /Upload File/i });
    fireEvent.click(uploadBtn);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Upload failed. Please try again.");
    });
  });
});