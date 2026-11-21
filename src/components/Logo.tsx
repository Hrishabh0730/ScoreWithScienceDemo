import Image from "next/image";
import Link from "next/link";

export function Logo({ light = false, size = 40 }: { light?: boolean; size?: number }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5" aria-label="ScoreWithScience home">
      <Image src="/logo.png" alt="" width={size} height={size} priority className="rounded-full shadow-sm transition group-hover:rotate-[8deg]" />
      <span className={`text-[17px] font-extrabold tracking-tight ${light ? "text-white" : "text-navy-900"}`}>
        Score<span className={light ? "text-saffron-400" : "text-saffron-500"}>With</span>Science
      </span>
    </Link>
  );
}
