import { render, screen } from "@testing-library/react";
import DataTable from "@/components/table/DataTable";
import { decryptKey } from "@/lib/utils";
import { redirect } from "next/navigation";
import "@testing-library/jest-dom";

// Mock dependencies
jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

jest.mock("@/lib/utils", () => ({
  ...jest.requireActual("@/lib/utils"),
  decryptKey: jest.fn(),
  encryptKey: jest.fn(),
}));

const mockColumns = [{ accessorKey: "name", header: "Patient Name" }];
const mockData = [{ name: "John Doe" }];

describe("DataTable Unit Test", () => {
  const ADMIN_PASSKEY = "123456";

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    process.env.NEXT_PUBLIC_ADMIN_PASSKEY = ADMIN_PASSKEY;
  });

  it("redirects to home if accessKey in localStorage is invalid", () => {
    localStorage.setItem("accessKey", "invalid_key");
    (decryptKey as jest.Mock).mockReturnValue("wrong_pass");

    render(<DataTable columns={mockColumns} data={mockData} />);

    expect(decryptKey).toHaveBeenCalledWith("invalid_key");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("redirects to home if accessKey is missing", () => {
    render(<DataTable columns={mockColumns} data={mockData} />);
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("renders table headers and data when authorized", () => {
    localStorage.setItem("accessKey", "valid_encrypted_key");
    (decryptKey as jest.Mock).mockReturnValue(ADMIN_PASSKEY);

    render(<DataTable columns={mockColumns} data={mockData} />);

    expect(screen.getByText("Patient Name")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("displays 'No results' message when data is empty", () => {
    localStorage.setItem("accessKey", "valid_encrypted_key");
    (decryptKey as jest.Mock).mockReturnValue(ADMIN_PASSKEY);
    render(<DataTable columns={mockColumns} data={[]} />);
    expect(screen.getByText(/No results/i)).toBeInTheDocument();
  });
});
