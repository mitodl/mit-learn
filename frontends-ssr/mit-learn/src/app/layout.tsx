
import React from "react"
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppRouterCacheProvider } from '@mui/material-nextjs/v13-appRouter';
// import ResourceCarousel from "@/page-components/ResourceCarousel/ResourceCarousel"

import Header from "@/page-components/Header/Header"
import Footer from "@/page-components/Footer/Footer"
import {PageWrapper, PageWrapperInner} from "./styled"
import { ThemeProvider } from 'ol-components';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
      <AppRouterCacheProvider>
      <ThemeProvider>
      <PageWrapper>
        <Header />
        <PageWrapperInner>
          {/* <Outlet /> */}
        </PageWrapperInner>
        <Footer />
          </PageWrapper>
          </ThemeProvider>
        </AppRouterCacheProvider>
        {/* <LearningResourceDrawer /> */}
    </html>
  );
}
