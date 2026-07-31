"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLoader } from "@/components/BrandLoader";
import { fetchCurrentRole, isAdminRole } from "@/lib/auth";

export default function ParametresPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchCurrentRole().then((role) => {
      if (!active) return;
      router.replace(
        isAdminRole(role) ? "/parametres/menu" : "/parametres/compte"
      );
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [router]);

  if (!ready) return <BrandLoader />;
  return null;
}
