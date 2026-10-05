import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Candidatura su misura | Antonio Filippone",description:"Analizza un annuncio e prepara una candidatura mirata.",icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="it"><body>{children}</body></html>}
