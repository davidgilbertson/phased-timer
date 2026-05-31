export function ShareIcon() {
  const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
  if (isApple) {
    return (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 15V3"/>
        <path d="m7 8 5-5 5 5"/>
        <path d="M7 11H5v10h14V11h-2"/>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <path d="m8.6 10.6 6.8-4.2"/>
      <path d="m8.6 13.4 6.8 4.2"/>
    </svg>
  );
}
