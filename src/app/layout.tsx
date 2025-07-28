import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/globe.svg" />
        <link href="https://cdn.tailwindcss.com" rel="stylesheet"></link>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Hospital Management System</title>
        <meta
          name="description"
          content="Manage hospital operations efficiently"
        />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
