import type { Metadata, Viewport } from "next"
import { Source_Sans_3, IBM_Plex_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { EyeHeader } from "@/components/shared/eye-header"
import "./globals.css"

// WHY: Silka is the Eye Security brand family but isn't on Google Fonts.
// Use Source Sans 3 as the fallback (the design brief explicitly allows this).
// When Silka woff2 becomes available, swap to next/font/local under the same
// --font-silka variable and nothing else needs to change.
const silka = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-silka",
  display: "swap",
})
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: {
    default: "Cyber Tabletop — AI Incident Response Exercise",
    template: "%s | Cyber Tabletop",
  },
  description:
    "Run live, AI-generated cyber incident tabletop exercises. Facilitate, inject, and observe team response in real time.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Cyber Tabletop — AI Incident Response Exercise",
    description: "Live, AI-generated cyber incident tabletop exercises for crisis teams.",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#192440",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${silka.variable} ${ibmPlexMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <EyeHeader />
          {children}
          {process.env.NODE_ENV === "production" && <Analytics />}
        </ThemeProvider>
      </body>
    </html>
  )
}
