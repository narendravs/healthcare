import { render, screen } from "@testing-library/react";
import FileUploader from "@/components/FileUploader";
import { convertFileToUrl } from "@/lib/utils";
import "@testing-library/jest-dom";

// Mock dependencies
jest.mock("@/lib/utils", () => ({
  convertFileToUrl: jest.fn(),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

describe("FileUploader Unit Test", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders upload instructions when no files are provided", () => {
    render(<FileUploader files={undefined} onChange={mockOnChange} />);

    expect(screen.getByText(/Click to upload/i)).toBeInTheDocument();
    expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
    expect(screen.getByAltText("upload")).toBeInTheDocument();
  });

  it("renders the first file preview when files array is populated", () => {
    const mockFile = new File(["test"], "test.png", { type: "image/png" });
    (convertFileToUrl as jest.Mock).mockReturnValue("http://localhost/test.png");

    render(<FileUploader files={[mockFile]} onChange={mockOnChange} />);

    const previewImage = screen.getByAltText("upload image");
    expect(previewImage).toBeInTheDocument();
    expect(previewImage).toHaveAttribute("src", "http://localhost/test.png");
    expect(convertFileToUrl).toHaveBeenCalledWith(mockFile);
  });
});
