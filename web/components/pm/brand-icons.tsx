import { Globe2 } from "lucide-react";

/** Connectors an agent on the board can call. Marks are simplified renderings for this concept. */
export type ToolKey =
  | "gmail"
  | "outlook"
  | "teams"
  | "sharepoint"
  | "slack"
  | "hubspot"
  | "salesforce"
  | "zendesk"
  | "sheets"
  | "reddit"
  | "youtube"
  | "x"
  | "news"
  | "web"
  | "jira"
  | "confluence"
  | "github"
  | "bmw";

export const TOOL_NAMES: Record<ToolKey, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
  teams: "Microsoft Teams",
  sharepoint: "SharePoint",
  slack: "Slack",
  hubspot: "HubSpot",
  salesforce: "Salesforce",
  zendesk: "Zendesk",
  sheets: "Google Sheets",
  reddit: "Reddit",
  youtube: "YouTube",
  x: "X",
  news: "Google News",
  web: "Web search",
  jira: "Jira",
  confluence: "Confluence",
  github: "GitHub",
  bmw: "BMW evidence workspace",
};

const marks: Record<Exclude<ToolKey, "web" | "bmw">, React.ReactNode> = {
  gmail: (
    <>
      <path fill="#4285F4" d="M1.636 21.002h3.819V11.73L0 7.64v11.727c0 .904.732 1.636 1.636 1.636z" />
      <path fill="#34A853" d="M18.545 21.002h3.819A1.636 1.636 0 0 0 24 19.366V7.64l-5.455 4.09z" />
      <path fill="#FBBC04" d="M18.545 4.64v7.09L24 7.64V5.457c0-2.023-2.309-3.178-3.927-1.964z" />
      <path fill="#EA4335" d="M5.455 11.73V4.64L12 9.548l6.545-4.91v7.092L12 16.638z" />
      <path fill="#C5221F" d="M0 5.457V7.64l5.455 4.09V4.64L3.927 3.493C2.309 2.28 0 3.434 0 5.457z" />
    </>
  ),
  outlook: (
    <>
      <rect x="9" y="5" width="14" height="14" rx="1.5" fill="#28A8EA" />
      <path d="M9 8.6l7 4.6 7-4.6" stroke="#0A5DA8" strokeWidth="1.3" fill="none" />
      <rect x="1" y="4" width="13" height="16" rx="1.6" fill="#0F6CBD" />
      <ellipse cx="7.5" cy="12" rx="3.1" ry="3.7" fill="none" stroke="#fff" strokeWidth="1.9" />
    </>
  ),
  teams: (
    <>
      <circle cx="18.6" cy="6.4" r="2.6" fill="#7B83EB" />
      <rect x="14.5" y="10" width="8.5" height="9.5" rx="2.6" fill="#7B83EB" />
      <circle cx="11.8" cy="4.8" r="3" fill="#5059C9" />
      <rect x="1" y="7" width="13" height="13" rx="1.8" fill="#4B53BC" />
      <path d="M4.4 10.6h6.2M7.5 10.6v6.4" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
    </>
  ),
  sharepoint: (
    <>
      <circle cx="14.5" cy="8" r="6.5" fill="#036C70" />
      <circle cx="17.5" cy="14.5" r="5" fill="#1A9BA1" />
      <circle cx="14" cy="19.2" r="3.8" fill="#37C6D0" />
      <rect x="1" y="6" width="12" height="12" rx="1.6" fill="#03787C" />
      <path
        d="M9.3 9.7c-.5-.6-1.2-.9-2.1-.9-1.2 0-2 .7-2 1.6 0 2 4.4 1.3 4.4 3.5 0 1-.9 1.7-2.3 1.7-1 0-1.8-.4-2.3-1"
        stroke="#fff"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  slack: (
    <>
      <rect x="2" y="8.3" width="9.5" height="3.4" rx="1.7" fill="#36C5F0" />
      <rect x="8.1" y="2" width="3.4" height="5" rx="1.7" fill="#36C5F0" />
      <rect x="12.5" y="2" width="3.4" height="9.5" rx="1.7" fill="#2EB67D" />
      <rect x="17" y="8.1" width="5" height="3.4" rx="1.7" fill="#2EB67D" />
      <rect x="12.5" y="12.5" width="9.5" height="3.4" rx="1.7" fill="#ECB22E" />
      <rect x="12.5" y="17" width="3.4" height="5" rx="1.7" fill="#ECB22E" />
      <rect x="8.1" y="12.5" width="3.4" height="9.5" rx="1.7" fill="#E01E5A" />
      <rect x="2" y="12.5" width="5" height="3.4" rx="1.7" fill="#E01E5A" />
    </>
  ),
  hubspot: (
    <g stroke="#FF7A59" strokeLinecap="round" fill="none">
      <circle cx="15" cy="14.6" r="4.1" strokeWidth="2.5" />
      <path d="M15 10.4V6" strokeWidth="2.2" />
      <path d="M11.7 12 5.8 7.6" strokeWidth="1.8" />
      <path d="M12.1 17.6 9.6 20.1" strokeWidth="1.8" />
      <circle cx="15" cy="4.6" r="1.7" fill="#FF7A59" stroke="none" />
      <circle cx="4.7" cy="6.8" r="1.8" fill="#FF7A59" stroke="none" />
      <circle cx="8.7" cy="21" r="1.4" fill="#FF7A59" stroke="none" />
    </g>
  ),
  salesforce: (
    <path
      fill="#00A1E0"
      d="M10 5.5a4.2 4.2 0 0 1 3.1 1.4 3.5 3.5 0 0 1 5.9 1.4A4 4 0 0 1 22.5 14a4 4 0 0 1-5.6 3.7 3.4 3.4 0 0 1-5.5 1.3 3.9 3.9 0 0 1-7.1-.7A3.6 3.6 0 0 1 2 11.7a3.7 3.7 0 0 1 4.3-3.6A4.2 4.2 0 0 1 10 5.5z"
    />
  ),
  zendesk: (
    <>
      <rect width="24" height="24" rx="5" fill="#03363D" />
      <path fill="#fff" d="M11 9.4V17H4.6zM11 6.5a3.2 3.2 0 0 1-6.4 0zM13 17a3.2 3.2 0 0 1 6.4 0zM13 14.6V7h6.4z" />
    </>
  ),
  sheets: (
    <>
      <path fill="#0F9D58" d="M14.5 1H5.5A1.5 1.5 0 0 0 4 2.5v19A1.5 1.5 0 0 0 5.5 23h13a1.5 1.5 0 0 0 1.5-1.5V6.5z" />
      <path fill="#87CEAC" d="M14.5 1v4A1.5 1.5 0 0 0 16 6.5h4z" />
      <path fill="#fff" d="M7.5 10.5h9v8h-9zm1.4 1.4v1.9h2.4v-1.9zm3.8 0v1.9h2.4v-1.9zm-3.8 3.3v1.9h2.4v-1.9zm3.8 0v1.9h2.4v-1.9z" />
    </>
  ),
  reddit: (
    <>
      <circle cx="12" cy="12" r="11.5" fill="#FF4500" />
      <ellipse cx="12" cy="14.3" rx="6.2" ry="4.2" fill="#fff" />
      <circle cx="9.6" cy="13.8" r="1.05" fill="#FF4500" />
      <circle cx="14.4" cy="13.8" r="1.05" fill="#FF4500" />
      <path d="M9.8 16.2c1.3.8 3.1.8 4.4 0" stroke="#FF4500" strokeWidth=".9" fill="none" strokeLinecap="round" />
      <path d="M12 10.1l1-4.1 3.3.7" stroke="#fff" strokeWidth="1" fill="none" strokeLinecap="round" />
      <circle cx="16.9" cy="6.9" r="1.3" fill="#fff" />
      <circle cx="6.4" cy="11.4" r="1.5" fill="#fff" />
      <circle cx="17.6" cy="11.4" r="1.5" fill="#fff" />
    </>
  ),
  youtube: (
    <>
      <rect x="1" y="4.5" width="22" height="15" rx="4.2" fill="#FF0000" />
      <path fill="#fff" d="M9.8 8.6v6.8l5.9-3.4z" />
    </>
  ),
  x: (
    <>
      <rect width="24" height="24" rx="5" fill="#0f1419" />
      <path fill="#fff" d="M13.3 10.9 18.4 5h-1.2l-4.4 5.1L9.3 5H5.2l5.3 7.7L5.2 19h1.2l4.6-5.4 3.7 5.4H19zm-1.6 1.9-.5-.8-4.3-6.1h1.8l3.5 5 .5.8 4.5 6.4h-1.8z" />
    </>
  ),
  news: (
    <>
      <rect x="4" y="2.5" width="16" height="12" rx="1.5" fill="#0C9D58" transform="rotate(-8 12 8.5)" />
      <rect x="2" y="6" width="20" height="15" rx="1.8" fill="#4285F4" />
      <rect x="5" y="9.5" width="7" height="1.8" fill="#fff" />
      <rect x="5" y="13" width="7" height="1.8" fill="#fff" />
      <rect x="5" y="16.5" width="5" height="1.8" fill="#fff" />
      <circle cx="16.5" cy="13.5" r="2.8" fill="#FBBC04" />
    </>
  ),
  jira: (
    <path
      fill="#2684FF"
      d="M22.2 11.3 12.7 1.8 12 1 4.6 8.4l-2.8 2.9a1 1 0 0 0 0 1.4l6.5 6.5L12 23l7.4-7.4.1-.1 2.7-2.8a1 1 0 0 0 0-1.4zM12 15.2 8.8 12 12 8.8l3.2 3.2z"
    />
  ),
  confluence: (
    <>
      <path
        fill="#2684FF"
        d="M2.2 17.4c-.3.4-.6 1-.8 1.3a.7.7 0 0 0 .2 1l4.6 2.8a.7.7 0 0 0 1-.2c.2-.3.5-.8.8-1.3 1.9-3.1 3.8-2.7 7.2-1.1l4.6 2.2a.7.7 0 0 0 .9-.3l2.2-4.9a.7.7 0 0 0-.3-.9c-1-.5-2.9-1.4-4.6-2.2-6.2-3-11.5-2.8-15.8 3.6z"
      />
      <path
        fill="#0052CC"
        d="M21.8 6.6c.3-.4.6-1 .8-1.3a.7.7 0 0 0-.2-1L17.8 1.5a.7.7 0 0 0-1 .2c-.2.3-.5.8-.8 1.3-1.9 3.1-3.8 2.7-7.2 1.1L4.2 1.9a.7.7 0 0 0-.9.3L1.1 7.1a.7.7 0 0 0 .3.9c1 .5 2.9 1.4 4.6 2.2 6.2 3 11.5 2.8 15.8-3.6z"
      />
    </>
  ),
  github: (
    <path
      fill="currentColor"
      d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.6 18.3 5 18.3 5c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"
    />
  ),
};

/** A connector logo; `web` uses a neutral globe and `bmw` the workspace roundel. */
export function ToolLogo({ tool, size = 16, className }: { tool: ToolKey; size?: number; className?: string }) {
  const label = TOOL_NAMES[tool];
  if (tool === "web")
    return (
      <span className={`tool-logo tool-logo-web ${className ?? ""}`} style={{ width: size, height: size }} role="img" aria-label={label}>
        <Globe2 size={size * 0.8} />
      </span>
    );
  if (tool === "bmw")
    return (
      <span className={`tool-logo ${className ?? ""}`} style={{ width: size, height: size }} role="img" aria-label={label}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/bmw-grey.svg" alt="" width={size} height={size} />
      </span>
    );
  return (
    <svg className={`tool-logo ${className ?? ""}`} width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
      {marks[tool]}
    </svg>
  );
}
