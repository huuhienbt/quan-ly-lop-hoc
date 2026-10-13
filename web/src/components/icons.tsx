import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function SunIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <path d="M16 2v3M16 27v3M2 16h3M27 16h3M6.1 6.1l2.1 2.1M23.8 23.8l2.1 2.1M6.1 25.9l2.1-2.1M23.8 8.2l2.1-2.1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="16" cy="16" r="8" fill="currentColor" />
      <path d="M12.5 17.3c1.8 2.4 5.2 2.4 7 0" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12.5" cy="13.4" r="1" fill="white" /><circle cx="19.5" cy="13.4" r="1" fill="white" />
    </svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function ShieldIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}><path d="m12 3 8 3v5c0 5-5 8.8-8 10-3-1.2-8-5-8-10V6l8-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="m8.5 11.5 2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function HeartIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}><path d="M12 20S3 14.8 3 8.7C3 3.5 9 2.6 12 7c3-4.4 9-3.5 9 1.7C21 14.8 12 20 12 20Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>;
}

export function SchoolIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}><path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6M2 10l10-8 10 8M8 10h.01M16 10h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function PeopleIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}><circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.7" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M17 13a5 5 0 0 1 4 5v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

export function ClockIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" /><path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

export function StarIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}><path d="m12 3 2.7 5.6 6.2.9-4.5 4.4 1.1 6.1-5.5-2.9L6.5 20l1.1-6.1-4.5-4.4 6.2-.9L12 3Z" fill="currentColor" /></svg>;
}
