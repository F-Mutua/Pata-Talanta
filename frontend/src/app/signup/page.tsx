import { Suspense } from "react";
import SignupForm from "./SignupForm";

export default function SignupPage() {
  // useSearchParams (for ?role=) needs a Suspense boundary.
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#17191D]" />}>
      <SignupForm />
    </Suspense>
  );
}
