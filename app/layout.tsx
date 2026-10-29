import type { Metadata } from "next";import "./globals.css";
export const metadata: Metadata={title:"Interview Copilot",description:"Resume-aware AI interview preparation"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
