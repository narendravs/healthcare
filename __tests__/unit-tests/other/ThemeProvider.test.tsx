import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/components/ThemeProvider";
import "@testing-library/jest-dom";

// Mock next-themes to isolate our provider wrapper
jest.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="next-themes-provider">{children}</div>
  ),
}));

describe("ThemeProvider Unit Test", () => {
  it("renders children successfully within the provider", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="dark">
        <div data-testid="child-element">Hello Theme</div>
      </ThemeProvider>
    );

    expect(screen.getByTestId("child-element")).toBeInTheDocument();
  });
});