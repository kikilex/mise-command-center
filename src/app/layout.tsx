import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "react-hot-toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ChatWidget from "@/components/ChatWidget";
import FloatingNoteWidget from "@/components/FloatingNoteWidget";
import SpaceSwitcher from "@/components/SpaceSwitcher";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mise Command Center",
  description: "Life OS for the Mise family",
};

// Prevent iOS auto-zoom on input focus
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background antialiased`}>
        <Providers>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <Toaster 
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e293b',
                color: '#f1f5f9',
              },
              success: {
                iconTheme: {
                  primary: '#22c55e',
                  secondary: '#f1f5f9',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#f1f5f9',
                },
              },
            }}
          />
          <ChatWidget />
          <FloatingNoteWidget />
          <SpaceSwitcher />
        </Providers>
      </body>
    </html>
  );
}
// force rebuild Wed Jan 28 18:26:00 EST 2026
// redeploy Wed Jan 28 21:14:50 EST 2026
