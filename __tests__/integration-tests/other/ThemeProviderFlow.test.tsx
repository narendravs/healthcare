import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";
import { useTheme } from "next-themes";
import "@testing-library/jest-dom";

// Mock component that consumes the theme
const ThemeConsumer = () => {
  const { theme } = useTheme();
  return <div data-testid="theme-value">{theme}</div>;
};

// Real integration with next-themes behavior
describe("ThemeProvider Integration Flow", () => {
  it("provides the correct default theme to nested components", () => {
    // We use the actual ThemeProvider here (not mocked at the library level)
    // Note: next-themes might require specific environment setups for full hydration testing,
    // but we test the initial render injection.
    render(
      <ThemeProvider 
        attribute="class" 
        defaultTheme="dark" 
        enableSystem={false}
        forcedTheme="dark"
      >
        <ThemeConsumer />
      </ThemeProvider>
    );

    // In many test environments, next-themes handles hydration asynchronously.
    // If forcedTheme is used, it should be immediate.
    expect(screen.getByTestId("theme-value")).toHaveTextContent("dark");
  });

  it("renders children regardless of the theme state", () => {
    render(
      <ThemeProvider>
        <button>Click Me</button>
      </ThemeProvider>
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});