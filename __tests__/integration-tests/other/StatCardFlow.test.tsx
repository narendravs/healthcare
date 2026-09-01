import { render, screen } from "@testing-library/react";
import StatCard from "@/components/StatCard";
import "@testing-library/jest-dom";

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

describe("StatCard Integration Flow", () => {
  it("renders a collection of stat cards with distinct data and styles", () => {
    const stats = [
      { type: "appointments", count: 120, label: "Scheduled", icon: "/icon1.svg" },
      { type: "pending", count: 32, label: "Pending", icon: "/icon2.svg" },
      { type: "cancelled", count: 15, label: "Cancelled", icon: "/icon3.svg" },
    ];

    render(
      <section className="flex gap-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.type}
            type={stat.type as any}
            count={stat.count}
            label={stat.label}
            icon={stat.icon}
          />
        ))}
      </section>
    );

    // Verify all counts are rendered
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("32")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();

    // Verify all labels are rendered
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();

    // Verify specific background classes are applied to each
    const cards = screen.getAllByRole("heading", { level: 2 }).map(h2 => h2.closest('.stat-card'));
    
    expect(cards[0]).toHaveClass("bg-appointments");
    expect(cards[1]).toHaveClass("bg-pending");
    expect(cards[2]).toHaveClass("bg-cancelled");
  });
});
