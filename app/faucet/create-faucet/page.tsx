import { Suspense } from "react"
import CreateFaucetWizard from "@/components/CreateFaucetWizard"
import LoadingPage from "@/components/loading"

export default function CreatePage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      {/* We don't pass onSuccess or closeModal here.
        The component handles its own redirect logic when these props are missing.
      */}
      <CreateFaucetWizard />
    </Suspense>
  )
}