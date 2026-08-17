import type { Metadata } from 'next'
import { Inter, DM_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { CartProvider } from '@/components/cart-context'
import { OfflineSyncStatus } from '@/components/offline-sync-status'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { InstallPrompt } from '@/components/InstallPrompt'
import { LanguageProvider } from '@/lib/LanguageContext'
import './globals.css'


const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-heading' })

export const metadata: Metadata = {
  title: {
    default: 'AgriConnect Burundi',
    template: '%s | AgriConnect Burundi',
  },
  description: 'Marketplace agricole burundaise pour acheter, vendre et livrer des produits frais avec paiement mobile et traçabilité.',
  applicationName: 'AgriConnect Burundi',
  category: 'marketplace',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AgriConnect',
  },
  other: {
    // Next.js n'émet que "mobile-web-app-capable" pour appleWebApp.capable ;
    // Safari iOS exige spécifiquement la variante préfixée pour le mode
    // standalone complet (barre d'adresse masquée).
    'apple-mobile-web-app-capable': 'yes',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: "#2e7d32",
}



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} ${dmSans.variable} font-sans antialiased`}>
        <LanguageProvider>
          <CartProvider>
            {children}
            <OfflineSyncStatus />
            <ConnectionStatus />
            <InstallPrompt />
            <Analytics />
          </CartProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
