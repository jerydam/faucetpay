"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function PrivacyPage() {
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
              Privacy Policy
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
                  FaucetDrops ("we," "us," or "our") operates FaucetDrops.io and is committed to protecting your privacy. This Privacy Policy explains how we collect, use, share, and protect your personal information when you use our website or services ("Service").
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">2. Information We Collect</h2>
                <p className="text-slate-700 dark:text-slate-300 mb-3">We may collect the following types of information:</p>
                
                <ul className="space-y-4">
                  <li>
                    <strong className="text-slate-900 dark:text-slate-100">Personal Information:</strong>
                    <span className="text-slate-700 dark:text-slate-300"> When you interact with our Service, we may collect your name, email address, or other contact details if you voluntarily provide them (e.g., through contact forms or account registration).</span>
                  </li>
                  <li>
                    <strong className="text-slate-900 dark:text-slate-100">Wallet Information:</strong>
                    <span className="text-slate-700 dark:text-slate-300"> When you connect a digital wallet, we collect your public wallet address and transaction data to facilitate token drops or faucet claims.</span>
                  </li>
                  <li>
                    <strong className="text-slate-900 dark:text-slate-100">Usage Data:</strong>
                    <span className="text-slate-700 dark:text-slate-300"> We automatically collect information such as your IP address, browser type, device information, and browsing behavior to improve our Service.</span>
                  </li>
                  <li>
                    <strong className="text-slate-900 dark:text-slate-100">Analytics Data:</strong>
                    <span className="text-slate-700 dark:text-slate-300"> We aggregate data on faucet creation, transactions, and user activity across supported networks for analytics purposes.</span>
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">3. How We Use Your Information</h2>
                <p className="text-slate-700 dark:text-slate-300 mb-3">We use your information to:</p>
                <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-1">
                  <li>Facilitate token drops, faucet creation, and claims.</li>
                  <li>Improve and optimize the Service, including analytics and troubleshooting.</li>
                  <li>Communicate with you about updates, promotions, or support inquiries.</li>
                  <li>Comply with legal obligations.</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">4. How We Share Your Information</h2>
                <p className="text-slate-700 dark:text-slate-300 mb-3">We do not sell your personal information. We may share information:</p>
                <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-1">
                  <li>With third-party service providers (e.g., blockchain networks or analytics providers) to operate the Service.</li>
                  <li>To comply with legal requirements or protect our rights.</li>
                  <li>In aggregated or anonymized form for analytics or research purposes.</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">5. Data Security</h2>
                <p className="text-slate-700 dark:text-slate-300">
                  We implement reasonable security measures, such as encryption and secure protocols, to protect your information. However, no system is completely secure, and we cannot guarantee absolute security, especially for blockchain transactions.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">6. Your Rights</h2>
                <p className="text-slate-700 dark:text-slate-300 mb-3">Depending on your jurisdiction, you may have the right to:</p>
                <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 mb-4 space-y-1">
                  <li>Access, correct, or delete your personal information.</li>
                  <li>Opt out of marketing communications.</li>
                  <li>Request information about how your data is used.</li>
                </ul>
                <p className="text-slate-700 dark:text-slate-300">
                  To exercise these rights, contact us at{" "}
                  <a 
                    href="mailto:drops.faucet@gmail.com" 
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    drops.faucet@gmail.com
                  </a>
                  .
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">7. International Data Transfers</h2>
                <p className="text-slate-700 dark:text-slate-300">
                  As FaucetDrops operates globally, your data may be transferred to and processed in countries outside your jurisdiction, which may have different data protection laws. We take steps to ensure compliance with applicable laws.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">8. Cookies and Tracking</h2>
                <p className="text-slate-700 dark:text-slate-300">
                  We use cookies and similar technologies to enhance your experience and collect usage data. You can manage cookie preferences through your browser settings.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">9. Updates to This Privacy Policy</h2>
                <p className="text-slate-700 dark:text-slate-300">
                  We may update this Privacy Policy from time to time. Changes will be posted on our website, and significant updates will be communicated via email or through the Service.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">10. Contact Us</h2>
                <p className="text-slate-700 dark:text-slate-300">
                  For questions or concerns about this Privacy Policy, please contact us at{" "}
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