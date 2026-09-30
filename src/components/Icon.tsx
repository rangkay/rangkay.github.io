const PATHS = {
  plus: <path d="M8 3.2v9.6M3.2 8h9.6" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  dup: <><rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.8" /><path d="M10.5 3.2H4.8a1.6 1.6 0 0 0-1.6 1.6v5.7" /></>,
  trash: <path d="M3 4.5h10M6.5 4.5V3.2h3v1.3M4.4 4.5l.6 8.2a1.2 1.2 0 0 0 1.2 1.1h3.6a1.2 1.2 0 0 0 1.2-1.1l.6-8.2" />,
  pen: <path d="M10.6 2.9l2.5 2.5-7.6 7.6-3 .5.5-3z" />,
  undo: <><path d="M5.5 4 2.8 6.7l2.7 2.7" /><path d="M3 6.7h6.4a3.6 3.6 0 0 1 0 7.2H7" /></>,
  redo: <><path d="M10.5 4l2.7 2.7-2.7 2.7" /><path d="M13 6.7H6.6a3.6 3.6 0 0 0 0 7.2H9" /></>,
  link: <path d="M6.8 9.2l2.4-2.4M6 5l1.3-1.3a2.6 2.6 0 0 1 3.7 3.7L9.7 8.7M10 11l-1.3 1.3a2.6 2.6 0 0 1-3.7-3.7L6.3 7.3" />,
  print: <><path d="M4.5 6V2.8h7V6M4.5 11.5H3.2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h9.6a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1h-1.3" /><rect x="4.5" y="9.5" width="7" height="4" rx=".8" /></>,
  home: <path d="M2.8 7.2 8 3l5.2 4.2V13a.8.8 0 0 1-.8.8H9.6V10H6.4v3.8H3.6a.8.8 0 0 1-.8-.8z" />,
  db: <><ellipse cx="8" cy="4" rx="5" ry="1.8" /><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8" /></>,
  sun: <><circle cx="8" cy="8" r="2.8" /><path d="M8 1.8v1.4M8 12.8v1.4M1.8 8h1.4M12.8 8h1.4M3.6 3.6l1 1M11.4 11.4l1 1M3.6 12.4l1-1M11.4 4.6l1-1" /></>,
  moon: <path d="M13.2 9.6A5.4 5.4 0 1 1 6.4 2.8a4.3 4.3 0 0 0 6.8 6.8z" />,
  back: <path d="M10 3.5 5.5 8l4.5 4.5" />,
  eye: <><path d="M1.8 8S4 3.8 8 3.8 14.2 8 14.2 8 12 12.2 8 12.2 1.8 8 1.8 8z" /><circle cx="8" cy="8" r="1.9" /></>,
  search: <><circle cx="7.2" cy="7.2" r="4.4" /><path d="m10.4 10.4 3.2 3.2" /></>,
  check: <path d="m3.4 8.4 2.9 2.9 6.3-6.6" />,
  sparkle: <><path d="M8 2.2l1.4 3.4 3.4 1.4-3.4 1.4L8 11.8 6.6 8.4 3.2 7l3.4-1.4z" /><path d="M12.6 11.2l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z" /></>,
  filter: <path d="M2.6 3.6h10.8L9.3 8.4v4.2l-2.6 1.1V8.4z" />,
  page: <><path d="M4 2.5h5.2L12 5.3v8.2H4z" /><path d="M9 2.5v3h3" /></>,
  layers: <><path d="M8 2.3 14 5.6 8 8.9 2 5.6z" /><path d="M2 8.8l6 3.3 6-3.3" /></>,
  box: <><path d="M2.6 5 8 2.3 13.4 5v6L8 13.7 2.6 11z" /><path d="M2.6 5 8 7.7 13.4 5M8 7.7v6" /></>,
  alert: <><path d="M8 2.6 14.2 13H1.8z" /><path d="M8 6.6v3M8 11.3v.1" /></>,
  gauge: <><path d="M2.8 11a5.2 5.2 0 1 1 10.4 0" /><path d="M8 11l2.4-3.4" /></>,
  clock: <><circle cx="8" cy="8" r="5.8" /><path d="M8 4.8V8l2.3 1.4" /></>,
  down: <path d="m4 6 4 4 4-4" />,
  up: <path d="m4 10 4-4 4 4" />,
  info: <><circle cx="8" cy="8" r="5.8" /><path d="M8 7.3v3.6M8 5.2v.1" /></>,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
