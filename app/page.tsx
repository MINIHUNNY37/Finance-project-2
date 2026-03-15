import { auth } from '@/auth';
import MapCanvasClient from './components/MapCanvasClient';

export default async function Home() {
  let session = null;
  try {
    session = await auth();
  } catch {
    // Auth not configured - continue without session
  }

  // Normalize session to remove null user fields
  const normalizedSession = session?.user
    ? {
        user: {
          name: session.user.name ?? undefined,
          email: session.user.email ?? undefined,
          image: session.user.image ?? undefined,
        },
      }
    : null;

  return <MapCanvasClient serverSession={normalizedSession} />;
}
