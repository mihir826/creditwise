import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <p className="text-[11px] tracking-[0.18em] text-subtle uppercase">404</p>
      <h1 className="mt-3 font-serif text-5xl text-fg">Page not found.</h1>
      <p className="mt-4 text-sm text-muted">The page you&apos;re looking for doesn&apos;t exist.</p>
      <ButtonLink href="/" variant="lavender" className="mt-8">
        Back to overview <ArrowRight />
      </ButtonLink>
    </div>
  );
}
