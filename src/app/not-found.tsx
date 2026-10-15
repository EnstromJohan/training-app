import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-[20px] font-semibold">Sidan finns inte</h1>
      <Link href="/" className="bg-accent-grad h-11 rounded-full px-6 text-[14px] font-semibold leading-[44px] text-on-accent">
        Till startsidan
      </Link>
    </div>
  );
}
