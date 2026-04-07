"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function TermsPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: '#020817' }}>
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Home
                </Link>
              </Button>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
              Terms and Conditions
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Last updated: August 15, 2025
            </p>
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
            <div className="prose prose-slate dark:prose-invert max-w-none">
              
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">1. Introduction</h2>
                <p className="text-slate-700 dark:text-slate-300 mb-4">
                  Welcome to FaucetDrops, a platform for creating and managing token drops and faucets for contests, private airdrops, community rewards, and restricted campaigns ("Service"). By accessing or using our website at FaucetDrops.io or any associated services, you agree to be bound by these Terms and Conditions ("Terms"). These Terms form a legally binding agreement between you ("User" or "you") and FaucetDrops ("we," "us," or "our"). If you do not agree, please do not use our Service.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">2. Use of the Service</h2>
                
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-3">2.1 Eligibility</h3>
                <p className="text-slate-700 dark:text-slate-300 mb-4">
                  You must be at least 15 years old and have the legal capacity to enter into contracts to use our Service. By using FaucetDrops, you represent that you meet these requirements.
                </p>

                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-3">2.2 Permitted Use</h3>
                <p className="text-slate-700 dark:text-slate-300 mb-3">
                  You may use the Service to create, fund, and manage token drops or claim tokens from faucets as permitted by our platform. You agree to:
                </p>
                <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 mb-4 space-y-1">
                  <li>Connect a supported digital wallet to a compatible blockchain network.</li>
                  <li>Comply with all applicable laws and regulations.</li>
                  <li>Not use the Service for any unlawful, fraudulent, or abusive purposes, including but not limited to money laundering, unauthorized token distribution, or hacking.</li>
                </ul>

                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-3">2.3 Prohibited Uses</h3>
                <p className="text-slate-700 dark:text-slate-300 mb-3">You are prohibited from:</p>
                <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 mb-4 space-y-1">
                  <li>Using the Service to distribute tokens in violation of any laws or regulations.</li>
                  <li>Attempting to bypass security measures or interfere with the functionality of the Service.</li>
                  <li>Engaging in any activity that could harm FaucetDrops, its users, or its reputation.</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">3. Account and Wallet</h2>
                <p className="text-slate-700 dark:text-slate-300 mb-3">
                  To use certain features, you must connect a supported digital wallet. You are responsible for:
                </p>
                <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 mb-4 space-y-1">
                  <li>Maintaining the security of your wallet and private keys.</li>
                  <li>Ensuring your wallet is connected to a supported network.</li>
                  <li>Any transactions or claims made through your wallet.</li>
                </ul>
                <p className="text-slate-700 dark:text-slate-300">
                  FaucetDrops is not responsible for any loss of funds or tokens due to wallet mismanagement or security breaches on your end.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">4. Intellectual Property</h2>
                <p className="text-slate-700 dark:text-slate-300">
                  All content, logos, trademarks, and software on the FaucetDrops platform are the property of FaucetDrops or its licensors. You may not copy, modify, distribute, or use any of our intellectual property without prior written consent.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">5. Limitation of Liability</h2>
                <p className="text-slate-700 dark:text-slate-300 mb-3">To the fullest extent permitted by law:</p>
                <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-1">
                  <li>FaucetDrops provides the Service "as is" and does not guarantee uninterrupted or error-free operation.</li>
                  <li>We are not liable for any losses resulting from blockchain network issues, wallet errors, or third-party actions.</li>
                  <li>Our liability is limited to the amount you paid for the Service, if any.</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">6. Termination</h2>
                <p className="text-slate-700 dark:text-slate-300">
                  We reserve the right to suspend or terminate your access to the Service at our sole discretion, without notice, if you violate these Terms or engage in prohibited activities. You may also stop using the Service at any time.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">7. Governing Law</h2>
                <p className="text-slate-700 dark:text-slate-300">
                  These Terms are governed by the laws of Nigeria. Any disputes arising from these Terms will be resolved in the courts of Lagos, Nigeria.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">8. Changes to These Terms</h2>
                <p className="text-slate-700 dark:text-slate-300">
                  We may update these Terms from time to time. Changes will be posted on our website, and continued use of the Service after changes constitutes acceptance of the updated Terms.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">9. Contact Us</h2>
                <p className="text-slate-700 dark:text-slate-300">
                  For questions or concerns about these Terms, please contact us at{" "}
                  <a 
                    href="mailto:drops.faucet@gmail.com" 
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    drops.faucet@gmail.com
                  </a>
                  .
                </p>
              </section>

            </div>
          </div>
        </div>
      </div>
    </main>
  )
}