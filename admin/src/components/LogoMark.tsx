/**
 * SparkXP's app icon (the fox), served from `public/logo-mark.png`.
 *
 * Both the login screen and the sidebar used to draw a lucide `Zap` bolt in a
 * coloured square — a mark that appears nowhere on the phone the admins are
 * managing content for. One component so the two can't drift apart again.
 *
 * The PNG is pre-rounded with transparent corners, so it needs no background of
 * its own and works on the light login page and the dark sidebar alike.
 */
export function LogoMark({
  className = 'h-8 w-8',
}: {
  className?: string;
}) {
  return (
    <img
      src="/logo-mark.png"
      alt=""
      aria-hidden="true"
      className={`rounded-lg ${className}`}
    />
  );
}
