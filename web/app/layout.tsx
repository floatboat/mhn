import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Modern Honey Network",
  description: "Attack monitoring and honeypot management system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            <Navigation />
            <main className="flex-1">
              {children}
            </main>
            <footer className="bg-gray-900 text-white py-6 px-4">
              <div className="container">
                <p className="text-sm text-gray-400">
                  © 2025 Modern Honey Network. All rights reserved.
                </p>
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
