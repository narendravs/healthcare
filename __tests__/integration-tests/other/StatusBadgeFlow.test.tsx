import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/StatusBadge";
import "@testing-library/jest-dom";

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

describe("StatusBadge Integration Flow", () => {
  it("renders a collection of status badges with distinct variants simultaneously", () => {
    const statuses: any[] = ["scheduled", "pending", "cancelled"];
    
    render(
      <div data-testid="badge-container">
        {statuses.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </div>
    );

    // Verify all texts are present and capitalized (via CSS class)
    expect(screen.getByText("scheduled")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("cancelled")).toBeInTheDocument();

    // Verify icons exist for each
    const icons = screen.getAllByRole("img", { name: /doctor/i });
    expect(icons).toHaveLength(3);

    // Verify background classes across the group
    const badges = icons.map(icon => icon.parentElement);
    expect(badges[0]).toHaveClass("bg-green-600");
    expect(badges[1]).toHaveClass("bg-blue-600");
    expect(badges[2]).toHaveClass("bg-red-600");
  });
});
