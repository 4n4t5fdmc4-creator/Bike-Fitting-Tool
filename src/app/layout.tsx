import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'Bike Fitting Tool',
  description: 'Compare bike frames, geometries and adjust to individual personal needs.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Committed to dark for now: the brief is a dark modern design, and one token
  // set beats two competing dark mechanisms fighting over the same variables.
  // A light theme returns in Phase 6 behind a proper theme provider.
  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
