import './App.css'

// import { Inter } from "next/font/google"
// import { ThemeProvider } from "@/components/theme-provider"
import Page from './components/page'

// const inter = Inter({ subsets: ["latin"] })
export const metadata = {
  title: "Yoga Practice App",
  description: "A mobile-first yoga practice app with customizable settings",
}

export default function App() {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* <body className={inter.className}> */}
      <body >
        {/* <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange> */}
          <Page />
        {/* </ThemeProvider> */}
      </body>
    </html>
  )
}