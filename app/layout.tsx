import type { Metadata } from "next";
import "../src/styles.css";

export const metadata: Metadata = {
  title: "Research Compass",
  description: "Your private research projects, next steps, and activity.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head><link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials"/><meta name="theme-color" content="#182c3e"/></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
