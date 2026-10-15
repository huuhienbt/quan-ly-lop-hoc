import Link from "next/link";
import "./theme-settings-link.css";

export function ThemeSettingsLink() {
  return (
    <Link className="theme-settings-shortcut" href="/admin#giao-dien">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.7-3.05 1.5 1.5 0 0 1 1.28-2.28H18A3 3 0 0 0 21 12a9 9 0 0 0-9-9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx="7.5" cy="10" r="1.3" fill="currentColor" /><circle cx="11" cy="6.8" r="1.3" fill="currentColor" /><circle cx="15.5" cy="8" r="1.3" fill="currentColor" /><circle cx="7.5" cy="14.5" r="1.3" fill="currentColor" />
      </svg>
      <span>Đổi giao diện</span>
    </Link>
  );
}
