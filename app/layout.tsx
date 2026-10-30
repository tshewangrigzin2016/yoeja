import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#18130F',
  colorScheme: 'dark light',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'http://localhost:3000'),
  title: 'Yoeja',
  description:
    'Yoeja lets anyone, anywhere, dedicate a name to Bhutan’s Unbroken Prayer. Read the stories, pray at your own pace, and make an offering if you wish.',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'Yoeja',
    locale: 'en_GB',
    title: 'Yoeja',
    description:
      'Yoeja lets anyone, anywhere, dedicate a name to Bhutan’s Unbroken Prayer. Read the stories, pray at your own pace, and make an offering if you wish.',
    images: [
      {
        url: '/media/og-image.jpg',
        width: 1200,
        height: 630,
        type: 'image/jpeg',
        alt: 'The Yoeja logo, a butter lamp glowing in its O, over a monk in red robes reading a loose page of text in warm light.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yoeja',
    description:
      'Yoeja lets anyone, anywhere, dedicate a name to Bhutan’s Unbroken Prayer. Read the stories, pray at your own pace, and make an offering if you wish.',
    images: ['/media/og-image.jpg'],
  },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Yoeja',
  url: 'https://yoeja.com/',
  logo: 'https://yoeja.com/icon.png',
  sameAs: [
    'https://www.instagram.com/yoejabhutan/',
    'https://www.tiktok.com/@yoeja_',
    'https://www.facebook.com/share/1FS9bvYzjB/',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" crossOrigin="anonymous" href="/assets/index-CCGAZZaX.css" />
        <link rel="modulepreload" crossOrigin="anonymous" href="/assets/compiler-runtime-C61-Iblk.js" />
        <link rel="modulepreload" crossOrigin="anonymous" href="/assets/components-1VjQr_Dh.js" />
        <link rel="modulepreload" crossOrigin="anonymous" href="/assets/shim-Iu46DkIW.js" />
        <link rel="modulepreload" crossOrigin="anonymous" href="/assets/monitoring-Dh-4pE3B.js" />
        <link rel="modulepreload" crossOrigin="anonymous" href="/assets/jsx-runtime-_3M-sZBb.js" />
        <link rel="modulepreload" crossOrigin="anonymous" href="/assets/store-D-qcMWPR.js" />
        <link rel="modulepreload" crossOrigin="anonymous" href="/assets/shared-C2eITlIE.js" />
        <link rel="modulepreload" crossOrigin="anonymous" href="/assets/useInfiniteQuery-TZMWFr5I.js" />
        <link rel="modulepreload" crossOrigin="anonymous" href="/assets/offering.service-BM77jzWJ.js" />
        <link rel="modulepreload" crossOrigin="anonymous" href="/assets/bead-profile-Nka0PUKO.js" />
        <link rel="modulepreload" crossOrigin="anonymous" href="/assets/story-path-BWFRLiwR.js" />
        <link rel="modulepreload" crossOrigin="anonymous" href="/assets/return-path-D4n5FPEd.js" />
        <link rel="modulepreload" crossOrigin="anonymous" href="/assets/auth-card-Cqh6k8jO.js" />
        <link rel="modulepreload" crossOrigin="anonymous" href="/assets/unbroken-prayer-art-DnZEJGgE.js" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className="min-h-dvh" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
