import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FileUploader from "@/components/FileUploader";
import "@testing-library/jest-dom";

// Mock next/image to avoid issues with optimized images in test env
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

// Mock utility to avoid actual URL creation
jest.mock("@/lib/utils", () => ({
  convertFileToUrl: jest.fn(() => "mock-url"),
}));

describe("FileUploader Integration Flow", () => {
  const mockOnChange = jest.fn();

  it("triggers onChange when a file is dropped into the zone", async () => {
    render(<FileUploader files={[]} onChange={mockOnChange} />);

    // Get the dropzone container
    const dropzone = screen.getByText(/Click to upload/i).closest('div');
    if (!dropzone) throw new Error("Could not find dropzone element");

    const file = new File(["dummy content"], "test.png", { type: "image/png" });

    // Simulate the drop event
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
        types: ["Files"],
      },
    });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith([file]);
    });
  });

  it("switches from upload prompt to preview when the parent provides a file", () => {
    const file = new File(["dummy content"], "test.png", { type: "image/png" });
    const { rerender } = render(<FileUploader files={[]} onChange={mockOnChange} />);

    expect(screen.getByText(/Click to upload/i)).toBeInTheDocument();

    // Simulate parent state change via rerender
    rerender(<FileUploader files={[file]} onChange={mockOnChange} />);

    expect(screen.queryByText(/Click to upload/i)).not.toBeInTheDocument();
    expect(screen.getByAltText("upload image")).toBeInTheDocument();
  });
});
