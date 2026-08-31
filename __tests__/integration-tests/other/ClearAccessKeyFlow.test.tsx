import { render } from "@testing-library/react";
import ClearAccessKey from "@/components/ClearAccessKey";

describe("ClearAccessKey Integration Flow", () => {
  it("effectively removes the accessKey from localStorage upon rendering", () => {
    // 1. Setup: Pre-populate localStorage with a mock key
    const mockKey = "encrypted_123456";
    localStorage.setItem("accessKey", mockKey);
    expect(localStorage.getItem("accessKey")).toBe(mockKey);

    // 2. Action: Render the component
    render(<ClearAccessKey />);

    // 3. Assertion: Verify the side effect in the actual localStorage object
    expect(localStorage.getItem("accessKey")).toBeNull();
  });
});
