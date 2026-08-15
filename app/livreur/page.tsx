"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// L'espace livreur est servi par /logistique ; cette route ne fait que rediriger.
export default function DriverRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/logistique");
  }, [router]);

  return null;
}
