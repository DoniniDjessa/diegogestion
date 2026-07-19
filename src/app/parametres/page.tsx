"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandLoader } from "@/components/BrandLoader";

export default function ParametresPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/parametres/compte");
  }, [router]);

  return <BrandLoader />;
}
