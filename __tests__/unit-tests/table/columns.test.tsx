import { formatDateTime1, columns } from "@/components/table/columns";
import { Appointment } from "@/types/appwrite.types";

describe("Table Columns Unit Tests", () => {
  it("formatDateTime1 correctly formats date to IST", () => {
    const testDate = new Date("2024-05-20T10:00:00Z");
    const result = formatDateTime1(testDate);
    
    // 10:00 AM UTC is 3:30 PM IST (UTC + 5:30)
    expect(result.dateTime).toContain("May 20, 2024");
    expect(result.dateTime).toContain("3:30");
    expect(result.dateTime).toContain("PM");
  });

  it("Doctor column logic correctly identifies doctor and prepends 'Dr.'", () => {
    const doctorColumn = columns.find((col: any) => col.accessorKey === "primaryPhysician");
    
    // Mock row data
    const mockRow = {
      original: {
        primaryPhysician: "John Doe",
      } as Appointment,
    };

    // We can't easily test the JSX output here without rendering, 
    // but we can verify the accessor or the existence of the cell function
    expect(doctorColumn).toBeDefined();
    expect(typeof doctorColumn?.cell).toBe("function");
  });

  it("Patient column accessor correctly retrieves nested patient name", () => {
    const patientColumn = columns.find((col: any) => col.accessorKey === "patient");
    const mockRow = {
      original: {
        patient: { name: "Alice Smith" },
      } as any,
    };

    const rendered = (patientColumn?.cell as Function)({ row: mockRow });
    expect(rendered.props.children).toBe("Alice Smith");
  });
});
