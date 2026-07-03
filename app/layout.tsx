import type { Metadata } from "next"
import { Inter, Geist } from "next/font/google"
import AuthProvider from "@/components/common/AuthProvider"
import "./globals.css"
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "SIGS Muara Enim — Sistem Informasi Geografis Signal",
  description: "Sistem pemetaan sinyal seluler Kabupaten Muara Enim untuk mendukung pengambilan keputusan infrastruktur telekomunikasi.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" suppressHydrationWarning className={cn(inter.className, "font-sans", geist.variable)}>
      <body suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </body>
    </html>
  )
}
