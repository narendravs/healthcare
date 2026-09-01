import { render, screen, fireEvent } from "@testing-library/react";
import DataTable from "@/components/table/DataTable";
import { decryptKey } from "@/lib/utils";
import "@testing-library/jest-dom";

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

jest.mock("@/lib/utils", () => {
  const actualUtils = jest.requireActual("@/lib/utils");
  return {
    ...actualUtils,
    cn: actualUtils.cn || ((...inputs: any[]) => inputs.filter(Boolean).join(" ")),
    formatDateTime: jest.fn(() => ({ dateTime: "Dec 25, 2024 - 10:00 AM" })),
    decryptKey: jest.fn(),
  };
});

describe("DataTable Integration Flow", () => {
  const mockColumns = [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "value", header: "Value" }
  ];
  
  // Generate 15 items to test pagination (default page size is usually 10)
  const mockData = Array.from({ length: 15 }, (_, i) => ({
    id: i + 1,
    value: `Item ${i + 1}`
  }));

  beforeEach(() => {
    localStorage.setItem("accessKey", "valid");
    (decryptKey as jest.Mock).mockReturnValue("123456");
    process.env.NEXT_PUBLIC_ADMIN_PASSKEY = "123456";
  });

  it("renders the first page of data and allows navigation to the next page", () => {
    render(<DataTable columns={mockColumns} data={mockData} />);

    // Verify first page items are present
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 10")).toBeInTheDocument();
    
    // Item 11 should not be on the first page
    expect(screen.queryByText("Item 11")).not.toBeInTheDocument();

    // Click Next Page button (the one with the rotated arrow)
    const buttons = screen.getAllByRole("button");
    const nextBtn = buttons.find(btn => btn.querySelector('img[alt="arrow "]'));
    
    if (!nextBtn) throw new Error("Next button not found");
    
    fireEvent.click(nextBtn);

    // Verify second page items are now present
    expect(screen.getByText("Item 11")).toBeInTheDocument();
    expect(screen.getByText("Item 15")).toBeInTheDocument();
    
    // Item 1 should be gone from view
    expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
  });

  it("disables previous button on the first page", () => {
    render(<DataTable columns={mockColumns} data={mockData} />);
    const prevBtn = screen.getAllByRole("button")[0];
    expect(prevBtn).toBeDisabled();
  });
});
