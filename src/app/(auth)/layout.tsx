/**
 * Layout for the `(auth)` route group. Renders the login page centered on a
 * dark backdrop, deliberately without the app chrome (no sidebar/top bar).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a1a',
      }}
    >
      {children}
    </div>
  );
}
